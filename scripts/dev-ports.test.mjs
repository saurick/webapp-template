import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  allocateDerivedPortBundle,
  auditRootPortParity,
  auditSiblingPortConflicts,
  loadDevPorts,
} from "./dev-ports.mjs";

function writeManifest(rootDir, values) {
  fs.mkdirSync(path.join(rootDir, "config"), { recursive: true });
  fs.writeFileSync(
    path.join(rootDir, "config", "dev-ports.env"),
    [
      `DEV_PROJECT_ID=${values.projectId}`,
      `DEV_WEB_PORT=${values.webPort}`,
      `DEV_HTTP_PORT=${values.httpPort}`,
      `DEV_GRPC_PORT=${values.grpcPort}`,
      `DEV_STYLE_PORT=${values.stylePort}`,
      `DEV_AUX_PORT_START=${values.auxPortStart}`,
      "",
    ].join("\n"),
  );
}

function writeDevServerConfig(rootDir, httpPort, grpcPort) {
  const configDir = path.join(rootDir, "server", "configs", "dev");
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, "config.yaml"),
    [
      "server:",
      "  http:",
      `    addr: 0.0.0.0:${httpPort}`,
      "    timeout: 10s",
      "  grpc:",
      `    addr: 0.0.0.0:${grpcPort}`,
      "    timeout: 10s",
      "",
    ].join("\n"),
  );
}

