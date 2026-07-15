import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const MANIFEST_PATH = path.join("config", "dev-ports.env");
const DEV_SERVER_CONFIG_PATH = path.join(
  "server",
  "configs",
  "dev",
  "config.yaml",
);
const AUX_PORT_RANGE_SIZE = 100;
const PORT_DOC_PATHS = [
  "README.md",
  "docs/current-source-of-truth.md",
  "docs/project-init.md",
  "scripts/README.md",
  "scripts/loadtest/README.md",
  "web/README.md",
  "server/README.md",
  "server/docs/config.md",
  "server/docs/runtime.md",
];
const TEMPLATE_PORT_LITERALS = [
  5177, 6177, 8200, 9200, 15400, 15480, 15490, 15499,
];
const PORT_FIELDS = [
  ["DEV_WEB_PORT", "webPort"],
  ["DEV_HTTP_PORT", "httpPort"],
  ["DEV_GRPC_PORT", "grpcPort"],
  ["DEV_STYLE_PORT", "stylePort"],
  ["DEV_AUX_PORT_START", "auxPortStart"],
];

function parseManifest(content, manifestPath) {
  const values = {};
  for (const [index, rawLine] of content.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u);
    if (!match) {
      throw new Error(`${manifestPath}:${index + 1} 不是 KEY=value 格式`);
    }
    const [, key, value] = match;
    if (Object.hasOwn(values, key)) {
      throw new Error(`${manifestPath}:${index + 1} 重复定义 ${key}`);
    }
    values[key] = value.trim();
  }
  return values;
}

function validatePort(rawValue, key, manifestPath) {
  if (!/^\d+$/u.test(String(rawValue || ""))) {
    throw new Error(`${manifestPath} 的 ${key} 必须是数字端口`);
  }
  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 1024 || value > 65535) {
    throw new Error(`${manifestPath} 的 ${key} 必须在 1024..65535`);
  }
  return value;
}

function toReservation(key, value, manifestPath) {
  const end =
    key === "DEV_AUX_PORT_START" ? value + AUX_PORT_RANGE_SIZE - 1 : value;
  if (end > 65535) {
    throw new Error(
      `${manifestPath} 的 ${key} 必须为 ${AUX_PORT_RANGE_SIZE} 端口区间预留完整空间`,
    );
  }
  return { key, value, start: value, end };
}

function reservationsOverlap(left, right) {
  return left.start <= right.end && right.start <= left.end;
}

function describeReservation(reservation) {
  return reservation.start === reservation.end
    ? `端口 ${reservation.start}`
    : `端口范围 ${reservation.start}-${reservation.end}`;
}

function assertNoReservationConflicts(reservations, manifestPath) {
  for (let index = 0; index < reservations.length; index += 1) {
    for (let compared = 0; compared < index; compared += 1) {
      if (reservationsOverlap(reservations[index], reservations[compared])) {
        throw new Error(
          `${manifestPath} 的 ${reservations[index].key} (${describeReservation(reservations[index])}) 与 ${reservations[compared].key} (${describeReservation(reservations[compared])}) 重叠`,
        );
      }
    }
  }
}

function prepareDevServerConfig(rootDir, bundle) {
  const configPath = path.join(rootDir, DEV_SERVER_CONFIG_PATH);
  if (!fs.existsSync(configPath)) {
    throw new Error(`${configPath} 不存在，无法同步直接启动的 dev 端口`);
  }

  const original = fs.readFileSync(configPath, "utf8");
  const lines = original.split(/\r?\n/u);
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const found = new Map();
  let topLevel = "";
  let serverSection = "";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const topLevelMatch = line.match(/^([a-zA-Z0-9_-]+):(?:\s|$)/u);
    if (topLevelMatch) {
      topLevel = topLevelMatch[1];
      serverSection = "";
      continue;
    }
    if (topLevel !== "server") continue;

    const sectionMatch = line.match(/^ {2}([a-zA-Z0-9_-]+):(?:\s|$)/u);
    if (sectionMatch) {
      serverSection = sectionMatch[1];
      continue;
    }
    if (serverSection !== "http" && serverSection !== "grpc") continue;

    const addressMatch = line.match(/^( {4}addr:\s*)(\S+)(.*)$/u);
    if (!addressMatch) continue;
    if (found.has(serverSection)) {
      throw new Error(`${configPath} 重复定义 server.${serverSection}.addr`);
    }
    const currentPortMatch = addressMatch[2].match(/:(\d+)$/u);
    if (!currentPortMatch) {
      throw new Error(
        `${configPath} 的 server.${serverSection}.addr 不是 host:port`,
      );
    }
    const expectedPort =
      serverSection === "http" ? bundle.httpPort : bundle.grpcPort;
    const nextAddress = addressMatch[2].replace(/:\d+$/u, `:${expectedPort}`);
    lines[index] = `${addressMatch[1]}${nextAddress}${addressMatch[3]}`;
    found.set(serverSection, Number(currentPortMatch[1]));
  }

  for (const section of ["http", "grpc"]) {
    if (!found.has(section)) {
      throw new Error(`${configPath} 缺少 server.${section}.addr`);
    }
  }

  return {
    configPath,
    original,
    content: lines.join(newline),
    ports: { http: found.get("http"), grpc: found.get("grpc") },
  };
}

