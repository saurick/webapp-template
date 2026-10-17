import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";

for (const untracked of [false, true]) {
  test(`strict 在${untracked ? "未跟踪" : "已跟踪"}文件密钥扫描失败时阻断，不能继续构建`, (t) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-strict-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
    delete env.SKIP_SECRETS_SCAN;
    delete env.SECRETS_STRICT;
    delete env.SECRETS_STAGED_ONLY;
    delete env.QA_BASE_RANGE;
    fs.mkdirSync(path.join(root, "scripts/qa"), { recursive: true });
    fs.mkdirSync(path.join(root, "bin"));
    for (const name of ["strict.sh", "secrets.sh"]) {
      fs.copyFileSync(
        path.join(import.meta.dirname, "qa", name),
        path.join(root, "scripts/qa", name),
      );
    }
    for (const name of [
      "check-toolchain.mjs",
      "qa/skill-health.mjs",
      "control.test.mjs",
    ]) {
      fs.writeFileSync(
        path.join(root, "scripts", name),
        "// Isolated gate control.\n",
      );
    }
    fs.writeFileSync(path.join(root, "bin/gitleaks"), "#!/bin/sh\nexit 1\n", {
      mode: 0o755,
    });
    for (const name of ["pnpm", "go"]) {
      fs.writeFileSync(
        path.join(root, "bin", name),
        "#!/bin/sh\necho build-must-not-run\nexit 0\n",
        { mode: 0o755 },
      );
    }
    env.PATH = `${path.join(root, "bin")}${path.delimiter}${process.env.PATH}`;
    execFileSync("git", ["init", "--quiet", root], { env });
    fs.writeFileSync(path.join(root, "control.txt"), "initial\n");
    execFileSync("git", ["-C", root, "add", "--", "control.txt"], { env });
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@localhost",
        "commit",
        "--quiet",
        "-m",
        "test: 控制样本",
      ],
      { env },
    );
    fs.writeFileSync(
      path.join(root, untracked ? "candidate.txt" : "control.txt"),
      "candidate\n",
    );
    const result = spawnSync("bash", ["scripts/qa/strict.sh"], {
      cwd: root,
      env,
      encoding: "utf8",
    });
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /SECRETS_STRICT=1，阻断/u);
    assert.doesNotMatch(output, /build-must-not-run/u);
  });
}
