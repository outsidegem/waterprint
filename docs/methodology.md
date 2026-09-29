# WaterPrint Estimation Methodology — v0.1

WaterPrint v0.1 is an estimation framework, not a direct infrastructure meter.

The core model is deliberately simple:

`estimated_energy_wh = workload_units * energy_wh_per_unit`

`estimated_water_ml = estimated_energy_wh * water_ml_per_wh`

The default constants are intentionally configurable and versioned. They are placeholders for the MVP and MUST NOT be represented as provider measurements.

Every estimate carries:
- methodology version
- lower bound
- upper bound
- confidence label
- source metadata when available

Future provider integrations may replace assumptions with provider-supplied telemetry. Until then, WaterPrint must clearly label values as estimates.

## Accounting separation

Measurement, avoided resource use, verified conservation, and restoration credits are separate concepts. A WaterPrint event does not itself constitute a water restoration certificate.