function assertPortDocsUseManifest(rootDir, bundle) {
  const forbiddenPorts = new Set([
    ...TEMPLATE_PORT_LITERALS,
    bundle.webPort,
    bundle.httpPort,
    bundle.grpcPort,
    bundle.stylePort,
    bundle.auxPortStart,
    bundle.auxPortStart + 80,
    bundle.auxPortStart + 90,
    bundle.auxPortStart + AUX_PORT_RANGE_SIZE - 1,
  ]);
  const hits = [];
  for (const relativePath of PORT_DOC_PATHS) {
    const documentPath = path.join(rootDir, relativePath);
    if (!fs.existsSync(documentPath)) continue;
    const lines = fs.readFileSync(documentPath, "utf8").split(/\r?\n/u);
    for (const [index, line] of lines.entries()) {
      for (const port of forbiddenPorts) {
        const pattern = new RegExp(`(^|\\D)${port}(?=\\D|$)`, "u");
        if (pattern.test(line)) {
          hits.push(`${relativePath}:${index + 1}: ${port}`);
        }
      }
    }
  }
  if (hits.length > 0) {
    throw new Error(
      `正式端口文档必须引用 config/dev-ports.env 或 dev-ports show，不得复制数字：\n- ${hits.join("\n- ")}`,
    );
  }
}

export function auditRootPortParity(rootDir) {
  const resolvedRoot = path.resolve(rootDir);
  const bundle = loadDevPorts({
    rootDir: resolvedRoot,
    env: {},
    allowEnvironmentOverrides: false,
  });
  const prepared = prepareDevServerConfig(resolvedRoot, bundle);
  if (
    prepared.ports.http !== bundle.httpPort ||
    prepared.ports.grpc !== bundle.grpcPort
  ) {
    throw new Error(
      `${prepared.configPath} 与 config/dev-ports.env 不一致：HTTP ${prepared.ports.http}/${bundle.httpPort}，gRPC ${prepared.ports.grpc}/${bundle.grpcPort}`,
    );
  }
  assertPortDocsUseManifest(resolvedRoot, bundle);
  return bundle;
}

export function loadDevPorts({
  rootDir = path.resolve(import.meta.dirname, ".."),
  env = process.env,
  allowEnvironmentOverrides = true,
} = {}) {
  const manifestPath = path.resolve(rootDir, MANIFEST_PATH);
  const manifest = parseManifest(
    fs.readFileSync(manifestPath, "utf8"),
    manifestPath,
  );
  const projectId = String(
    (allowEnvironmentOverrides && env.DEV_PROJECT_ID) ||
      manifest.DEV_PROJECT_ID ||
      "",
  ).trim();
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(projectId)) {
    throw new Error(`${manifestPath} 的 DEV_PROJECT_ID 格式无效`);
  }

  const result = { rootDir: path.resolve(rootDir), manifestPath, projectId };
  const defaultReservations = [];
  const effectiveReservations = [];
  for (const [key, property] of PORT_FIELDS) {
    const defaultValue = validatePort(manifest[key], key, manifestPath);
    defaultReservations.push(toReservation(key, defaultValue, manifestPath));
    const rawValue =
      (allowEnvironmentOverrides && env[key] !== undefined
        ? env[key]
        : undefined) ?? manifest[key];
    const value = validatePort(rawValue, key, manifestPath);
    effectiveReservations.push(toReservation(key, value, manifestPath));
    result[property] = value;
  }
  assertNoReservationConflicts(defaultReservations, manifestPath);
  assertNoReservationConflicts(
    effectiveReservations,
    `${manifestPath} 的生效端口覆盖`,
  );
  return result;
}

