# IGNIS Audit Prep Package

This package is the starting brief for an external security and privacy review.
It describes what IGNIS currently does, what must be reviewed, and what claims
are intentionally out of scope until that review is complete.

## Product Boundary

IGNIS is a privacy-preserving code contribution protocol:

1. A contributor creates an ephemeral local session.
2. A diff or patch is sanitized for identity-bearing metadata.
3. The sanitized bundle is encrypted at rest.
4. A signed relay path produces three hop receipts.
5. Reviewers score the diff blind.
6. Accepted work receives a verifiable proof receipt.
7. Solana anchoring is queued when a signer is configured.

IGNIS is not currently a token, staking system, reward protocol, or production
anonymity guarantee.

## Live Surfaces

| Surface | URL |
|---|---|
| Website | https://ignis-protocol.com |
| Ops dashboard | https://ignis-protocol.com/ops |
| Terminal | https://ignis-protocol.com/terminal |
| Reviewer console | https://ignis-protocol.com/reviewer |
| Proof verifier | https://ignis-protocol.com/proof |
| API | https://api.ignis-protocol.com |

## Components To Review

| Component | Files |
|---|---|
| API routes and validation | `backend/server.js` |
| Metadata sanitizer | `backend/lib/sanitizer.js` |
| Bundle encryption | `backend/lib/bundle-vault.js` |
| Relay transport | `backend/lib/relay-transport.js`, `backend/relay-server.js` |
| Abuse controls | `backend/lib/abuse-controls.js` |
| Storage and migration | `backend/lib/storage.js`, `backend/migrations/001_protocol_state.sql` |
| Solana anchoring | `backend/lib/solana-anchor.js` |
| Reviewer console | `frontend/reviewer.html` |
| Proof verifier | `frontend/proof.html` |
| Ops dashboard | `frontend/ops.html` |

## Security Properties To Validate

- Sanitizer removes author, email, username, hostname, local path, timestamp, and
  private remote URL metadata from review-visible diffs.
- Reviewer APIs never expose raw session IDs, wallet addresses, or encrypted
  bundle plaintext outside authenticated reviewer paths.
- Encrypted bundles use AES-256-GCM with authenticated context binding.
- Key rotation does not break retained bundles and does not leak key material.
- Relay requests are timestamped, HMAC-authenticated, replay-protected, and
  receipt hashes chain across all hops.
- Public proof receipts remain independently verifiable without revealing wallet
  addresses.
- Reviewer key rotation preserves reviewer identity for duplicate vote checks.
- Audit events form a tamper-evident hash chain.
- Rate limits and per-session quotas resist trivial spam and stored payload abuse.
- CORS policy only allows intended frontend origins.

## Known Limitations

- No independent privacy or security audit has been completed.
- Solana signer is not configured in production at the time of this package.
- Relay services are separate Railway services but not independently operated by
  different legal entities.
- Traffic-analysis resistance has not been formally tested.
- The system should not claim guaranteed anonymity before audit completion.

## Evidence Commands

```bash
cd backend
npm test
npm run smoke:production
```

Optional write-path smoke:

```bash
IGNIS_SMOKE_SUBMIT=1 npm run smoke:production
```

Optional strict Solana mode after signer provisioning:

```bash
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production
```

## Auditor Questions

- Can any reviewer-visible payload identify a contributor?
- Can a relay be bypassed or forged while still producing valid receipts?
- Can old encrypted bundles be decrypted with the wrong context or key?
- Can a compromised reviewer key vote twice after rotation?
- Can public proof receipt data be correlated to wallet identity?
- Can a malformed patch trigger parser or storage abuse?
- Can rate-limit headers or proxy trust be spoofed behind Railway?
- Can audit events be removed, reordered, or modified without detection?
