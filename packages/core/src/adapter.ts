import { WaterPrintEvent, createEvent } from "./event.js";
import { estimateResources, EstimationInput } from "./estimator.js";

export interface ProviderTelemetry {
  providerName?: string;
  modelName?: string;
  inputTokens?: number;
  outputTokens?: number;
  // Other potential raw telemetry
}

export interface AdapterConfig {
  defaultEnergyWhPerToken: number;
  defaultWaterMlPerWh: number;
  methodologyVersion: string;
}

export abstract class BaseProviderAdapter {
  constructor(protected config: AdapterConfig) {}

  /**
   * Safely normalizes hostile/untrusted provider telemetry into validated internal inputs.
   * Rejects malformed data, provides safe defaults for unknown data.
   */
  public normalizeTelemetry(raw: unknown): ProviderTelemetry {
    if (!raw || typeof raw !== "object") {
      return {};
    }

    const t = raw as Record<string, unknown>;
    
    // Safely extract and sanitize strings
    const providerName = typeof t.providerName === "string" ? t.providerName.substring(0, 100) : undefined;
    const modelName = typeof t.modelName === "string" ? t.modelName.substring(0, 100) : undefined;
    
    // Safely extract and sanitize numbers
    const inputTokens = typeof t.inputTokens === "number" && Number.isInteger(t.inputTokens) && t.inputTokens >= 0 ? t.inputTokens : undefined;
    const outputTokens = typeof t.outputTokens === "number" && Number.isInteger(t.outputTokens) && t.outputTokens >= 0 ? t.outputTokens : undefined;

    const result: ProviderTelemetry = {};
    if (providerName !== undefined) result.providerName = providerName;
    if (modelName !== undefined) result.modelName = modelName;
    if (inputTokens !== undefined) result.inputTokens = inputTokens;
    if (outputTokens !== undefined) result.outputTokens = outputTokens;
    return result;
  }

  /**
   * Convert normalized telemetry into a standard WaterPrintEvent.
   */
  public async createEventFromTelemetry(telemetry: ProviderTelemetry, timestamp: string = new Date().toISOString()): Promise<WaterPrintEvent> {
    const totalTokens = (telemetry.inputTokens ?? 0) + (telemetry.outputTokens ?? 0);
    
    // If no tokens are known, we might estimate based on an average request or record 0 
    // depending on the methodology. We will use totalTokens here.
    const estInput: EstimationInput = {
      workloadUnits: totalTokens,
      energyWhPerUnit: this.config.defaultEnergyWhPerToken,
      waterMlPerWh: this.config.defaultWaterMlPerWh,
      methodologyVersion: this.config.defaultEnergyWhPerToken === 0 ? "fallback-unknown" : this.config.methodologyVersion,
      measurementType: "estimated",
      provenance: telemetry.providerName ?? "unknown_provider"
    };

    const estimate = estimateResources(estInput);

    const eventInput: Omit<WaterPrintEvent, "schemaVersion" | "eventId" | "promptContentStored"> = {
      timestamp,
      provider: telemetry.providerName ?? "unknown",
      estimate,
      optimizationOffered: false,
      optimizationAccepted: false
    };
    if (telemetry.modelName !== undefined) eventInput.model = telemetry.modelName;
    if (telemetry.inputTokens !== undefined) eventInput.inputTokens = telemetry.inputTokens;
    if (telemetry.outputTokens !== undefined) eventInput.outputTokens = telemetry.outputTokens;
    
    return createEvent(eventInput);
  }
}
