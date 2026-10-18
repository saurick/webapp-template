import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("一键创建覆盖幂等、归属、推送、CI 失败、漂移与凭据边界", () => {
  const result = spawnSync(
    "python3",
    ["-B", path.join(import.meta.dirname, "create_project_test.py")],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
