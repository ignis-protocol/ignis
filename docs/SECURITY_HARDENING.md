# IGNIS Security Hardening Pass

This checklist records the free-first hardening scope for audited alpha public
preview. It does not claim formal third-party certification.

## Current Controls

- CORS is restricted to production frontend origins and local development.
- `trust proxy` is pinned to one hop for Railway.
- Express `x-powered-by` is disabled.
- Basic security headers are set on API responses.
- Global rate limiting is enabled.
- Auth-specific rate limiting is enabled for reviewer and wallet sessions.
- Request body size is capped.
- Diff intake rejects empty, oversized, excessive-line, and binary payloads.
- Secret and command-execution heuristics run before submissions enter review.
- Reviewer keys are stored only in backend environment variables.
- Sealed bundles use AES-256-GCM with key rotation support.
- Relay hops use authenticated, signed receipt chains.
- PostgreSQL is authoritative in production with JSON fallback.
- Solana signer is backend-only and funded on devnet.

## Public Claim Policy

Allowed:

- privacy-preserving
- metadata-stripped
- blind review
- verifiable receipts
- Solana devnet anchoring

Out of scope for audited alpha:

- guaranteed anonymity
- untraceable submissions
- zero-knowledge review
- formally certified privacy
- traffic-analysis resistance

## Pre-Launch Security Commands

```bash
npm test --prefix backend
npm run monitor:production --prefix backend
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production --prefix backend
```

## Manual Review Items

- Confirm no secrets are committed.
- Confirm `.env.local` remains ignored.
- Confirm Vercel has no backend secrets.
- Confirm Railway variables do not include unused legacy integration values.
- Confirm frontend copy does not advertise a token or incentive layer.
- Confirm `/ops` reports `ready` before public announcement.

## Residual Risks

- Trusted peer audit is recorded; formal third-party certification has not been completed.
- Relay services are not independently operated by separate organizations.
- Sanitizers can miss novel identity markers.
- Operators with database and vault key access can decrypt retained bundles.
- PostgreSQL state is still protocol-level JSON, not a fully normalized schema.
