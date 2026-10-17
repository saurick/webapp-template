import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import test from "node:test";
import vm from "node:vm";

import {
  applyProjectConfiguration,
  planProjectConfiguration,
} from "./configure-project.mjs";
import { auditRootPortParity, loadDevPorts } from "./dev-ports.mjs";

const SOURCE = path.resolve(import.meta.dirname, "..");

function fixture(t, basename = "new-project") {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "template-configure-"));
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }));
  const rootDir = path.join(parent, basename);
  const overrides =
    'trace:\n  jaeger:\n    endpoint: collector.example:4318\ndata:\n  postgres:\n    dsn: "postgres://template:replace-me@127.0.0.1:5432/webapp_template"\n';
  // 输入夹具独立于当前仓库身份，使派生项目仍能验证初始化合同。
  const files = {
    "config/dev-ports.env":
      "DEV_PROJECT_ID=webapp-template\nDEV_WEB_PORT=5177\nDEV_HTTP_PORT=8200\nDEV_GRPC_PORT=9200\nDEV_STYLE_PORT=6177\nDEV_AUX_PORT_START=15400\n",
    "web/package.json": JSON.stringify({
      name: "react-webapp-template",
      description: "template",
    }),
    "web/.env.development": "VITE_APP_TITLE=Project Workspace\n",
    "web/.env.production": "VITE_APP_TITLE=Project Workspace\n",
    "web/public/app-config.js":
      "window.__WEBAPP_CONFIG__ = {\n  branding: {\n    productName: '',\n    shortName: 'Workspace',\n    adminName: 'Admin Preset',\n    adminSubtitle: 'basic RBAC',\n  },\n}\n",
    "web/public/index.html": "<title>Project Workspace</title>\n",
    "server/cmd/server/main.go":
      'package main\nvar Name = "webapp-template-server"\n',
    "server/Makefile": "IMAGE_NAME = webapp-template-server\n",
    "server/configs/dev/config.yaml":
      "server:\n  http:\n    addr: 0.0.0.0:8200\n  grpc:\n    addr: 0.0.0.0:9200\n" +
      overrides,
    "server/configs/dev/config.local.example.yaml": overrides,
    "server/configs/prod/config.yaml": overrides,
    "server/deploy/compose/prod/.env.example": "PROJECT_SLUG=webapp-template\n",
    "server/deploy/compose/prod/compose.yml": "name: webapp-template-prod\n",
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const destination = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
  }
  fs.mkdirSync(path.join(rootDir, "scripts"));
  for (const script of ["dev-ports.mjs", "init-project.sh"]) {
    fs.copyFileSync(
      path.join(SOURCE, "scripts", script),
      path.join(rootDir, "scripts", script),
    );
  }
  fs.mkdirSync(path.join(rootDir, "docs"));
  fs.mkdirSync(path.join(rootDir, "server/docs"));
  fs.writeFileSync(
    path.join(rootDir, "README.md"),
    "# webapp-template\n[初始化](/Users/example/projects/webapp-template/docs/project-init.md)\n",
  );
  fs.writeFileSync(
    path.join(rootDir, "docs/project-init.md"),
    "[配置](/Users/example/projects/webapp-template/server/docs/config.md)\n",
  );
  fs.writeFileSync(
    path.join(rootDir, "AGENTS.md"),
    "# webapp-template\n使用 `$webapp-template-domain-boundary-governance`，路径 `.agents/skills/webapp-template-domain-boundary-governance/`。\n",
  );
  fs.writeFileSync(
    path.join(rootDir, "docs/deployment-conventions.md"),
    "使用 `server/deploy/platform/charts/webapp-template` 与 `charts/webapp-template`。\n",
  );
  fs.writeFileSync(
    path.join(rootDir, "server/docs/development-database.md"),
    "webapp_template 的登记现场，初始化后须按新项目事实评审。\n",
  );
  fs.writeFileSync(path.join(rootDir, "server/docs/config.md"), "配置入口\n");
  fs.writeFileSync(
    path.join(rootDir, "server/configs/dev/config.local.yaml"),
    "data:\n  auth:\n    admin:\n      password: local-password-must-stay\n",
  );
  return rootDir;
}

function options(rootDir) {
  return { rootDir, projectId: "inventory-app", name: '库存 & A "B" 系统' };
}

