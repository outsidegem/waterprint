# WaterPrint 💧⚡

> **«Don't use less AI. Use AI better.»**

WaterPrint is a consumer-facing, open-source resource-awareness layer for AI use. It helps users understand resource implications and reduce unnecessary computation without discouraging useful AI use.

---

## Core Accounting Principles
WaterPrint is an AI resource accounting and awareness system that must clearly distinguish:
1. **Estimated consumption:** Mathematical approximations based on versioned methodology.
2. **Measured consumption:** Direct telemetry data.
3. **Estimated avoided consumption:** Deltas from optimizations.
4. **Independently verified restoration:** Actual physical restoration.

These are not interchangeable. WaterPrint must not fabricate precision or claim knowledge it does not have.

---

## What WaterPrint Is NOT
At this stage, WaterPrint is explicitly not:
- A datacenter telemetry system or provider-internal monitor.
- A certified environmental accounting system or water-rights registry.
- A WRC issuer, marketplace, blockchain, or carbon-credit project.

**Note on WRCs:** Water Restoration Certificates are a downstream concept, not a V1 feature. WaterPrint must never create a WRC merely because its estimator reports consumption or savings.

---

## Engineering State & Roadmap
* **Gate 02 (Hardened Core):** `PASS WITH DOCUMENTED LIMITATIONS`. Anti-Gravity completed a hardening pass on runtime validation, event integrity, canonicalization, and a local append-only ledger.
* **Gate 03 (Independent Adversarial Audit):** **IMMEDIATE PRIORITY**. Anti-Gravity's Gate 02 report is an implementation-agent claim, not final truth. We are actively seeking independent engineers to audit the actual source code, tests, and ledger integrity.

**Canonical Roadmap:**
Gate 02 (Hardened Core) -> Gate 03 (Independent Adversarial Audit) -> V1 Core -> V1 UI -> Provider Adapters -> Optimization -> Aggregate User Accounting -> Local AI / Titan Integration -> Independent Environmental Verification -> Actual Water Restoration -> WRC Infrastructure.

---

## License
Licensed under the Apache-2.0 License. The core must remain provider-neutral.
