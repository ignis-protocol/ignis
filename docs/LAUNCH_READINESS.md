# IGNIS Launch Readiness Checklist

Use this checklist before closed beta and again before public launch.

## Required Before Closed Beta

- [ ] `https://ignis-protocol.com` loads the product site.
- [ ] `https://ignis-protocol.com/terminal` loads the terminal.
- [ ] `https://ignis-protocol.com/reviewer` loads the reviewer console.
- [ ] `https://ignis-protocol.com/proof` loads the verifier.
- [ ] `https://ignis-protocol.com/ops` loads the ops dashboard.
- [ ] `https://api.ignis-protocol.com/health` returns `ok: true`.
- [ ] `https://api.ignis-protocol.com/api/readiness` has all required checks passing.
- [ ] `npm run smoke:production` passes.
- [ ] Monitoring checks from `docs/MONITORING.md` are configured.
- [ ] Monitoring checks from `monitoring/http-checks.json` are imported or recreated.
- [ ] Relay nodes show `mode: network`.
- [ ] PostgreSQL is writable.
- [ ] Audit chain is valid.
- [ ] Reviewer keys are available to beta reviewers through a private channel.
- [ ] Public copy does not claim guaranteed anonymity.
- [ ] Orynth ownership verification is complete.

## Required Before Public Launch

- [ ] External security and privacy audit completed.
- [ ] Audit findings triaged and critical/high issues resolved.
- [ ] Production devnet Solana signer configured and strict Solana smoke passes.
- [ ] Backup and restore drill completed.
- [ ] Reviewer key rotation drill completed.
- [ ] Bundle key rotation drill completed.
- [ ] Relay secret rotation drill completed.
- [ ] Incident response owner and escalation path defined.
- [ ] Uptime checks exist for API, readiness, relays, Vercel, and Postgres.
- [ ] Domain renewal and Railway/Vercel billing are stable.
- [ ] Social preview cards are correct.
- [ ] README and docs match live production behavior.
- [ ] Closed beta feedback template is ready for every participant.
- [ ] Closed beta plan is assigned to an operator.

## Manual Flow Check

1. Open `/terminal`.
2. Run `init`.
3. Paste or upload a harmless diff.
4. Run `strip`.
5. Run `submit ignis-protocol/ignis`.
6. Confirm status shows a queued review.
7. Log into `/reviewer` with three reviewer keys.
8. Cast quorum votes.
9. Confirm a proof receipt is issued.
10. Open `/proof?id=<proof_id>`.

## Supporting Phase 8B Documents

- `docs/MONITORING.md`
- `docs/DRILLS.md`
- `docs/BETA_FEEDBACK.md`
- `docs/AUDIT_PREP.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/AUDITOR_REQUEST.md`
- `docs/CLOSED_BETA_PLAN.md`
- `docs/SOLANA_SIGNER.md`
- `monitoring/http-checks.json`

## Go / No-Go Rules

Go only if required checks pass and the known limitations are documented.

No-go if any of these are true:

- API health fails.
- Readiness required checks fail.
- Relay mode is embedded or fewer than three relay nodes are active.
- PostgreSQL is not writable.
- Audit chain is invalid.
- Reviewer quorum cannot be reached.
- The frontend makes stronger privacy claims than the audited system supports.
