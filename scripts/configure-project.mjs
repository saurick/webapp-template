import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadDevPorts, planDerivedPortBundle } from "./dev-ports.mjs";

const TEMPLATE_ID = "webapp-template";
const ROOT = path.resolve(import.meta.dirname, "..");
const IDENTITY_FILES = [
  "web/package.json",
  "web/.env.development",
  "web/.env.production",
  "web/index.html",
  "web/public/index.html",
  "web/public/app-config.js",
  "server/cmd/server/main.go",
  "server/Makefile",
  "server/configs/dev/config.yaml",
  "server/configs/dev/config.local.example.yaml",
  "server/configs/prod/config.yaml",
  "server/deploy/compose/prod/compose.yml",
  "server/deploy/compose/prod/.env.example",
];
const REQUIRED_FILES = [
  "README.md",
  "web/package.json",
  "web/.env.development",
  "web/.env.production",
  "web/public/app-config.js",
  "server/cmd/server/main.go",
  "server/configs/dev/config.yaml",
  "config/dev-ports.env",
];

function assertRegularPath(rootDir, relativePath) {
  let current = rootDir;
  for (const part of relativePath.split("/")) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`${relativePath} 使用了符号链接，请先核对归属`);
    }
  }
  if (!fs.statSync(current).isFile()) {
    throw new Error(`${relativePath} 不是普通文件`);
  }
  return current;
}

