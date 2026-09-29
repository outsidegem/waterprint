import test from "node:test";
import assert from "node:assert/strict";
import { suggestOptimization } from "../packages/core/src/optimizer.js";

test("does not over-optimize tiny requests", () => {
  assert.equal(suggestOptimization(100, 100).offered, false);
});

test("suggests tighter scope for larger interactions", () => {
  assert.equal(suggestOptimization(1000, 1000).offered, true);
});
