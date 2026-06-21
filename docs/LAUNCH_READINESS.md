# IGNIS Launch Readiness Checklist

Use this checklist before public preview and again before broader public launch.

## Required Before Public Preview

- [x] `https://ignis-protocol.com` loads the product site.
- [x] `https://ignis-protocol.com/terminal` loads the terminal.
- [x] `https://ignis-protocol.com/reviewer` loads the reviewer console.
- [x] `https://ignis-protocol.com/proof` loads the verifier.
- [x] `https://ignis-protocol.com/ops` loads the ops dashboard.
- [x] `https://api.ignis-protocol.com/health` returns `ok: true`.
- [x] `https://api.ignis-protocol.com/api/readiness` has all required checks passing.
- [x] `npm run smoke:production` passes.
- [x] Monitoring checks from `docs/MONITORING.md` are configured.
- [x] Monitoring checks from `monitoring/http-checks.json` are imported or recreated.
- [x] Relay nodes show `mode: network`.
- [x] PostgreSQL is writable.
- [x] Audit chain is valid.
- [x] Reviewer keys are available to trusted reviewers through a private channel.
- [x] Public copy does not claim guaranteed anonymity.
- [x] Orynth ownership verification is complete.
- [x] Extensionless public routes work: `/terminal`, `/reviewer`, `/proof`, `/ops`.
- [x] Public launch runbook exists and links are current.
- [x] Reviewer operations runbook exists.
- [x] Public feedback intake is available.
- [x] Security hardening checklist is current.
- [x] Sample diff flow works from `/terminal?sample=1`.
- [x] Public aggregate metrics work at `/api/public-metrics`.

## Required Before Broader Public Launch

- [x] Trusted peer audit recorded in `docs/AUDIT.md`.
- [x] No critical/high blocker recorded for audited alpha.
- [x] Trusted peer audit decision recorded as clear for the audited-alpha scope.
- [x] Production devnet Solana signer configured and strict Solana smoke passes.
- [x] Backup and restore drill completed.
- [x] Reviewer key rotation drill completed.
- [x] Bundle key rotation drill completed.
- [x] Relay secret rotation drill completed.
- [x] Incident response owner and escalation path defined.
- [x] Uptime checks exist for API, readiness, relays, Vercel, and Postgres.
- [ ] Domain renewal and Railway/Vercel billing are stable.
- [x] Social preview cards are correct.
- [x] README and docs match live production behavior.
- [x] Public feedback template is ready.
- [x] Public preview operator flow is assigned.

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
- `docs/PUBLIC_LAUNCH_RUNBOOK.md`
- `docs/REVIEWER_OPERATIONS.md`
- `docs/SECURITY_HARDENING.md`
- `docs/PUBLIC_FEEDBACK.md`
- `docs/AUDIT.md`
- `docs/LAUNCH_COPY.md`
- `docs/USER_FLOW.md`
- `docs/REVIEWER_QUICKSTART.md`
- `docs/AUDIT_PREP.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/AUDITOR_REQUEST.md`
- `docs/PUBLIC_PREVIEW_PLAN.md`
- `docs/PHASE_8D_EVIDENCE.md`
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
