import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("Mac 入口覆盖授权、SSH、接收清理、源码归属与主机工具幂等", () => {
  const result = spawnSync("python3", ["-B", path.join(import.meta.dirname, "remote_project_test.py")], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
