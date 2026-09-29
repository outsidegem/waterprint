import test from "node:test";
import assert from "node:assert/strict";
import { estimateResources } from "../packages/core/src/estimator.js";
import { createEvent, canonicalizeEventData } from "../packages/core/src/event.js";

test("Privacy Regression: canary string NEVER appears in canonical data or event", async () => {
  const canary = "WATERPRINT_PRIVATE_CANARY_9F7A2C";
  const estimate = estimateResources({ workloadUnits: 1, energyWhPerUnit: 1, waterMlPerWh: 1 });
  
  // Try to sneak it in via an unknown property
  const maliciousInput = {
    timestamp: "2026-01-01T00:00:00.000Z",
    provider: "test",
    estimate,
    optimizationOffered: false,
    optimizationAccepted: false,
    prompt: canary,
    content: canary
  } as any;

  const event = await createEvent(maliciousInput);
  const eventStr = JSON.stringify(event);
  assert.equal(eventStr.includes(canary), false, "Canary leaked into serialized event");

  const canonicalData = canonicalizeEventData(event);
  assert.equal(canonicalData.includes(canary), false, "Canary leaked into canonical data");
});

test("Security: Rejects infinite, NaN, and negative resource bounds", () => {
  assert.throws(() => estimateResources({ workloadUnits: Infinity, energyWhPerUnit: 1, waterMlPerWh: 1 }), /finite/);
  assert.throws(() => estimateResources({ workloadUnits: Number.NaN, energyWhPerUnit: 1, waterMlPerWh: 1 }), /finite/);
  assert.throws(() => estimateResources({ workloadUnits: -1, energyWhPerUnit: 1, waterMlPerWh: 1 }), /out of bounds/);
  assert.throws(() => estimateResources({ workloadUnits: 1e13, energyWhPerUnit: 1, waterMlPerWh: 1 }), /out of bounds/);
});

test("Security: Rejects unsafe event inputs (prototype pollution, etc)", async () => {
  const estimate = estimateResources({ workloadUnits: 1, energyWhPerUnit: 1, waterMlPerWh: 1 });

  // null timestamp
  await assert.rejects(async () => {
    await createEvent({
      timestamp: null as any,
      provider: "test",
      estimate,
      optimizationOffered: false,
      optimizationAccepted: false
    });
  }, /Invalid timestamp/);

  // huge string
  await assert.rejects(async () => {
    await createEvent({
      timestamp: "2026-01-01T00:00:00.000Z",
      provider: "a".repeat(1000),
      estimate,
      optimizationOffered: false,
      optimizationAccepted: false
    });
  }, /Invalid provider/);
});

test("Fuzz-style determinism: Equivalent objects produce same canonical hash", async () => {
  const estimate = estimateResources({ workloadUnits: 10, energyWhPerUnit: 1, waterMlPerWh: 1 });
  
  const obj1 = {
    timestamp: "2026-01-01T00:00:00.000Z",
    provider: "test",
    model: "x",
    estimate,
    optimizationOffered: false,
    optimizationAccepted: false
  };

  const obj2 = {
    optimizationAccepted: false,
    optimizationOffered: false,
    estimate,
    model: "x",
    provider: "test",
    timestamp: "2026-01-01T00:00:00.000Z"
  };

  const e1 = await createEvent(obj1 as any);
  const e2 = await createEvent(obj2 as any);
  
  assert.equal(e1.eventId, e2.eventId, "Event ID is not independent of object key insertion order");
});
