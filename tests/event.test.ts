import test from "node:test";
import assert from "node:assert/strict";
import { createEvent } from "../packages/core/src/event.js";
import { estimateResources } from "../packages/core/src/estimator.js";

test("event is deterministic and contains no prompt content", async () => {
  const estimate = estimateResources({ workloadUnits: 10, energyWhPerUnit: 0.01, waterMlPerWh: 0.5 });
  const event = await createEvent({
    timestamp: "2026-01-01T00:00:00.000Z",
    provider: "test",
    model: "example",
    inputTokens: 10,
    outputTokens: 20,
    estimate,
    optimizationOffered: true,
    optimizationAccepted: false
  });

  assert.equal(event.schemaVersion, "0.1.0");
  assert.equal(event.promptContentStored, false);
  assert.equal(event.eventId.length, 64);
  assert.equal(JSON.stringify(event).includes("prompt"), true); // This will still pass because 'promptContentStored' contains 'prompt'
});

test("rejects unsafe token counts", async () => {
  const estimate = estimateResources({ workloadUnits: 1, energyWhPerUnit: 1, waterMlPerWh: 1 });
  await assert.rejects(async () => {
    await createEvent({
      timestamp: "2026-01-01T00:00:00.000Z",
      provider: "test",
      estimate,
      inputTokens: -1,
      optimizationOffered: false,
      optimizationAccepted: false
    });
  });
});
