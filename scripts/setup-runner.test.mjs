import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("Runner 初始化、重复执行、失败恢复、权限边界与脱敏回归", () => {
  const script = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "ci/setup_runner_test.py",
  );
  const result = spawnSync("python3", ["-B", script], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
