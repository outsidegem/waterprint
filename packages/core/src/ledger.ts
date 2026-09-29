import { WaterPrintEvent, canonicalizeEventData } from "./event.js";
import { ResourceEstimate, MeasurementType } from "./estimator.js";

export interface LedgerAggregate {
  eventCount: number;
  totalEnergyWh: number;
  totalWaterMl: number;
  totalEnergyRangeWh: { lower: number; upper: number };
  totalWaterRangeMl: { lower: number; upper: number };
  byMeasurementType: Record<MeasurementType, { energyWh: number; waterMl: number }>;
  byProvider: Record<string, { energyWh: number; waterMl: number }>;
  byMethodology: Record<string, { energyWh: number; waterMl: number }>;
  optimizedEventsCount: number;
  baselineTotals: { energyWh: number; waterMl: number };
  estimatedAvoidedTotals: { energyWh: number; waterMl: number };
}

export class LocalLedger {
  private events: Map<string, WaterPrintEvent> = new Map();
  private eventOrder: string[] = []; // maintain append order

  public append(event: WaterPrintEvent): void {
    if (!event || typeof event !== "object") throw new Error("Invalid event object");
    if (event.schemaVersion !== "0.1.0") throw new Error("Unsupported schema version");
    if (!event.eventId) throw new Error("Missing eventId");

    // Re-verify canonical hash to detect corruption or forgery
    const canonicalStr = canonicalizeEventData(event);
    // Since createEvent is async (crypto.subtle), we just do basic integrity checks synchronously where practical,
    // or we could make append async. Let's assume the eventId is treated as the primary key.
    // Duplicate detection:
    if (this.events.has(event.eventId)) {
      // It's a replay/duplicate. 
      // Requirement: Duplicate/replay protection. We just ignore exact duplicates safely.
      return; 
    }

    // Check for malicious replay (different content, same ID) is inherently prevented 
    // because ID is a hash of content. If ID is forged, it won't match. 
    // But we need to be async to verify hash.
    // Let's implement appendAsync to be safe and actually verify the hash.
    throw new Error("Use appendAsync to safely append events with integrity verification");
  }

  public async appendAsync(event: WaterPrintEvent): Promise<boolean> {
    if (!event || typeof event !== "object") throw new Error("Invalid event object");
    if (event.schemaVersion !== "0.1.0") throw new Error("Unsupported schema version");
    if (typeof event.eventId !== "string" || event.eventId.length !== 64) throw new Error("Invalid eventId format");

    // Integrity check
    const canonicalStr = canonicalizeEventData(event);
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalStr);
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const expectedId = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (event.eventId !== expectedId) {
      throw new Error("Event corruption detected: eventId does not match content");
    }

    if (this.events.has(event.eventId)) {
      return false; // Duplicate ignored safely
    }

    // Ensure no raw prompt content
    if ("prompt" in event || "content" in event) {
      throw new Error("Privacy violation: prompt content detected in event");
    }

    // Append only
    // Deep clone to prevent external mutation
    const safeEvent = JSON.parse(JSON.stringify(event));
    this.events.set(safeEvent.eventId, safeEvent);
    this.eventOrder.push(safeEvent.eventId);
    return true;
  }

  public getEvents(): WaterPrintEvent[] {
    // Return copies to prevent mutation
    return this.eventOrder.map(id => JSON.parse(JSON.stringify(this.events.get(id))));
  }

  public aggregate(): LedgerAggregate {
    const agg: LedgerAggregate = {
      eventCount: 0,
      totalEnergyWh: 0,
      totalWaterMl: 0,
      totalEnergyRangeWh: { lower: 0, upper: 0 },
      totalWaterRangeMl: { lower: 0, upper: 0 },
      byMeasurementType: {
        estimated: { energyWh: 0, waterMl: 0 },
        measured: { energyWh: 0, waterMl: 0 },
        estimated_avoided: { energyWh: 0, waterMl: 0 },
        verified_restoration: { energyWh: 0, waterMl: 0 }
      },
      byProvider: {},
      byMethodology: {},
      optimizedEventsCount: 0,
      baselineTotals: { energyWh: 0, waterMl: 0 },
      estimatedAvoidedTotals: { energyWh: 0, waterMl: 0 }
    };

    for (const id of this.eventOrder) {
      const e = this.events.get(id)!;
      agg.eventCount++;
      
      const mType = e.estimate.measurementType;
      
      // We do NOT add estimated_avoided or verified_restoration to totalEnergyWh
      // They are separate concepts!
      if (mType === "estimated" || mType === "measured") {
        agg.totalEnergyWh += e.estimate.energyWh;
        agg.totalWaterMl += e.estimate.waterMl;
        agg.totalEnergyRangeWh.lower += e.estimate.energyRangeWh.lower;
        agg.totalEnergyRangeWh.upper += e.estimate.energyRangeWh.upper;
        agg.totalWaterRangeMl.lower += e.estimate.waterRangeMl.lower;
        agg.totalWaterRangeMl.upper += e.estimate.waterRangeMl.upper;

        if (e.optimizationAccepted) {
          agg.optimizedEventsCount++;
        }
        
        agg.baselineTotals.energyWh += e.estimate.energyWh;
        agg.baselineTotals.waterMl += e.estimate.waterMl;
      } else if (mType === "estimated_avoided") {
        agg.estimatedAvoidedTotals.energyWh += e.estimate.energyWh;
        agg.estimatedAvoidedTotals.waterMl += e.estimate.waterMl;
      }

      if (!agg.byProvider[e.provider]) {
        agg.byProvider[e.provider] = { energyWh: 0, waterMl: 0 };
      }
      agg.byProvider[e.provider]!.energyWh += e.estimate.energyWh;
      agg.byProvider[e.provider]!.waterMl += e.estimate.waterMl;

      const method = e.estimate.methodologyVersion;
      if (!agg.byMethodology[method]) {
        agg.byMethodology[method] = { energyWh: 0, waterMl: 0 };
      }
      agg.byMethodology[method]!.energyWh += e.estimate.energyWh;
      agg.byMethodology[method]!.waterMl += e.estimate.waterMl;

      agg.byMeasurementType[mType].energyWh += e.estimate.energyWh;
      agg.byMeasurementType[mType].waterMl += e.estimate.waterMl;
    }

    return agg;
  }
}
