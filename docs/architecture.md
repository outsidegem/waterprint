# Architecture

```text
Provider adapter / browser integration
                |
                v
        normalized metadata
                |
                v
        WaterPrint estimator
                |
        +-------+--------+
        |                |
        v                v
   resource result   uncertainty
        |
        v
     ledger event
        |
        +----> local aggregation
        |
        +----> optional future anonymous telemetry
```

The core package is provider-neutral. Browser integrations must not make the estimator dependent on DOM structure or provider-specific APIs.
