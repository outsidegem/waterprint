# Security Policy

WaterPrint handles potentially sensitive AI-usage metadata. The default design intentionally avoids storing prompt content.

## Report a vulnerability

Do not disclose exploitable vulnerabilities in a public issue. Use the repository's private GitHub security-advisory mechanism when available.

Include:
- affected version/commit
- reproduction steps
- security impact
- suggested mitigation, if known

## Security principles

- no prompt content required for accounting
- no provider credentials stored by the core
- validate all external/provider metadata
- bounded numeric inputs
- versioned methodology
- fail closed on malformed accounting events
- deterministic calculations
