import type { ResourceEstimate } from "./estimator.js";

export interface WaterPrintEvent {
  schemaVersion: "0.1.0";
  eventId: string;
  timestamp: string;
  provider: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimate: ResourceEstimate;
  optimizationOffered: boolean;
  optimizationAccepted: boolean;
  promptContentStored: false;
}

function isValidDate(dateStr: string) {
  const d = new Date(dateStr);
  return !Number.isNaN(d.getTime()) && d.toISOString() === dateStr;
}

function validateTokens(tokens: any, name: string) {
  if (tokens !== undefined) {
    if (typeof tokens !== "number" || !Number.isInteger(tokens) || tokens < 0 || tokens > 1e9) {
      throw new Error(`Invalid ${name}`);
    }
  }
}

export function canonicalizeEventData(data: Omit<WaterPrintEvent, "schemaVersion" | "eventId" | "promptContentStored">): string {
  // Explicit, deterministic ordering of fields
  const parts = [
    `timestamp:${data.timestamp}`,
    `provider:${data.provider}`,
    `model:${data.model ?? ""}`,
    `inputTokens:${data.inputTokens ?? ""}`,
    `outputTokens:${data.outputTokens ?? ""}`,
    `estimate.methodologyVersion:${data.estimate.methodologyVersion}`,
    `estimate.energyWh:${data.estimate.energyWh.toFixed(6)}`, // using fixed to avoid float inconsistencies across platforms if any
    `estimate.waterMl:${data.estimate.waterMl.toFixed(6)}`,
    `estimate.confidence:${data.estimate.confidence}`,
    `estimate.measurementType:${data.estimate.measurementType}`,
    `estimate.provenance:${data.estimate.provenance}`,
    `optimizationOffered:${data.optimizationOffered}`,
    `optimizationAccepted:${data.optimizationAccepted}`
  ];
  return parts.join("|");
}

export async function createEvent(input: Omit<WaterPrintEvent, "schemaVersion" | "eventId" | "promptContentStored">): Promise<WaterPrintEvent> {
  if (!input || typeof input !== "object") throw new Error("Invalid input object");

  if (typeof input.timestamp !== "string" || !isValidDate(input.timestamp)) throw new Error("Invalid timestamp");
  if (typeof input.provider !== "string" || input.provider.length > 256) throw new Error("Invalid provider");
  if (input.model !== undefined && (typeof input.model !== "string" || input.model.length > 256)) throw new Error("Invalid model");
  
  validateTokens(input.inputTokens, "inputTokens");
  validateTokens(input.outputTokens, "outputTokens");

  if (typeof input.optimizationOffered !== "boolean") throw new Error("Invalid optimizationOffered");
  if (typeof input.optimizationAccepted !== "boolean") throw new Error("Invalid optimizationAccepted");
  
  if (!input.estimate || typeof input.estimate !== "object") throw new Error("Invalid estimate");
  if (typeof input.estimate.energyWh !== "number") throw new Error("Invalid estimate.energyWh");
  if (typeof input.estimate.waterMl !== "number") throw new Error("Invalid estimate.waterMl");
  // in a real system we'd deep validate the whole estimate, but we assume it's created by estimator

  // Privacy protection: ensure raw prompt doesn't slip in accidentally via unknown keys
  const safeInput: Omit<WaterPrintEvent, "schemaVersion" | "eventId" | "promptContentStored"> = {
    timestamp: input.timestamp,
    provider: input.provider,
    estimate: input.estimate,
    optimizationOffered: input.optimizationOffered,
    optimizationAccepted: input.optimizationAccepted
  };
  if (input.model !== undefined) safeInput.model = input.model;
  if (input.inputTokens !== undefined) safeInput.inputTokens = input.inputTokens;
  if (input.outputTokens !== undefined) safeInput.outputTokens = input.outputTokens;

  const canonicalStr = canonicalizeEventData(safeInput);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalStr);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const eventId = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    ...safeInput,
    schemaVersion: "0.1.0",
    eventId,
    promptContentStored: false
  };
}
