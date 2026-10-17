import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function buildFixture(t, overrides = {}, buildArgs = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "template-image-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const dir of ["server/internal", "server/api", "config", "bin"]) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  fs.copyFileSync(
    path.join(import.meta.dirname, "../server/Makefile"),
    path.join(root, "server/Makefile"),
  );
  fs.writeFileSync(path.join(root, "config/dev-ports.env"), "");
  fs.writeFileSync(
    path.join(root, "bin/go"),
    '#!/bin/sh\ncase "$2" in GOHOSTOS) echo linux;; GOPATH) echo /tmp;; esac\n',
    { mode: 0o755 },
  );
  const callsPath = path.join(root, "docker-calls.jsonl");
  fs.writeFileSync(
    path.join(root, "bin/docker"),
    `#!/usr/bin/env node
import fs from "node:fs";
fs.appendFileSync(process.env.IMAGE_TEST_CALLS, JSON.stringify(process.argv.slice(2)) + "\\n");
process.exit(Number(process.env.IMAGE_TEST_EXIT || 0));
`,
    { mode: 0o755 },
  );
  const env = {
    ...process.env,
    PATH: `${path.join(root, "bin")}${path.delimiter}${process.env.PATH}`,
    GIT_OPTIONAL_LOCKS: "0",
    DOCKER_HOST: "unix:///tmp/isolated-docker.sock",
    IMAGE_TEST_CALLS: callsPath,
    ...overrides,
  };
  delete env.MAKEFLAGS;
  delete env.MFLAGS;
  const result = spawnSync(
    "make",
    [
      "build_server",
      "IMAGE_TAG=verification",
      "FIXED_TAG=local",
      "IMAGE_REGISTRY=registry.example.test",
      "BUILDER=isolated-builder",
      "IMAGE_PLATFORM=linux/arm64",
      ...buildArgs,
    ],
    { cwd: path.join(root, "server"), env, encoding: "utf8" },
  );
  const calls = fs.existsSync(callsPath)
    ? fs
        .readFileSync(callsPath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
    : [];
  return { result, calls };
}

test("镜像打包独立选择仓库、builder 和目标平台，不清理或推送已有镜像", (t) => {
  const { result, calls } = buildFixture(t);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(calls.length, 1, JSON.stringify(calls));
  const [args] = calls;
  assert.deepEqual(args.slice(0, 3), ["buildx", "build", "--load"]);
  assert.equal(args[args.indexOf("--builder") + 1], "isolated-builder");
  assert.equal(args[args.indexOf("--platform") + 1], "linux/arm64");
  const tags = args.flatMap((arg, index) =>
    arg === "-t" ? [args[index + 1]] : [],
  );
  assert.equal(tags.length, 2);
  assert.match(
    tags[0],
    /^registry\.example\.test\/[^/:]+-server:verification$/u,
  );
  assert.match(tags[1], /^registry\.example\.test\/[^/:]+-server:local$/u);
  assert.equal(args.at(-1), "..");
  assert.doesNotMatch(args.join(" "), /isolated-docker\.sock/u);
});

test("镜像构建失败会返回失败，不执行后续清理或推送", (t) => {
  const { result, calls } = buildFixture(t, { IMAGE_TEST_EXIT: "42" });
  assert.notEqual(result.status, 0);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 2), ["buildx", "build"]);
});

test("未指定 builder 时使用当前构建器，默认交付平台保持 amd64", (t) => {
  const { result, calls } = buildFixture(t, {}, [
    "BUILDER=",
    "IMAGE_PLATFORM=linux/amd64",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].includes("--builder"));
  assert.ok(!calls[0].includes(""));
  assert.equal(calls[0][calls[0].indexOf("--platform") + 1], "linux/amd64");
});

test("发布脚本导出含标签的 IMAGE_NAME 时不会污染 make 的镜像仓库名", (t) => {
  const { result, calls } = buildFixture(t, {
    IMAGE_NAME: "published-example:dev",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].join(" "), /published-example:dev:/u);
  assert.match(
    calls[0][calls[0].indexOf("-t") + 1],
    /^registry\.example\.test\/[^/:]+-server:verification$/u,
  );
});
