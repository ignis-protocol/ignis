# IGNIS Reviewer Operations

Reviewer access is private because reviewer votes settle public proof receipts.
Do not publish reviewer keys.

## Reviewer Key Format

Railway `REVIEWER_API_KEYS` uses comma-separated `label:secret` entries:

```text
reviewer-1:<secret>,reviewer-2:<secret>,reviewer-3:<secret>
```

Keep labels stable. Duplicate-vote protection is tied to the reviewer label.

## Add A Reviewer

1. Generate a high-entropy secret outside chat.
2. Add `label:secret` to `REVIEWER_API_KEYS`.
3. Keep `REVIEW_QUORUM` odd.
4. Deploy the backend.
5. Ask the reviewer to log in at `https://ignis-protocol.com/reviewer`.
6. Run:

```bash
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production --prefix backend
```

## Revoke A Reviewer

1. Remove the reviewer's `label:secret` from `REVIEWER_API_KEYS`.
2. Do not put the key in `REVIEWER_API_KEYS_PREVIOUS`.
3. Deploy the backend.
4. Confirm the revoked key cannot log in.
5. Review recent votes and audit events if compromise is suspected.

## Rotate A Reviewer Key

1. Generate a replacement secret.
2. Replace the old secret under the same label in `REVIEWER_API_KEYS`.
3. Optional: put the old `label:secret` in `REVIEWER_API_KEYS_PREVIOUS` only for
   a short planned grace window.
4. Deploy.
5. Confirm the reviewer can log in with the new key.
6. Remove the previous key after the grace window.

## Queue Handling

- Reviewers should judge only sanitized diff content, metadata report, hashes,
  and technical context.
- Do not ask contributors to reveal identity in reviewer notes.
- Reject submissions that contain secrets, malware indicators, or identity
  leaks that passed automated checks.
- Escalate P0 issues before casting votes if the review surface exposes private
  data.

## Settlement Rules

- Quorum must remain odd.
- Duplicate votes from the same reviewer label are blocked.
- Settled reviews cannot receive more votes.
- Public proof feedback must not expose reviewer identity.

## Emergency Actions

If a reviewer key leaks:

1. Revoke it immediately.
2. Deploy.
3. Inspect `/api/audit` with a trusted reviewer key.
4. Rotate adjacent keys if the leak source is unclear.
5. Document the incident and result.
