# WaterPrint Core v0.1

Privacy-first, provider-neutral AI resource estimation core.

## Overview
WaterPrint provides local, append-only accounting and resource estimation for AI workloads.

**IMPORTANT:** WaterPrint v0.1 is an estimation framework. It is NOT:
- A certified environmental accounting system
- A provider-internal measurement system
- A Water Restoration Certificate (WRC) issuer
- Proof of physical water restoration
- Proof of avoided water consumption unless the methodology explicitly supports that claim

## Capabilities
- **Resource Estimation**: Estimates energy and water usage based on parameterized methodologies. It estimates consumption, it does not measure provider telemetry directly unless telemetry is available.
- **Privacy First**: Raw prompts and credentials are never stored in the accounting ledger.
- **Deterministic**: Immutable event properties yield a deterministic canonical hash for duplicate and replay protection.
- **Local Ledger**: Append-only local storage ensures that all valid estimates are correctly aggregated locally without blockchain or cloud dependencies.

## What it does not know
WaterPrint does not know internal datacenter hardware configurations, precise runtime power states, provider cooling efficiencies, or actual water measurements unless a verified telemetry adapter supplies them. All defaults represent configurable estimates.

## Usage
Refer to `docs/architecture.md` for integration details.
