export type Confidence = "low" | "medium" | "high";
export type MeasurementType = "estimated" | "measured" | "estimated_avoided" | "verified_restoration";

export interface EstimationInput {
  workloadUnits: number;
  energyWhPerUnit: number;
  waterMlPerWh: number;
  uncertaintyFraction?: number;
  methodologyVersion?: string;
  measurementType?: MeasurementType;
  provenance?: string;
}

export interface ResourceEstimate {
  methodologyVersion: string;
  energyWh: number;
  waterMl: number;
  energyRangeWh: { lower: number; upper: number };
  waterRangeMl: { lower: number; upper: number };
  confidence: Confidence;
  measurementType: MeasurementType;
  provenance: string;
  uncertaintyFraction: number;
}

function validateNumber(val: any, min: number, max: number, name: string): number {
  if (typeof val !== "number" || !Number.isFinite(val) || Number.isNaN(val)) {
    throw new Error(`Invalid ${name}: must be a finite number`);
  }
  if (val < min || val > max) {
    throw new Error(`Invalid ${name}: out of bounds [${min}, ${max}]`);
  }
  return val;
}

export function estimateResources(input: EstimationInput): ResourceEstimate {
  if (!input || typeof input !== "object") throw new Error("Invalid input object");

  const workloadUnits = validateNumber(input.workloadUnits, 0, 1e9, "workloadUnits");
  const energyWhPerUnit = validateNumber(input.energyWhPerUnit, 0, 1e6, "energyWhPerUnit");
  const waterMlPerWh = validateNumber(input.waterMlPerWh, 0, 1e6, "waterMlPerWh");
  const uncertainty = validateNumber(input.uncertaintyFraction ?? 0.25, 0, 1, "uncertaintyFraction");

  const energyWh = workloadUnits * energyWhPerUnit;
  const waterMl = energyWh * waterMlPerWh;
  
  // ensure we don't return negative lower bounds due to JS floating point edge cases? 
  // actually uncertainty is <= 1 so 1-uncertainty is >=0
  const lowerMultiplier = Math.max(0, 1 - uncertainty);
  const upperMultiplier = 1 + uncertainty;

  const mType = input.measurementType ?? "estimated";
  const validTypes = ["estimated", "measured", "estimated_avoided", "verified_restoration"];
  if (!validTypes.includes(mType)) throw new Error("Invalid measurementType");

  const methodVersion = input.methodologyVersion ?? "waterprint-estimator-0.1";
  if (typeof methodVersion !== "string" || methodVersion.length > 256) throw new Error("Invalid methodologyVersion");

  const prov = input.provenance ?? "unknown";
  if (typeof prov !== "string" || prov.length > 1024) throw new Error("Invalid provenance");

  return {
    methodologyVersion: methodVersion,
    energyWh,
    waterMl,
    energyRangeWh: { lower: energyWh * lowerMultiplier, upper: energyWh * upperMultiplier },
    waterRangeMl: { lower: waterMl * lowerMultiplier, upper: waterMl * upperMultiplier },
    confidence: uncertainty <= 0.1 ? "high" : uncertainty <= 0.35 ? "medium" : "low",
    measurementType: mType as MeasurementType,
    provenance: prov,
    uncertaintyFraction: uncertainty
  };
}