function findSiblingManifests(rootDir) {
  const parentDir = path.dirname(path.resolve(rootDir));
  const manifests = [];
  for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const siblingRoot = path.join(parentDir, entry.name);
    const manifestPath = path.join(siblingRoot, MANIFEST_PATH);
    if (!fs.existsSync(manifestPath)) continue;
    const values = parseManifest(
      fs.readFileSync(manifestPath, "utf8"),
      manifestPath,
    );
    const projectId = String(values.DEV_PROJECT_ID || "").trim();
    if (!/^[a-z0-9][a-z0-9._-]*$/u.test(projectId)) {
      throw new Error(`${manifestPath} 的 DEV_PROJECT_ID 格式无效`);
    }
    const ports = Object.entries(values)
      .filter(([key]) => /^DEV_[A-Z0-9_]*PORT(?:_START)?$/u.test(key))
      .map(([key, rawValue]) =>
        toReservation(
          key,
          validatePort(rawValue, key, manifestPath),
          manifestPath,
        ),
      );
    if (ports.length === 0) {
      throw new Error(`${manifestPath} 未声明任何 DEV_*_PORT`);
    }
    assertNoReservationConflicts(ports, manifestPath);
    manifests.push({ rootDir: siblingRoot, manifestPath, projectId, ports });
  }
  return manifests.sort((left, right) =>
    left.rootDir.localeCompare(right.rootDir),
  );
}

export function auditSiblingPortConflicts(rootDir) {
  const manifests = findSiblingManifests(rootDir);
  const reservations = [];
  const projectOwners = new Map();
  const conflicts = [];

  for (const manifest of manifests) {
    const existingProject = projectOwners.get(manifest.projectId);
    if (existingProject && existingProject.rootDir !== manifest.rootDir) {
      conflicts.push(
        `项目标识 ${manifest.projectId} 同时出现在 ${existingProject.rootDir} 与 ${manifest.rootDir}`,
      );
    } else {
      projectOwners.set(manifest.projectId, manifest);
    }

    for (const port of manifest.ports) {
      for (const existing of reservations) {
        if (reservationsOverlap(port, existing)) {
          conflicts.push(
            `${describeReservation(port)} (${manifest.projectId}/${port.key}) 与 ${describeReservation(existing)} (${existing.projectId}/${existing.key}) 重叠`,
          );
        }
      }
      reservations.push({ ...port, projectId: manifest.projectId });
    }
  }

  if (conflicts.length > 0) {
    throw new Error(`发现开发端口冲突：\n- ${conflicts.join("\n- ")}`);
  }
  return manifests;
}

function serializeManifest(bundle) {
  return [
    `DEV_PROJECT_ID=${bundle.projectId}`,
    `DEV_WEB_PORT=${bundle.webPort}`,
    `DEV_HTTP_PORT=${bundle.httpPort}`,
    `DEV_GRPC_PORT=${bundle.grpcPort}`,
    `DEV_STYLE_PORT=${bundle.stylePort}`,
    `DEV_AUX_PORT_START=${bundle.auxPortStart}`,
    "",
  ].join("\n");
}