test("预览不写文件，写入后身份品牌端口一致，本地配置保留", (t) => {
  const rootDir = fixture(t);
  const localPath = path.join(rootDir, "server/configs/dev/config.local.yaml");
  const localBefore = fs.readFileSync(localPath, "utf8");
  const manifestBefore = fs.readFileSync(
    path.join(rootDir, "config/dev-ports.env"),
    "utf8",
  );
  const plan = planProjectConfiguration(options(rootDir));
  assert.equal(
    fs.readFileSync(path.join(rootDir, "config/dev-ports.env"), "utf8"),
    manifestBefore,
  );
  assert.equal(loadDevPorts({ rootDir, env: {} }).projectId, "webapp-template");
  assert.ok(plan.changes.length > 10);
  applyProjectConfiguration(plan);
  assert.equal(loadDevPorts({ rootDir, env: {} }).projectId, "inventory-app");
  assert.equal(auditRootPortParity(rootDir).httpPort, plan.bundle.httpPort);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(rootDir, "web/package.json"))).name,
    "inventory-app",
  );
  assert.match(
    fs.readFileSync(path.join(rootDir, "server/cmd/server/main.go"), "utf8"),
    /inventory-app-server/u,
  );
  assert.match(
    fs.readFileSync(
      path.join(rootDir, "server/configs/dev/config.yaml"),
      "utf8",
    ),
    /inventory_app:replace-me@127\.0\.0\.1:5432\/inventory_app/u,
  );
  assert.match(
    fs.readFileSync(
      path.join(rootDir, "server/configs/dev/config.local.example.yaml"),
      "utf8",
    ),
    /inventory_app:replace-me@127\.0\.0\.1:5432\/inventory_app/u,
  );
  assert.match(
    fs.readFileSync(path.join(rootDir, "web/.env.development"), "utf8"),
    /VITE_APP_TITLE='库存 & A "B" 系统'/u,
  );
  const context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(path.join(rootDir, "web/public/app-config.js"), "utf8"),
    context,
  );
  assert.equal(
    context.window.__WEBAPP_CONFIG__.branding.productName,
    options(rootDir).name,
  );
  assert.match(
    fs.readFileSync(path.join(rootDir, "web/public/index.html"), "utf8"),
    /库存 &amp; A &quot;B&quot; 系统/u,
  );
  assert.match(
    fs.readFileSync(path.join(rootDir, "docs/project-init.md"), "utf8"),
    /\]\(\.\.\/server\/docs\/config\.md\)/u,
  );
  assert.equal(fs.readFileSync(localPath, "utf8"), localBefore);
  assert.match(
    fs.readFileSync(path.join(rootDir, "AGENTS.md"), "utf8"),
    /\$webapp-template-domain-boundary-governance/u,
  );
  assert.match(
    fs.readFileSync(
      path.join(rootDir, "docs/deployment-conventions.md"),
      "utf8",
    ),
    /charts\/webapp-template/u,
  );
  assert.match(
    fs.readFileSync(
      path.join(rootDir, "server/docs/development-database.md"),
      "utf8",
    ),
    /webapp_template/u,
  );
});

test("重复初始化保留后续品牌和配置，拒绝切换到其他项目", (t) => {
  const rootDir = fixture(t);
  applyProjectConfiguration(planProjectConfiguration(options(rootDir)));
  const configPath = path.join(rootDir, "web/public/app-config.js");
  fs.writeFileSync(configPath, "local branding\n");
  const plan = planProjectConfiguration(options(rootDir));
  assert.equal(plan.initialized, true);
  assert.deepEqual(plan.changes, []);
  applyProjectConfiguration(plan);
  assert.equal(fs.readFileSync(configPath, "utf8"), "local branding\n");
  assert.throws(
    () =>
      planProjectConfiguration({ ...options(rootDir), projectId: "other-app" }),
    /拒绝重新初始化/u,
  );
});

test("缺少配置、符号链接和计划过期均在写入前阻断", (t) => {
  const rootDir = fixture(t);
  const manifestPath = path.join(rootDir, "config/dev-ports.env");
  const before = fs.readFileSync(manifestPath, "utf8");
  const plan = planProjectConfiguration(options(rootDir));
  fs.appendFileSync(path.join(rootDir, "README.md"), "another writer\n");
  assert.throws(() => applyProjectConfiguration(plan), /计划已失效/u);
  assert.equal(fs.readFileSync(manifestPath, "utf8"), before);

  const mainPath = path.join(rootDir, "server/cmd/server/main.go");
  fs.rmSync(mainPath);
  assert.throws(() => planProjectConfiguration(options(rootDir)), /ENOENT/u);
  fs.symlinkSync(path.join(SOURCE, "server/cmd/server/main.go"), mainPath);
  assert.throws(() => planProjectConfiguration(options(rootDir)), /符号链接/u);
  assert.equal(fs.readFileSync(manifestPath, "utf8"), before);
});

test("拒绝直接初始化模板目录及不合法的输入", (t) => {
  const rootDir = fixture(t, "webapp-template");
  const plan = planProjectConfiguration(options(rootDir));
  assert.throws(() => applyProjectConfiguration(plan), /模板源目录/u);
  for (const projectId of [
    "webapp-template",
    "../outside",
    "has_underscore",
    "UPPERCASE",
    "a".repeat(49),
  ]) {
    assert.throws(
      () => planProjectConfiguration({ ...options(rootDir), projectId }),
      /project-id/u,
    );
  }
  for (const name of ["", "bad\nname", "<script>", "`command`", "$HOME"]) {
    assert.throws(
      () => planProjectConfiguration({ ...options(rootDir), name }),
      /name/u,
    );
  }
});

test("初始化扫描从脚本定位仓库、遵循已配置身份并隐藏凭据", (t) => {
  const rootDir = fixture(t);
  applyProjectConfiguration(planProjectConfiguration(options(rootDir)));
  execFileSync("git", ["init", "--quiet", rootDir], {
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
  execFileSync("git", [
    "-C",
    rootDir,
    "config",
    "remote.origin.url",
    "https://example.invalid/webapp-template.git",
  ]);
  fs.writeFileSync(
    path.join(rootDir, "server/configs/dev/config.local.yaml"),
    "data:\n  postgres:\n    dsn: postgres://user:must-never-print@localhost/webapp_template\n  auth:\n    jwtSecret: replace-me-must-never-print\n",
  );
  const result = spawnSync(
    "bash",
    [path.join(rootDir, "scripts/init-project.sh"), "--strict"],
    { cwd: path.join(rootDir, "web"), encoding: "utf8" },
  );
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 1, output);
  assert.match(output, /当前模式: project/u);
  assert.match(output, /config\.local\.yaml:\d+/u);
  assert.doesNotMatch(output, /must-never-print|postgres:\/\//u);
});