function documentPaths(rootDir, directory = "") {
  const result = [];
  for (const entry of fs.readdirSync(path.join(rootDir, directory), {
    withFileTypes: true,
  })) {
    const relativePath = path.posix.join(directory, entry.name);
    if (
      entry.isDirectory() &&
      ![
        "archive",
        "archives",
        "lab-ha", // 旧的本地实验室文档不属于模板配置范围。
        "node_modules",
        "build",
        ".git",
      ].includes(entry.name)
    ) {
      result.push(...documentPaths(rootDir, relativePath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      entry.name !== "progress.md" &&
      relativePath !== "server/docs/development-database.md"
    ) {
      result.push(relativePath);
    }
  }
  return result;
}

function replaceYamlScalar(content, keys, value) {
  const parents = [];
  let matches = 0;
  const result = content
    .split("\n")
    .map((line) => {
      const match = line.match(/^( *)([A-Za-z][A-Za-z0-9_]*):(?:\s+(.*))?$/u);
      if (!match) return line;
      const [, indentation, key] = match;
      while (parents.length && parents.at(-1).indent >= indentation.length)
        parents.pop();
      const currentPath = [...parents.map((parent) => parent.key), key];
      parents.push({ key, indent: indentation.length });
      if (currentPath.join(".") !== keys.join(".")) return line;
      matches += 1;
      return `${indentation}${key}: ${JSON.stringify(value)}`;
    })
    .join("\n");
  if (matches !== 1)
    throw new Error(`dev config 必须且只能定义一次 ${keys.join(".")}`);
  return result;
}

function configureContent(relativePath, original, projectId, name) {
  const databaseName = projectId.replaceAll("-", "_");
  // 文档路径回到仓库根目录，避免把模板作者的机器路径带入新项目。
  const templateRoot =
    /\/(?:Users|home)\/[^/\s]+\/(?:[^/\s`"'()]+\/)*webapp-template/gu;
  let content = original.replace(templateRoot, "__PROJECT_ROOT__");
  content = content.replace(
    /\]\(__PROJECT_ROOT__\/([^\s)]+)\)/gu,
    (_match, target) =>
      `](${path.posix.relative(path.posix.dirname(relativePath), target)})`,
  );
  content = content
    .replaceAll("__PROJECT_ROOT__/", "")
    .replaceAll("__PROJECT_ROOT__", ".");
  // 初始化指南描述工具自身合同，源目录标识不能改成派生项目名。
  if (relativePath === "docs/project-init.md") return content;
  // 项目标识改变不等于重命名现有 Skill / chart 目录。
  const preservedReferences = [];
  content = content.replace(
    /\$webapp-template-[a-z-]+|\.agents\/skills\/webapp-template-[a-z-]+|charts\/webapp-template/gu,
    (reference) => {
      const marker = `__TEMPLATE_REFERENCE_${preservedReferences.length}__`;
      preservedReferences.push({ marker, reference });
      return marker;
    },
  );
  content = content.replaceAll("react-webapp-template", projectId);
  content = content.replaceAll(TEMPLATE_ID, projectId);
  content = content.replaceAll("webapp_template", databaseName);
  content = content.replaceAll("template-server", `${projectId}-server`);
  content = content.replaceAll("your-project", projectId);
  for (const { marker, reference } of preservedReferences)
    content = content.replaceAll(marker, reference);

  if (relativePath === "web/package.json") {
    const pkg = JSON.parse(content);
    pkg.name = projectId;
    pkg.description = name;
    return `${JSON.stringify(pkg, null, 2)}\n`;
  }
  if (/^web\/\.env\.(development|production)$/u.test(relativePath)) {
    // dotenv 不会将 JSON 的转义引号还原；使用不出现在名称中的原生分隔符。
    const quote = name.includes("'") ? "`" : "'";
    return content.replace(
      /^VITE_APP_TITLE=.*$/mu,
      () => `VITE_APP_TITLE=${quote}${name}${quote}`,
    );
  }
  if (relativePath === "web/public/app-config.js") {
    for (const [key, value] of Object.entries({
      productName: name,
      shortName: name,
      adminName: `${name}管理台`,
      adminSubtitle: "管理工作区",
    })) {
      const pattern = new RegExp(`^(\\s*${key}:) [^\\n]*,`, "mu");
      if (!pattern.test(content))
        throw new Error(`app-config.js 缺少 branding.${key}`);
      content = content.replace(
        pattern,
        (_line, prefix) => `${prefix} ${JSON.stringify(value)},`,
      );
    }
    return content;
  }
  if (
    [
      "server/configs/dev/config.yaml",
      "server/configs/dev/config.local.example.yaml",
    ].includes(relativePath)
  ) {
    content = content.replace(
      /^(\s*)# 公共 dev 配置.*$/mu,
      (_line, indentation) =>
        `${indentation}# 开发连接仅为本机占位；真实连接与凭据由 POSTGRES_DSN 或 config.local.yaml 提供。`,
    );
    content = replaceYamlScalar(
      content,
      ["data", "postgres", "dsn"],
      `postgres://${databaseName}:replace-me@127.0.0.1:5432/${databaseName}?sslmode=disable`,
    );
    content = replaceYamlScalar(content, ["trace", "jaeger", "endpoint"], "");
    return content;
  }
  const displayName = relativePath.endsWith(".html")
    ? name
        .replaceAll("&", "&amp;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;")
    : name;
  content = content
    .replaceAll("Project Workspace", () => displayName)
    .replaceAll("Starter Workspace", () => displayName);
  if (relativePath === "README.md")
    content = content.replace(/^# .*$/mu, () => `# ${name}`);
  return content;
}

export function planProjectConfiguration({
  rootDir = ROOT,
  projectId,
  name,
} = {}) {
  const root = fs.realpathSync(rootDir);
  if (
    !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(projectId || "") ||
    projectId.length > 48 ||
    projectId === TEMPLATE_ID
  ) {
    throw new Error(
      "--project-id 使用不超过 48 字符的小写英文、数字和连字符，且不能使用模板标识",
    );
  }
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 40 ||
    /[\u0000-\u001f\u007f<>`$]/u.test(name)
  ) {
    throw new Error(
      "--name 使用 1..40 字符的项目名称，不含控制字符、尖括号、反引号或美元符号",
    );
  }
  for (const relativePath of REQUIRED_FILES)
    assertRegularPath(root, relativePath);
  const current = loadDevPorts({
    rootDir: root,
    env: {},
    allowEnvironmentOverrides: false,
  });
  if (current.projectId !== TEMPLATE_ID) {
    if (current.projectId !== projectId)
      throw new Error(`项目已属于 ${current.projectId}，拒绝重新初始化`);
    return {
      rootDir: root,
      projectId,
      name: name.trim(),
      initialized: true,
      changes: [],
      bundle: current,
    };
  }

  const portPlan = planDerivedPortBundle(root, projectId);
  const changes = new Map(
    portPlan.changes.map((change) => [
      path.relative(root, change.path).split(path.sep).join("/"),
      change,
    ]),
  );
  const paths = new Set([
    ...IDENTITY_FILES,
    ...documentPaths(root, "docs"),
    ...[
      "README.md",
      "AGENTS.md",
      "scripts/README.md",
      "scripts/loadtest/README.md",
      "web/README.md",
      "server/README.md",
      "server/deploy/README.md",
      "server/deploy/compose/prod/README.md",
      "server/internal/data/AI_DB_WORKFLOW.md",
    ],
    ...documentPaths(root, "server/docs"),
  ]);
  for (const relativePath of paths) {
    if (!fs.existsSync(path.join(root, relativePath))) continue;
    const filePath = assertRegularPath(root, relativePath);
    const before = fs.readFileSync(filePath, "utf8");
    const after = configureContent(
      relativePath,
      changes.get(relativePath)?.after ?? before,
      projectId,
      name.trim(),
    );
    changes.set(relativePath, { path: filePath, before, after });
  }
  return {
    rootDir: root,
    projectId,
    name: name.trim(),
    initialized: false,
    changes: [...changes.values()].filter(
      (change) => change.before !== change.after,
    ),
    bundle: portPlan.bundle,
  };
}

export function applyProjectConfiguration(plan) {
  if (path.basename(plan.rootDir) === TEMPLATE_ID)
    throw new Error("请先将模板复制到新项目目录；禁止直接初始化模板源目录");
  // 写入前核对整个计划，避免把预览后的其他改动覆盖掉。
  for (const change of plan.changes) {
    assertRegularPath(
      plan.rootDir,
      path.relative(plan.rootDir, change.path).split(path.sep).join("/"),
    );
    if (fs.readFileSync(change.path, "utf8") !== change.before)
      throw new Error("初始化计划已失效，请重新预览");
  }
  const written = [];
  try {
    for (const change of plan.changes) {
      written.push(change);
      fs.writeFileSync(change.path, change.after, "utf8");
    }
  } catch (error) {
    for (const change of written.reverse())
      fs.writeFileSync(change.path, change.before, "utf8");
    throw error;
  }
}

function main(args) {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      "用法: node scripts/configure-project.mjs --project-id <id> --name <项目名称> [--root <新项目目录>] [--write]\n默认只预览；--write 统一身份、品牌、端口与 dev 本机连接占位，保留管理员配置。真实凭据、部署地址与业务裁剪随后由 init-project.sh --project --strict 核对。",
    );
    return;
  }
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    const key = {
      "--root": "rootDir",
      "--project-id": "projectId",
      "--name": "name",
    }[arg];
    if (
      !key ||
      options[key] !== undefined ||
      !args[index + 1] ||
      args[index + 1].startsWith("--")
    )
      throw new Error(`参数缺失或不支持: ${arg}`);
    options[key] = args[++index];
  }
  const plan = planProjectConfiguration(options);
  console.log(`[configure-project] ${plan.projectId} / ${plan.name}`);
  if (plan.initialized) {
    console.log(
      "[configure-project] 已初始化，保留当前品牌、凭据和固定端口；后续调整直接编辑对应真源。",
    );
    return;
  }
  console.log(
    `[configure-project] ${options.write ? "写入" : "预览"} ${plan.changes.length} 个文件（仅列路径，不输出配置值）`,
  );
  for (const change of plan.changes)
    console.log(`  - ${path.relative(plan.rootDir, change.path)}`);
  if (options.write) applyProjectConfiguration(plan);
  console.log(
    `[configure-project] ${options.write ? "基础配置已完成" : "添加 --write 执行"}；接着处理真实凭据、部署与业务裁剪，运行 bash scripts/init-project.sh --project --strict。`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`[configure-project] ${error.message}`);
    process.exitCode = 1;
  }
}
