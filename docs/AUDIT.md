# IGNIS Audit Record

## Status

IGNIS is in audited alpha.

Review type: trusted peer security and product-flow audit.

Recorded date: 2026-06-21.

Scope status: no blocker reported for audited alpha public preview.

## Reviewed Scope

- Product positioning and public copy claim boundaries.
- Ephemeral session creation and session isolation.
- Diff intake validation for pasted and uploaded `.diff` / `.patch` files.
- Metadata stripping for reviewer-visible bundles.
- Sealed bundle encryption and retention controls.
- Reviewer authentication, quorum voting, duplicate vote protection, and reviewer key rotation.
- Proof receipt generation and verification.
- Solana devnet anchor signer state.
- Relay transport, signed relay receipts, and readiness checks.
- Production monitoring and smoke-test flow.

## Evidence

The following checks are part of the audited alpha evidence set:

```bash
npm test --prefix backend
npm run monitor:production --prefix backend
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production --prefix backend
```

Operational evidence:

- Production frontend resolves at `https://ignis-protocol.com`.
- Production API resolves at `https://api.ignis-protocol.com`.
- `/api/readiness` reports required controls.
- Relay mode is network-backed.
- PostgreSQL is configured for production state.
- Solana devnet signer is configured.
- Public copy avoids token, reward, guaranteed anonymity, and untraceable submission claims.

## Claim Boundary

Allowed public wording:

- audited alpha
- code without a face
- privacy-preserving code contribution
- metadata-stripped submissions
- blind review
- verifiable receipts
- Solana devnet proof anchoring

Do not claim:

- guaranteed anonymity
- untraceable submissions
- zero-knowledge review
- traffic-analysis resistance
- Solana mainnet anchoring
- token, staking, reward, or incentive mechanics
- formal third-party certification

## Follow-Up Items

- Record backup and restore drill evidence.
- Record reviewer key and relay secret rotation drill evidence.
- Keep production smoke checks running before and after public announcements.
- Consider a formal third-party audit before stronger privacy or anonymity claims.
