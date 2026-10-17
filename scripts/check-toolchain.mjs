import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");

function parseVersion(version) {
  const match = String(version || "").match(/^(?:v|go)?(\d+)\.(\d+)\.(\d+)$/u);
  return match ? match.slice(1).map(Number) : null;
}

function versionAtLeast(actual, expected) {
  const left = parseVersion(actual);
  const right = parseVersion(expected);
  if (!left || !right) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index];
  }
  return true;
}

export function checkToolchain({ rootDir = ROOT, versions } = {}) {
  const errors = [];
  const nodeVersion = fs
    .readFileSync(path.join(rootDir, ".n-node-version"), "utf8")
    .trim();
  const pkg = JSON.parse(
    fs.readFileSync(path.join(rootDir, "web/package.json"), "utf8"),
  );
  const goMod = fs.readFileSync(path.join(rootDir, "server/go.mod"), "utf8");
  const pnpmVersion = pkg.packageManager?.match(
    /^pnpm@(\d+\.\d+\.\d+)(?:\+sha\d+\..+)?$/u,
  )?.[1];
  const goVersion =
    goMod.match(/^toolchain go(\d+\.\d+\.\d+)$/mu)?.[1] ||
    goMod.match(/^go (\d+\.\d+(?:\.\d+)?)$/mu)?.[1];
  const normalizedGo =
    goVersion?.split(".").length === 2 ? `${goVersion}.0` : goVersion;

  if (!parseVersion(nodeVersion))
    errors.push(".n-node-version 必须固定完整的 Node 版本");
  if (pkg.engines?.node !== `${nodeVersion.split(".")[0]}.x`)
    errors.push(
      "web/package.json engines.node 必须与 .n-node-version 的主版本一致",
    );
  if (!pnpmVersion)
    errors.push("web/package.json packageManager 必须固定 pnpm@x.y.z");
  if (!normalizedGo || !parseVersion(normalizedGo))
    errors.push("server/go.mod 缺少有效的 Go 版本声明");
  for (const duplicate of [".node-version", ".nvmrc"]) {
    if (fs.existsSync(path.join(rootDir, duplicate)))
      errors.push(
        `${duplicate} 与 .n-node-version 重复，请保留一个 Node 版本真源`,
      );
  }
  for (const [relativePath, nodePattern, pnpmPattern, goPattern] of [
    [
      "server/Dockerfile",
      /^ARG NODE_BUILDER_IMAGE=node:(\S+)$/mu,
      /^ARG PNPM_VERSION=(\S+)$/mu,
      /^ARG GO_BUILDER_IMAGE=golang:(\S+)$/mu,
    ],
    [
      "server/Makefile",
      /^NODE_BUILDER_IMAGE \?= node:(\S+)$/mu,
      /^PNPM_VERSION \?= (\S+)$/mu,
      /^GO_BUILDER_IMAGE \?= golang:(\S+)$/mu,
    ],
  ]) {
    const filePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, "utf8");
    if (content.match(nodePattern)?.[1] !== nodeVersion)
      errors.push(
        `${relativePath} NODE_BUILDER_IMAGE 默认值必须与 .n-node-version 一致`,
      );
    if (content.match(pnpmPattern)?.[1] !== pnpmVersion)
      errors.push(
        `${relativePath} PNPM_VERSION 默认值必须与 packageManager 一致`,
      );
    if (content.match(goPattern)?.[1] !== normalizedGo)
      errors.push(
        `${relativePath} GO_BUILDER_IMAGE 默认值必须与 server/go.mod 的 Go 版本一致`,
      );
  }
  if (versions.node !== nodeVersion)
    errors.push(
      `Node 当前 ${versions.node || "未安装"}，要求 ${nodeVersion}；可使用 n auto 或现有版本管理器切换`,
    );
  if (pnpmVersion && versions.pnpm !== pnpmVersion)
    errors.push(
      `pnpm 当前 ${versions.pnpm || "未安装"}，要求 ${pnpmVersion}（web/package.json packageManager）`,
    );
  if (normalizedGo && !versionAtLeast(versions.go, normalizedGo))
    errors.push(
      `Go 当前 ${versions.go || "未安装"}，要求 >= ${normalizedGo}（server/go.mod）`,
    );
  return {
    errors,
    expected: { node: nodeVersion, pnpm: pnpmVersion, go: normalizedGo },
  };
}

function commandVersion(command, args, cwd) {
  try {
    return execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      timeout: 20000,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    }).trim();
  } catch {
    return "";
  }
}

function main() {
  const versions = {
    node: process.versions.node,
    pnpm: commandVersion("pnpm", ["--version"], path.join(ROOT, "web")),
    go: commandVersion("go", ["version"], path.join(ROOT, "server")).match(
      /\bgo(\d+\.\d+\.\d+)\b/u,
    )?.[1],
  };
  const result = checkToolchain({ versions });
  if (result.errors.length) {
    for (const error of result.errors) console.error(`[toolchain] ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `[toolchain] Node ${versions.node} / pnpm ${versions.pnpm} / Go ${versions.go} 版本检查通过`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch {
    console.error(
      "[toolchain] 无法读取版本合同，请检查 .n-node-version、web/package.json 与 server/go.mod",
    );
    process.exitCode = 1;
  }
}
