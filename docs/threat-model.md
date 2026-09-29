# Threat Model

## Assets
- user privacy
- methodology integrity
- accounting event integrity
- provider credentials (if future adapters use them)
- software supply chain

## Threats
- malicious webpage metadata
- fabricated provider values
- oversized numeric inputs
- prototype pollution in adapters
- accidental prompt persistence
- dependency compromise
- replay/duplicate events

## Controls in v0.1
- strict runtime validation
- bounded numeric inputs
- no prompt-content field in the core event schema
- deterministic estimator
- methodology versioning
- tests for malformed inputs and duplicate event identifiers

Future browser code should run with minimum permissions and use isolated message schemas.
