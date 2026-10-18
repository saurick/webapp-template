import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("镜像重试覆盖网络恢复、次数上限、真实构建阻断、脱敏和取消", () => {
  const result = spawnSync(
    "python3",
    ["-B", path.join(import.meta.dirname, "build_image_test.py")],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
