# IGNIS Launch Readiness Checklist

Use this checklist before public preview and again before broader public launch.

## Required Before Public Preview

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
- [ ] Reviewer keys are available to trusted reviewers through a private channel.
- [ ] Public copy does not claim guaranteed anonymity.
- [ ] Orynth ownership verification is complete.
- [ ] Extensionless public routes work: `/terminal`, `/reviewer`, `/proof`, `/ops`.
- [ ] Public launch runbook exists and links are current.
- [ ] Reviewer operations runbook exists.
- [ ] Public feedback intake is available.
- [ ] Security hardening checklist is current.
- [ ] Sample diff flow works from `/terminal?sample=1`.
- [ ] Public aggregate metrics work at `/api/public-metrics`.

## Required Before Broader Public Launch

- [x] Trusted peer audit recorded in `docs/AUDIT.md`.
- [x] No critical/high blocker recorded for audited alpha.
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
- [ ] Public feedback template is ready.
- [ ] Public preview operator flow is assigned.

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
