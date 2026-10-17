import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "loadtest-runner-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const directory of ["scripts/loadtest", "config", "tools"])
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.copyFileSync(
    path.join(import.meta.dirname, "loadtest/run.sh"),
    path.join(root, "scripts/loadtest/run.sh"),
  );
  fs.writeFileSync(
    path.join(root, "config/dev-ports.env"),
    "DEV_HTTP_PORT=8200\nDEV_AUX_PORT_START=15400\n",
  );
  fs.writeFileSync(path.join(root, "scripts/loadtest/health.js"), "");
  fs.writeFileSync(
    path.join(root, "tools/k6"),
    `#!/usr/bin/env bash
set -euo pipefail
printf 'called' > "$FAKE_K6_CALLED"
while [[ $# -gt 0 ]]; do
  if [[ "$1" == '--summary-export' ]]; then
    shift
    printf '{}' > "$1"
  fi
  shift
done
printf '<html></html>' > "$K6_WEB_DASHBOARD_EXPORT"
`,
    { mode: 0o755 },
  );
  return {
    root,
    run: (runId) =>
      spawnSync("bash", ["scripts/loadtest/run.sh", "health"], {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${path.join(root, "tools")}${path.delimiter}${process.env.PATH}`,
          BASE_URL: "http://127.0.0.1:8200",
          LOADTEST_RUN_ID: runId,
          LOADTEST_PROMETHEUS_RW_URL: "",
          K6_WEB_DASHBOARD: "false",
          K6_WEB_DASHBOARD_EXPORT: "",
          FAKE_K6_CALLED: path.join(root, "k6-called"),
        },
      }),
  };
}

test("压测入口在独立 output 目录产出报告，不依赖旧部署目录", (t) => {
  const { root, run } = fixture(t);
  const result = run("baseline-run_1.2");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const output = path.join(root, "output/loadtest/baseline-run_1.2");
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(output, "summary.json"))),
    {},
  );
  assert.ok(fs.existsSync(path.join(output, "report.html")));
  assert.match(
    fs.readFileSync(path.join(output, "meta.env"), "utf8"),
    /LOADTEST_ENGINE=k6/u,
  );
  assert.ok(!fs.existsSync(path.join(root, "server")));
});

test("压测批次拒绝目录逃逸，失败前不调用引擎或创建结果", (t) => {
  const { root, run } = fixture(t);
  for (const runId of [
    "../escape",
    "nested/run",
    ".",
    "run\nnext",
    "x".repeat(129),
  ]) {
    const result = run(runId);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /LOADTEST_RUN_ID/u);
    assert.ok(!fs.existsSync(path.join(root, "k6-called")));
    assert.ok(!fs.existsSync(path.join(root, "output")));
  }
});
