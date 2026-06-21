# IGNIS Audit Record

## Status

IGNIS is in trusted peer audited alpha. The trusted peer audit is complete and
clear for the recorded alpha scope.

Review type: trusted peer security and product-flow audit.

Recorded date: 2026-06-21.

Scope status: clear. No critical or high blocker was reported for the audited
alpha public preview scope.

Decision: trusted peer audit accepted and recorded as launch-clear for audited
alpha. Phase 8D recovery and rotation drill evidence is also recorded, so IGNIS
may use stronger audited-alpha wording such as `trusted peer audited alpha` and
`audit evidence recorded`.

## Reviewed Scope

- Product positioning and public copy claim boundaries.
- Ephemeral session creation and session isolation.
- Diff intake validation for pasted and uploaded `.diff` / `.patch` files.
- Metadata stripping for reviewer-visible bundles.
- Sealed bundle encryption and retention controls.
- Reviewer authentication, quorum voting, duplicate vote protection, and reviewer key rotation.
- Proof receipt generation and verification.
- Solana mainnet anchor signer state.
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
- Solana mainnet signer is verified through strict smoke before claiming live
  anchoring.
- Public copy avoids reward, guaranteed anonymity, and untraceable submission claims.

## Claim Boundary

Allowed public wording:

- audited alpha
- trusted peer audited alpha
- audit evidence recorded
- Phase 8D verified
- code without a face
- privacy-preserving code contribution
- metadata-stripped submissions
- blind review
- verifiable receipts
- Solana mainnet proof anchoring

Do not claim:

- guaranteed anonymity
- untraceable submissions
- zero-knowledge review
- traffic-analysis resistance
- guaranteed on-chain settlement
- staking, reward, or incentive mechanics
- formal third-party certification

## Follow-Up Items

- Backup, restore, reviewer key, bundle key, relay secret, and auth rotation
  drill evidence is recorded in `docs/PHASE_8D_EVIDENCE.md`.
- Keep production smoke checks running before and after public announcements.
- Consider a formal third-party audit before stronger privacy or anonymity
  claims beyond the recorded audited-alpha scope.
