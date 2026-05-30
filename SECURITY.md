# Security

## Reporting vulnerabilities

Please do NOT open a public issue for security vulnerabilities.

Email: security@ignis-protocol.xyz (or DM @ignisbase on X)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We'll respond within 48 hours.

## Known limitations (current alpha)

- `$IGNIS` token not yet deployed — bond/tip amounts recorded off-chain in sql.js
- Session tokens stored in `sessionStorage` — cleared on tab close
- No rate limiting on gitlawb proxy endpoints beyond the global 60 req/min
- Bond watcher polling interval is configurable but not adaptive

## Responsible disclosure

We'll credit all valid vulnerability reports in the changelog.
