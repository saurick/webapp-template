import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const hasGitleaks = spawnSync("gitleaks", ["version"]).status === 0;

for (const registryFile of [".npmrc", ".yarnrc.yml", "config.yaml"]) {
  test(
    `密钥检查覆盖未改动的 ${registryFile}，保留 staged-only 的索引边界`,
    { skip: !hasGitleaks && "本机未安装 gitleaks；strict 会另行阻断" },
    (t) => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "registry-secrets-"));
      t.after(() => fs.rmSync(root, { recursive: true, force: true }));
      const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
      for (const key of [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_INDEX_FILE",
        "GIT_OBJECT_DIRECTORY",
        "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "QA_BASE_RANGE",
        "SKIP_SECRETS_SCAN",
        "SECRETS_STAGED_ONLY",
      ])
        delete env[key];
      env.SECRETS_STRICT = "1";
      fs.mkdirSync(path.join(root, "scripts/qa"), { recursive: true });
      fs.mkdirSync(path.join(root, "web"));
      fs.copyFileSync(
        path.join(import.meta.dirname, "qa/secrets.sh"),
        path.join(root, "scripts/qa/secrets.sh"),
      );
      // 均匀的合成字母数字值稳定满足扫描熵门槛，不接触任何包源账户。
      const alphabet =
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
      const syntheticToken = Array.from(
        alphabet,
        (_, index) => alphabet[(index * 17 + 11) % alphabet.length],
      ).join("");
      const configPath = path.join(root, "web", registryFile);
      fs.writeFileSync(
        configPath,
        registryFile === ".npmrc"
          ? `//packages.example.test/:_authToken=${syntheticToken}\n`
          : registryFile === ".yarnrc.yml"
            ? `npmAuthToken: '${syntheticToken}'\n`
            : `api_key: '${syntheticToken}'\n`,
      );
      fs.writeFileSync(path.join(root, "control.txt"), "control\n");
      const git = (args) =>
        execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
      git(["init", "--quiet"]);
      git([
        "add",
        "--",
        "scripts/qa/secrets.sh",
        `web/${registryFile}`,
        "control.txt",
      ]);
      git([
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@localhost",
        "commit",
        "--quiet",
        "-m",
        "test: 注册表配置夹具",
      ]);
      assert.equal(git(["status", "--porcelain=v1"]).toString(), "");
      const scan = (extra = {}) =>
        spawnSync("bash", ["scripts/qa/secrets.sh"], {
          cwd: root,
          env: { ...env, ...extra },
          encoding: "utf8",
        });
      let result = scan();
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /SECRETS_STRICT=1，阻断/u);
      assert.ok(!(result.stdout + result.stderr).includes(syntheticToken));

      fs.writeFileSync(path.join(root, "control.txt"), "staged control\n");
      git(["add", "--", "control.txt"]);
      result = scan({ SECRETS_STAGED_ONLY: "1" });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /通过/u);

      fs.writeFileSync(
        configPath,
        registryFile === ".npmrc"
          ? "node-linker=hoisted\n"
          : registryFile === ".yarnrc.yml"
            ? "nodeLinker: node-modules\n"
            : "endpoint: https://api.example.test\n",
      );
      result = scan();
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /通过/u);
    },
  );
}
