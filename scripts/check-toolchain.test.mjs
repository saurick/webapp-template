import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkToolchain } from "./check-toolchain.mjs";

function fixture(t) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-toolchain-"));
  t.after(() => fs.rmSync(rootDir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(rootDir, "web"));
  fs.mkdirSync(path.join(rootDir, "server"));
  fs.writeFileSync(path.join(rootDir, ".n-node-version"), "24.21.0\n");
  fs.writeFileSync(
    path.join(rootDir, "web/package.json"),
    JSON.stringify({
      engines: { node: "24.x" },
      packageManager: "pnpm@10.34.5",
    }),
  );
  fs.writeFileSync(
    path.join(rootDir, "server/go.mod"),
    "module server\n\ngo 1.26.9\n",
  );
  return rootDir;
}

test("版本匹配且 Go 高于最低要求时通过", (t) => {
  const rootDir = fixture(t);
  for (const go of ["1.26.9", "1.26.10", "1.27.0"]) {
    assert.deepEqual(
      checkToolchain({
        rootDir,
        versions: { node: "24.21.0", pnpm: "10.34.5", go },
      }).errors,
      [],
    );
  }
});

test("Node、pnpm 漂移和过低 Go 明确阻断", (t) => {
  const rootDir = fixture(t);
  const result = checkToolchain({
    rootDir,
    versions: { node: "24.14.0", pnpm: "9.15.0", go: "1.26.8" },
  });
  assert.equal(result.errors.length, 3);
  assert.match(result.errors.join("\n"), /Node 当前.*pnpm 当前.*Go 当前/su);
});

test("版本声明缺失、重复或不一致时阻断", (t) => {
  const rootDir = fixture(t);
  fs.writeFileSync(path.join(rootDir, ".nvmrc"), "22\n");
  fs.writeFileSync(
    path.join(rootDir, "web/package.json"),
    JSON.stringify({ engines: { node: "22.x" } }),
  );
  const result = checkToolchain({
    rootDir,
    versions: { node: "24.21.0", go: "1.26.9" },
  });
  assert.match(result.errors.join("\n"), /engines.node/u);
  assert.match(result.errors.join("\n"), /packageManager/u);
  assert.match(result.errors.join("\n"), /重复/u);
});

test("容器和 Make 构建默认版本漂移时阻断", (t) => {
  const rootDir = fixture(t);
  fs.writeFileSync(
    path.join(rootDir, "server/Dockerfile"),
    "ARG NODE_BUILDER_IMAGE=node:24.14.0\nARG PNPM_VERSION=10.13.1\nARG GO_BUILDER_IMAGE=golang:1.26.9\n",
  );
  fs.writeFileSync(
    path.join(rootDir, "server/Makefile"),
    "NODE_BUILDER_IMAGE ?= node:24.14.0\nPNPM_VERSION ?= 10.13.1\nGO_BUILDER_IMAGE ?= golang:1.26.9\n",
  );
  const result = checkToolchain({
    rootDir,
    versions: { node: "24.21.0", pnpm: "10.34.5", go: "1.26.9" },
  });
  assert.equal(result.errors.length, 4);
  assert.match(result.errors.join("\n"), /Dockerfile.*NODE_BUILDER_IMAGE/u);
  assert.match(result.errors.join("\n"), /Makefile.*PNPM_VERSION/u);
});

test("本机 Go 已升级但容器仍使用旧版时阻断", (t) => {
  const rootDir = fixture(t);
  fs.writeFileSync(
    path.join(rootDir, "server/Dockerfile"),
    "ARG NODE_BUILDER_IMAGE=node:24.21.0\nARG PNPM_VERSION=10.34.5\nARG GO_BUILDER_IMAGE=golang:1.26.5\n",
  );
  const versions = { node: "24.21.0", pnpm: "10.34.5", go: "1.26.9" };
  assert.deepEqual(checkToolchain({ rootDir, versions }).errors, [
    "server/Dockerfile GO_BUILDER_IMAGE 默认值必须与 server/go.mod 的 Go 版本一致",
  ]);
  fs.writeFileSync(
    path.join(rootDir, "server/Dockerfile"),
    "ARG NODE_BUILDER_IMAGE=node:24.21.0\nARG PNPM_VERSION=10.34.5\nARG GO_BUILDER_IMAGE=golang:1.26.9\n",
  );
  assert.deepEqual(checkToolchain({ rootDir, versions }).errors, []);
});

test("CI 镜像不能使用低于源码合同的 Go 基线", (t) => {
  const rootDir = fixture(t);
  const ciPath = path.join(rootDir, ".gitlab-ci.yml");
  const versions = { node: "24.21.0", pnpm: "10.34.5", go: "1.26.9" };
  fs.writeFileSync(ciPath, 'variables:\n  CI_GO_IMAGE: "golang:1.26.8"\n');
  assert.deepEqual(checkToolchain({ rootDir, versions }).errors, [
    ".gitlab-ci.yml CI_GO_IMAGE 必须与 server/go.mod 的 Go 版本一致",
  ]);
  fs.writeFileSync(ciPath, 'variables:\n  CI_GO_IMAGE: "golang:1.26.9"\n');
  assert.deepEqual(checkToolchain({ rootDir, versions }).errors, []);
});
