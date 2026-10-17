import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadDevPorts } from "../dev-ports.mjs";

const root = fs.realpathSync(path.resolve(import.meta.dirname, "../.."));
const output = path.join(root, "output/ci");
fs.mkdirSync(output, { recursive: true });
const work = fs.mkdtempSync(path.join(output, "initialize-"));
const derived = path.join(work, "ci-client");
fs.mkdirSync(derived);
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
function run(command, args, cwd = derived, options = {}) {
  return execFileSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    ...options,
  });
}
function git(args, cwd = derived) {
  return run("git", args, cwd, {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  }).trim();
}
const sourceSha = git(["rev-parse", "HEAD"], root);
if (process.env.CI_COMMIT_SHA && process.env.CI_COMMIT_SHA !== sourceSha)
  throw new Error("初始化输入与流水线 commit 不一致");
try {
  const archive = path.join(work, "source.tar");
  run("git", ["archive", "--output", archive, "HEAD"], root);
  run("tar", ["-xf", archive, "-C", derived], root);
  run("git", ["init", "--quiet", "-b", "master"]);
  const sourceProjectId = loadDevPorts({
    rootDir: derived,
    env: {},
    allowEnvironmentOverrides: false,
  }).projectId;
  const projectId =
    sourceProjectId === "webapp-template" ? "ci-client" : sourceProjectId;
  if (sourceProjectId === "webapp-template") {
    const configure = [
      "scripts/configure-project.mjs",
      "--project-id",
      projectId,
      "--name",
      "CI 验证项目",
    ];
    run(process.execPath, configure);
    run(process.execPath, [...configure, "--write"]);
  }

  // 离线派生样例使用可识别的合成配置；不生成或接入真实部署凭据。
  const replacements = [
    ["webapp-template", projectId],
    ["webapp_template", projectId.replaceAll("-", "_")],
    ["your-project", projectId],
    ["template-server", `${projectId}-server`],
    ["test_database_atlas", projectId.replaceAll("-", "_")],
    ["registry.example.com", "registry.ci.invalid"],
    ["registry.xxxx", "registry.ci.invalid"],
    ["deploy.example.com", "deploy.ci.invalid"],
    ["dashboard.example.local", "dashboard.ci.invalid"],
    ["otel-collector.observability.svc.cluster.local", "localhost"],
    ["prometheus:9090", "localhost:9090"],
  ];
  function configureFixture(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("派生样例配置不接受符号链接");
      if (entry.isDirectory()) configureFixture(file);
      else {
        let content = fs.readFileSync(file, "utf8");
        for (const [from, to] of replacements)
          content = content.replaceAll(from, to);
        content = content.replace(
          /replace-me(?:-[a-z0-9]+)*/gu,
          "ci-fixture-only",
        );
        fs.writeFileSync(file, content);
      }
    }
  }
  configureFixture(path.join(derived, "server/deploy"));
  configureFixture(path.join(derived, "server/configs"));
  const k8sDoc = path.join(derived, "server/docs/k8s.md");
  let k8s = fs.readFileSync(k8sDoc, "utf8");
  for (const [from, to] of replacements) k8s = k8s.replaceAll(from, to);
  fs.writeFileSync(k8sDoc, k8s);
  fs.writeFileSync(
    path.join(derived, ".ci-fixture.json"),
    JSON.stringify(
      { fixture_only: true, source_sha: sourceSha, project_id: projectId },
      null,
      2,
    ) + "\n",
  );
  run("git", ["add", "."]);
  run("git", [
    "-c",
    "user.name=CI Fixture",
    "-c",
    "user.email=ci-fixture@example.invalid",
    "commit",
    "--quiet",
    "-m",
    "test(init): 建立离线派生样例",
  ]);
  run("bash", ["scripts/init-project.sh", "--project", "--strict"]);
  run("bash", ["scripts/bootstrap.sh"]);
  run("bash", ["scripts/qa/strict.sh"]);
  if (git(["status", "--porcelain=v1"]))
    throw new Error("派生验证改写了源码或 index");
  const derivedSha = git(["rev-parse", "HEAD"]);
  run("git", [
    "bundle",
    "create",
    path.join(output, "derived.bundle"),
    "HEAD",
    "refs/heads/master",
  ]);
  fs.writeFileSync(
    path.join(output, "derived.json"),
    JSON.stringify(
      {
        source_sha: sourceSha,
        derived_sha: derivedSha,
        pipeline_id: process.env.CI_PIPELINE_ID || null,
        fixture_only: true,
        init: "passed",
        strict: "passed",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