test("loadDevPorts reads the manifest and accepts explicit environment overrides", () => {
  const parentDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-ports-load-"));
  const rootDir = path.join(parentDir, "project");
  try {
    writeManifest(rootDir, {
      projectId: "project",
      webPort: 5177,
      httpPort: 8200,
      grpcPort: 9200,
      stylePort: 6177,
      auxPortStart: 15400,
    });
    const ports = loadDevPorts({ rootDir, env: { DEV_WEB_PORT: "5179" } });
    assert.equal(ports.webPort, 5179);
    assert.equal(ports.httpPort, 8200);
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test("loadDevPorts rejects environment overrides inside the auxiliary block", () => {
  const parentDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dev-ports-override-conflict-"),
  );
  const rootDir = path.join(parentDir, "project");
  try {
    writeManifest(rootDir, {
      projectId: "project",
      webPort: 5177,
      httpPort: 8200,
      grpcPort: 9200,
      stylePort: 6177,
      auxPortStart: 15400,
    });
    assert.throws(
      () => loadDevPorts({ rootDir, env: { DEV_WEB_PORT: "15450" } }),
      /生效端口覆盖.*DEV_AUX_PORT_START.*DEV_WEB_PORT|生效端口覆盖.*DEV_WEB_PORT.*DEV_AUX_PORT_START/u,
    );
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test("loadDevPorts accepts an explicit web and style role swap", () => {
  const parentDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dev-ports-role-swap-"),
  );
  const rootDir = path.join(parentDir, "project");
  try {
    writeManifest(rootDir, {
      projectId: "project",
      webPort: 5177,
      httpPort: 8200,
      grpcPort: 9200,
      stylePort: 6177,
      auxPortStart: 15400,
    });
    const ports = loadDevPorts({
      rootDir,
      env: { DEV_WEB_PORT: "6177", DEV_STYLE_PORT: "5177" },
    });
    assert.equal(ports.webPort, 6177);
    assert.equal(ports.stylePort, 5177);
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test("allocateDerivedPortBundle skips sibling manifests and stays fixed on rerun", () => {
  const parentDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dev-ports-allocate-"),
  );
  const templateRoot = path.join(parentDir, "webapp-template");
  const projectRoot = path.join(parentDir, "new-project");
  try {
    const templatePorts = {
      projectId: "webapp-template",
      webPort: 5177,
      httpPort: 8200,
      grpcPort: 9200,
      stylePort: 6177,
      auxPortStart: 15400,
    };
    writeManifest(templateRoot, templatePorts);
    writeManifest(projectRoot, templatePorts);
    writeDevServerConfig(projectRoot, 8200, 9200);

    const allocated = allocateDerivedPortBundle(projectRoot, "new-project");
    assert.equal(allocated.allocated, true);
    assert.deepEqual(
      [
        allocated.webPort,
        allocated.httpPort,
        allocated.grpcPort,
        allocated.stylePort,
        allocated.auxPortStart,
      ],
      [5178, 8500, 9500, 6178, 15500],
    );
    const devConfig = fs.readFileSync(
      path.join(projectRoot, "server/configs/dev/config.yaml"),
      "utf8",
    );
    assert.match(devConfig, /addr: 0\.0\.0\.0:8500/u);
    assert.match(devConfig, /addr: 0\.0\.0\.0:9500/u);

    const rerun = allocateDerivedPortBundle(projectRoot, "new-project");
    assert.equal(rerun.allocated, false);
    assert.equal(rerun.webPort, 5178);
    assert.equal(auditSiblingPortConflicts(projectRoot).length, 2);
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test("auditRootPortParity rejects stale dev YAML and duplicated port docs", () => {
  const parentDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-ports-parity-"));
  const rootDir = path.join(parentDir, "project");
  try {
    writeManifest(rootDir, {
      projectId: "project",
      webPort: 5178,
      httpPort: 8500,
      grpcPort: 9500,
      stylePort: 6178,
      auxPortStart: 15500,
    });
    writeDevServerConfig(rootDir, 8200, 9200);
    assert.throws(() => auditRootPortParity(rootDir), /不一致/u);

    writeDevServerConfig(rootDir, 8500, 9500);
    fs.writeFileSync(
      path.join(rootDir, "README.md"),
      "Run the frontend on 5177.\n",
    );
    assert.throws(() => auditRootPortParity(rootDir), /正式端口文档必须引用/u);

    fs.writeFileSync(
      path.join(rootDir, "README.md"),
      "Run `node scripts/dev-ports.mjs show` and use `DEV_WEB_PORT`.\n",
    );
    assert.doesNotThrow(() => auditRootPortParity(rootDir));
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test("auditSiblingPortConflicts rejects duplicate listener ports", () => {
  const parentDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-ports-audit-"));
  try {
    writeManifest(path.join(parentDir, "first"), {
      projectId: "first",
      webPort: 5177,
      httpPort: 8200,
      grpcPort: 9200,
      stylePort: 6177,
      auxPortStart: 15400,
    });
    writeManifest(path.join(parentDir, "second"), {
      projectId: "second",
      webPort: 5177,
      httpPort: 8500,
      grpcPort: 9500,
      stylePort: 6178,
      auxPortStart: 15500,
    });
    assert.throws(
      () => auditSiblingPortConflicts(path.join(parentDir, "first")),
      /端口 5177/u,
    );
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test("auditSiblingPortConflicts reserves the full auxiliary block", () => {
  const parentDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dev-ports-aux-range-"),
  );
  try {
    writeManifest(path.join(parentDir, "first"), {
      projectId: "first",
      webPort: 5177,
      httpPort: 8200,
      grpcPort: 9200,
      stylePort: 6177,
      auxPortStart: 15400,
    });
    writeManifest(path.join(parentDir, "second"), {
      projectId: "second",
      webPort: 5178,
      httpPort: 8500,
      grpcPort: 9500,
      stylePort: 6178,
      auxPortStart: 15450,
    });
    assert.throws(
      () => auditSiblingPortConflicts(path.join(parentDir, "first")),
      /15400-15499.*15450-15549|15450-15549.*15400-15499/u,
    );
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test("auditSiblingPortConflicts checks extra listener ports against auxiliary blocks", () => {
  const parentDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dev-ports-extra-range-"),
  );
  try {
    writeManifest(path.join(parentDir, "first"), {
      projectId: "first",
      webPort: 5177,
      httpPort: 8200,
      grpcPort: 9200,
      stylePort: 6177,
      auxPortStart: 15400,
    });
    const secondRoot = path.join(parentDir, "second");
    fs.mkdirSync(path.join(secondRoot, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(secondRoot, "config", "dev-ports.env"),
      [
        "DEV_PROJECT_ID=second",
        "DEV_HTTP_PORT=8500",
        "DEV_ADMIN_HTTP_PORT=15420",
        "",
      ].join("\n"),
    );
    assert.throws(
      () => auditSiblingPortConflicts(path.join(parentDir, "first")),
      /15400-15499.*15420|15420.*15400-15499/u,
    );
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});

test("auditSiblingPortConflicts accepts a backend-only manifest", () => {
  const parentDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dev-ports-backend-"),
  );
  try {
    const rootDir = path.join(parentDir, "codex-history");
    fs.mkdirSync(path.join(rootDir, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(rootDir, "config", "dev-ports.env"),
      "DEV_PROJECT_ID=codex-history\nDEV_HTTP_PORT=8787\n",
    );
    assert.equal(auditSiblingPortConflicts(rootDir).length, 1);
  } finally {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
});
