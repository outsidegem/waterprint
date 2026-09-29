import { ResourceEstimate, estimateResources, EstimationInput } from "./estimator.js";

export interface OptimizationSuggestion {
  offered: boolean;
  reason: string;
  suggestedInstruction: string;
}

export interface OptimizationResult {
  baselineEstimate: ResourceEstimate;
  suggestion: OptimizationSuggestion;
  optimizedEstimate: ResourceEstimate | null;
  estimatedDifference: ResourceEstimate | null;
}

export function suggestOptimization(inputTokens: number | undefined, outputTokens: number | undefined): OptimizationSuggestion {
  const total = (inputTokens ?? 0) + (outputTokens ?? 0);
  if (total === 0) {
    return {
      offered: false,
      reason: "Insufficient usage metadata.",
      suggestedInstruction: "No optimization suggestion is generated without enough metadata."
    };
  }
  if (total < 500) {
    return {
      offered: false,
      reason: "Request is already relatively compact.",
      suggestedInstruction: "Focus on getting more useful work from the request rather than reducing it further."
    };
  }
  
  return {
    offered: true,
    reason: "The interaction contains enough generated/input content that tighter scope may reduce unnecessary computation.",
    suggestedInstruction: "State the exact task, required output format, and desired length. Remove background information that is not needed for the result."
  };
}

export function calculateOptimization(
  baselineInput: EstimationInput,
  optimizedInput: EstimationInput | null
): OptimizationResult {
  const baselineEstimate = estimateResources(baselineInput);
  let optimizedEstimate: ResourceEstimate | null = null;
  let estimatedDifference: ResourceEstimate | null = null;

  if (optimizedInput) {
    optimizedEstimate = estimateResources(optimizedInput);
    
    // Calculate difference (avoided)
    const diffWorkload = Math.max(0, baselineInput.workloadUnits - optimizedInput.workloadUnits);
    
    const diffInput: EstimationInput = {
      workloadUnits: diffWorkload,
      energyWhPerUnit: baselineInput.energyWhPerUnit,
      waterMlPerWh: baselineInput.waterMlPerWh,
      measurementType: "estimated_avoided",
      provenance: "optimizer_difference"
    };
    if (baselineInput.methodologyVersion !== undefined) diffInput.methodologyVersion = baselineInput.methodologyVersion;
    diffInput.uncertaintyFraction = Math.max(baselineInput.uncertaintyFraction ?? 0.25, optimizedInput.uncertaintyFraction ?? 0.25);
    
    // We represent the avoided consumption as its own estimate using the difference
    estimatedDifference = estimateResources(diffInput);
  }

  // Suggestion based on baseline (assuming arbitrary token mapping for demo, since we don't have tokens here. 
  // We'll just pass 0 for now as the user handles tokens externally, or we can just say if it's large)
  const suggestion = suggestOptimization(baselineInput.workloadUnits * 100, 0); // rough proxy

  return {
    baselineEstimate,
    suggestion,
    optimizedEstimate,
    estimatedDifference
  };
}
