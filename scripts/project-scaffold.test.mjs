import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import { prepareProject } from "./project-scaffold.mjs";

test("从完整模板建立无凭据工程骨架，初始化 strict 通过且重复执行保留端口", (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "project-scaffold-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const rootDir = path.join(parent, "starter-proof");
  fs.mkdirSync(rootDir);
  const archive = path.join(parent, "source.tar");
  const source = path.resolve(import.meta.dirname, "..");
  const env = { ...process.env, GIT_OPTIONAL_LOCKS: "0" };
  for (const key of [
    "GIT_DIR",
    "GIT_WORK_TREE",
    "GIT_INDEX_FILE",
    "GIT_COMMON_DIR",
    "GIT_OBJECT_DIRECTORY",
    "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  ])
    delete env[key];
  execFileSync("git", ["archive", "--output", archive, "HEAD"], {
    cwd: source,
    env,
  });
  execFileSync("tar", ["-xf", archive, "-C", rootDir]);
  execFileSync("git", ["init", "--quiet", "-b", "main"], { cwd: rootDir, env });
  const currentId = fs
    .readFileSync(path.join(rootDir, "config/dev-ports.env"), "utf8")
    .match(/^DEV_PROJECT_ID=(.+)$/mu)[1];
  const options = {
    rootDir,
    projectId: currentId === "webapp-template" ? "starter-proof" : currentId,
    name: "工程基线验证",
    sourceSha: "a".repeat(40),
    creationId: "scaffold-regression",
  };
  prepareProject(options);
  const ports = fs.readFileSync(
    path.join(rootDir, "config/dev-ports.env"),
    "utf8",
  );
  prepareProject(options);
  assert.equal(
    fs.readFileSync(path.join(rootDir, "config/dev-ports.env"), "utf8"),
    ports,
  );
  const result = spawnSync(
    "bash",
    ["scripts/init-project.sh", "--project", "--strict"],
    { cwd: rootDir, env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  for (const mode of ["dev", "prod"]) {
    const config = fs.readFileSync(
      path.join(rootDir, `server/configs/${mode}/config.yaml`),
      "utf8",
    );
    assert.match(config, /jwtSecret: ""/u);
    assert.match(config, /password: ""/u);
    assert.match(config, /dsn: ""/u);
  }
  const compose = fs.readFileSync(
    path.join(rootDir, "server/deploy/compose/prod/compose.yml"),
    "utf8",
  );
  for (const key of ["POSTGRES_PASSWORD", "POSTGRES_DSN", "WEBAPP_JWT_SECRET"])
    assert.ok(compose.includes(`\${${key}:?`));
  const preflight = spawnSync(
    "bash",
    [
      "scripts/deploy/production-preflight.sh",
      "--env-file",
      "server/deploy/compose/prod/.env.example",
    ],
    { cwd: rootDir, env, encoding: "utf8" },
  );
  assert.notEqual(
    preflight.status,
    0,
    "未填写私有配置的工程骨架不能通过生产预检",
  );
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(rootDir, ".project-bootstrap.json")))
      .deployment,
    "unconfigured",
  );
  assert.ok(
    fs.existsSync(path.join(rootDir, "server/deploy/dev/kustomization.yaml")),
  );
  assert.ok(fs.existsSync(path.join(rootDir, "server/internal/biz/rbac.go")));
});