export function allocateDerivedPortBundle(rootDir, projectId) {
  const normalizedProjectId = String(projectId || "").trim();
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(normalizedProjectId)) {
    throw new Error("--project-id 必须使用小写字母、数字、点、下划线或连字符");
  }

  const resolvedRoot = path.resolve(rootDir);
  const manifestPath = path.join(resolvedRoot, MANIFEST_PATH);
  if (fs.existsSync(manifestPath)) {
    const current = loadDevPorts({
      rootDir: resolvedRoot,
      env: {},
      allowEnvironmentOverrides: false,
    });
    if (current.projectId !== "webapp-template") {
      if (current.projectId !== normalizedProjectId) {
        throw new Error(
          `当前 manifest 已属于 ${current.projectId}，拒绝自动改成 ${normalizedProjectId}`,
        );
      }
      const prepared = prepareDevServerConfig(resolvedRoot, current);
      if (prepared.content !== prepared.original) {
        fs.writeFileSync(prepared.configPath, prepared.content, "utf8");
      }
      auditSiblingPortConflicts(resolvedRoot);
      auditRootPortParity(resolvedRoot);
      return { ...current, allocated: false };
    }
  }

  const siblings = findSiblingManifests(resolvedRoot).filter(
    (manifest) => manifest.rootDir !== resolvedRoot,
  );
  const occupied = [];
  const siblingProjectIds = new Set();
  for (const manifest of siblings) {
    if (siblingProjectIds.has(manifest.projectId)) {
      throw new Error(`兄弟仓重复使用 DEV_PROJECT_ID=${manifest.projectId}`);
    }
    siblingProjectIds.add(manifest.projectId);
    for (const port of manifest.ports) {
      const existing = occupied.find((candidate) =>
        reservationsOverlap(candidate, port),
      );
      if (existing) {
        throw new Error(
          `兄弟仓 ${describeReservation(port)} (${manifest.projectId}/${port.key}) 与 ${describeReservation(existing)} (${existing.projectId}/${existing.key}) 重叠`,
        );
      }
      occupied.push({ ...port, projectId: manifest.projectId });
    }
  }
  if (siblingProjectIds.has(normalizedProjectId)) {
    throw new Error(`兄弟仓已使用 DEV_PROJECT_ID=${normalizedProjectId}`);
  }

  let bundle;
  for (let slot = 0; slot < 500; slot += 1) {
    const candidate = {
      projectId: normalizedProjectId,
      webPort: 5178 + slot,
      httpPort: 8500 + slot * 100,
      grpcPort: 9500 + slot * 100,
      stylePort: 6178 + slot,
      auxPortStart: 15500 + slot * AUX_PORT_RANGE_SIZE,
    };
    const ports = PORT_FIELDS.map(([key, property]) =>
      toReservation(key, candidate[property], "candidate bundle"),
    );
    assertNoReservationConflicts(ports, "candidate bundle");
    if (
      ports.every((port) =>
        occupied.every((existing) => !reservationsOverlap(port, existing)),
      )
    ) {
      bundle = candidate;
      break;
    }
  }
  if (!bundle) throw new Error("没有可分配的固定开发端口 bundle");

  const prepared = prepareDevServerConfig(resolvedRoot, bundle);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, serializeManifest(bundle), "utf8");
  if (prepared.content !== prepared.original) {
    fs.writeFileSync(prepared.configPath, prepared.content, "utf8");
  }
  auditSiblingPortConflicts(resolvedRoot);
  auditRootPortParity(resolvedRoot);
  return { ...bundle, rootDir: resolvedRoot, manifestPath, allocated: true };
}

function parseCliArgs(argv) {
  const [command = "show", ...rest] = argv;
  const options = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--root" || arg === "--project-id") {
      const value = rest[index + 1];
      if (!value) throw new Error(`${arg} 缺少值`);
      options[arg.slice(2).replace("-id", "Id")] = value;
      index += 1;
      continue;
    }
    throw new Error(`不支持的参数: ${arg}`);
  }
  options.root = path.resolve(
    options.root || path.resolve(import.meta.dirname, ".."),
  );
  return options;
}

function printBundle(bundle, prefix) {
  console.log(
    `${prefix}: ${bundle.projectId} web=${bundle.webPort} http=${bundle.httpPort} grpc=${bundle.grpcPort} style=${bundle.stylePort} aux=${bundle.auxPortStart}-${bundle.auxPortStart + AUX_PORT_RANGE_SIZE - 1}`,
  );
}

function main(argv) {
  const options = parseCliArgs(argv);
  if (options.command === "show") {
    printBundle(
      loadDevPorts({ rootDir: options.root }),
      "[dev-ports] 当前固定端口",
    );
    return;
  }
  if (options.command === "audit") {
    const manifests = auditSiblingPortConflicts(options.root);
    auditRootPortParity(options.root);
    console.log(
      `[dev-ports] 端口真源与兄弟仓审计通过，共检查 ${manifests.length} 个 manifest`,
    );
    return;
  }
  if (options.command === "allocate") {
    const bundle = allocateDerivedPortBundle(options.root, options.projectId);
    printBundle(
      bundle,
      bundle.allocated
        ? "[dev-ports] 已分配固定端口"
        : "[dev-ports] 保留现有固定端口",
    );
    return;
  }
  throw new Error(`不支持的命令: ${options.command}`);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`[dev-ports] ${error.message}`);
    process.exitCode = 1;
  }
}
