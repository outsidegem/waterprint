import test from "node:test";
import assert from "node:assert/strict";
import { estimateResources } from "../packages/core/src/estimator.js";

test("estimation is deterministic", () => {
  const a = estimateResources({ workloadUnits: 100, energyWhPerUnit: 0.01, waterMlPerWh: 0.5 });
  const b = estimateResources({ workloadUnits: 100, energyWhPerUnit: 0.01, waterMlPerWh: 0.5 });
  assert.deepEqual(a, b);
  assert.equal(a.energyWh, 1);
  assert.equal(a.waterMl, 0.5);
});

test("rejects NaN, negative and extreme values", () => {
  assert.throws(() => estimateResources({ workloadUnits: -1, energyWhPerUnit: 1, waterMlPerWh: 1 }));
  assert.throws(() => estimateResources({ workloadUnits: Number.NaN, energyWhPerUnit: 1, waterMlPerWh: 1 }));
  assert.throws(() => estimateResources({ workloadUnits: 1e13, energyWhPerUnit: 1, waterMlPerWh: 1 }));
});

test("rejects invalid uncertainty", () => {
  assert.throws(() => estimateResources({ workloadUnits: 1, energyWhPerUnit: 1, waterMlPerWh: 1, uncertaintyFraction: 2 }));
});
