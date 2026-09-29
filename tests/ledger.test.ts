import test from "node:test";
import assert from "node:assert/strict";
import { LocalLedger } from "../packages/core/src/ledger.js";
import { createEvent, WaterPrintEvent } from "../packages/core/src/event.js";
import { estimateResources } from "../packages/core/src/estimator.js";

test("Ledger appends events and calculates aggregates deterministically", async () => {
  const ledger = new LocalLedger();
  
  const estimate = estimateResources({ workloadUnits: 10, energyWhPerUnit: 1, waterMlPerWh: 1 });
  const event1 = await createEvent({
    timestamp: "2026-01-01T00:00:00.000Z",
    provider: "test-provider",
    estimate,
    optimizationOffered: false,
    optimizationAccepted: false
  });

  const appended = await ledger.appendAsync(event1);
  assert.equal(appended, true);
  assert.equal(ledger.getEvents().length, 1);

  const agg1 = ledger.aggregate();
  assert.equal(agg1.eventCount, 1);
  assert.equal(agg1.totalEnergyWh, 10);
  assert.equal(agg1.totalWaterMl, 10);

  // Duplicate replay
  const appendedDuplicate = await ledger.appendAsync(event1);
  assert.equal(appendedDuplicate, false);
  assert.equal(ledger.getEvents().length, 1);

  // Second event
  const event2 = await createEvent({
    timestamp: "2026-01-02T00:00:00.000Z",
    provider: "test-provider",
    estimate: estimateResources({ workloadUnits: 20, energyWhPerUnit: 1, waterMlPerWh: 1 }),
    optimizationOffered: true,
    optimizationAccepted: true
  });
  
  await ledger.appendAsync(event2);
  
  const agg2 = ledger.aggregate();
  assert.equal(agg2.eventCount, 2);
  assert.equal(agg2.totalEnergyWh, 30);
  assert.equal(agg2.totalWaterMl, 30);
  assert.equal(agg2.optimizedEventsCount, 1);
  assert.equal(agg2.byProvider["test-provider"]!.energyWh, 30);
});

test("Ledger detects forged events", async () => {
  const ledger = new LocalLedger();
  const event = await createEvent({
    timestamp: "2026-01-01T00:00:00.000Z",
    provider: "test",
    estimate: estimateResources({ workloadUnits: 1, energyWhPerUnit: 1, waterMlPerWh: 1 }),
    optimizationOffered: false,
    optimizationAccepted: false
  });

  // Modify event without updating ID
  const forgedEvent = JSON.parse(JSON.stringify(event));
  forgedEvent.provider = "hacked";

  await assert.rejects(async () => {
    await ledger.appendAsync(forgedEvent);
  }, /corruption/i);
});

test("Ledger rejects events with raw prompt content", async () => {
  const ledger = new LocalLedger();
  const event = await createEvent({
    timestamp: "2026-01-01T00:00:00.000Z",
    provider: "test",
    estimate: estimateResources({ workloadUnits: 1, energyWhPerUnit: 1, waterMlPerWh: 1 }),
    optimizationOffered: false,
    optimizationAccepted: false
  });

  const modified = { ...event, prompt: "secret" } as WaterPrintEvent;
  // wait we need to re-hash it to bypass the corruption check so it fails the privacy check
  // But wait, the privacy check is BEFORE the hash check?
  // Let's check ledger.ts: it does Integrity check THEN privacy check.
  // Actually, we can just test if the privacy check works by forging the hash correctly.
  const { canonicalizeEventData } = await import("../packages/core/src/event.js");
  const canonicalStr = canonicalizeEventData(modified);
  const encoder = new TextEncoder();
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", encoder.encode(canonicalStr));
  modified.eventId = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

  await assert.rejects(async () => {
    await ledger.appendAsync(modified);
  }, /Privacy violation/);
});

test("Aggregation does not add estimated_avoided to total consumption", async () => {
  const ledger = new LocalLedger();
  
  const avoidedEstimate = estimateResources({ 
    workloadUnits: 50, 
    energyWhPerUnit: 1, 
    waterMlPerWh: 1,
    measurementType: "estimated_avoided"
  });

  const event1 = await createEvent({
    timestamp: "2026-01-01T00:00:00.000Z",
    provider: "test-provider",
    estimate: avoidedEstimate,
    optimizationOffered: false,
    optimizationAccepted: false
  });

  await ledger.appendAsync(event1);
  const agg = ledger.aggregate();
  
  assert.equal(agg.totalEnergyWh, 0); // Not added to consumed totals!
  assert.equal(agg.estimatedAvoidedTotals.energyWh, 50);
});
