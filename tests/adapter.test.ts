import test from "node:test";
import assert from "node:assert/strict";
import { BaseProviderAdapter, ProviderTelemetry } from "../packages/core/src/adapter.js";

class TestAdapter extends BaseProviderAdapter {}

test("Adapter safely normalizes hostile telemetry", () => {
  const adapter = new TestAdapter({ defaultEnergyWhPerToken: 0.1, defaultWaterMlPerWh: 0.5, methodologyVersion: "test" });
  
  const hostile = {
    providerName: 123, // wrong type
    modelName: "a".repeat(1000), // huge string
    inputTokens: -50, // negative
    outputTokens: Infinity, // non-integer/infinite
    __proto__: { hacked: true } // prototype pollution attempt
  };

  const normalized = adapter.normalizeTelemetry(hostile);
  
  assert.equal(normalized.providerName, undefined);
  assert.equal(normalized.modelName?.length, 100); // truncated
  assert.equal(normalized.inputTokens, undefined);
  assert.equal(normalized.outputTokens, undefined);
});

test("Adapter converts normalized telemetry to valid Event", async () => {
  const adapter = new TestAdapter({ defaultEnergyWhPerToken: 0.1, defaultWaterMlPerWh: 0.5, methodologyVersion: "test" });
  
  const telemetry: ProviderTelemetry = {
    providerName: "gemini",
    modelName: "gemini-pro",
    inputTokens: 100,
    outputTokens: 50
  };

  const event = await adapter.createEventFromTelemetry(telemetry, "2026-01-01T00:00:00.000Z");
  assert.equal(event.provider, "gemini");
  assert.equal(event.estimate.energyWh, 15); // 150 tokens * 0.1
  assert.equal(event.estimate.methodologyVersion, "test");
});
