# IGNIS Public Launch Runbook

Use this runbook before any public announcement, pinned post, directory listing,
or launch submission.

## Launch Position

IGNIS is ready to present as a trusted peer audited alpha public preview of a
privacy-preserving code contribution protocol.

Phase 8D evidence is recorded in `docs/PHASE_8D_EVIDENCE.md`. The broader
public launch decision is clear for audited alpha preview wording.

Allowed wording:

- code without a face
- trusted peer audited alpha
- audit evidence recorded
- Phase 8D verified
- privacy-preserving code contribution
- metadata-stripped submissions
- blind review surface
- verifiable proof receipts
- Solana devnet proof anchoring
- audited alpha

Avoid wording:

- guaranteed anonymity
- untraceable submissions
- formally certified privacy
- token, rewards, staking, or incentive promises
- Solana mainnet proof anchoring

## Pre-Launch Checks

Run from the repo root:

```bash
npm test --prefix backend
npm run drill:phase8d --prefix backend
npm run monitor:production --prefix backend
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production --prefix backend
```

Open and visually inspect:

- https://ignis-protocol.com
- https://ignis-protocol.com/terminal
- https://ignis-protocol.com/reviewer
- https://ignis-protocol.com/proof
- https://ignis-protocol.com/ops
- https://api.ignis-protocol.com/api/readiness

No-go if any of these fail:

- production monitor has any failed check
- strict production smoke fails
- `/api/readiness` is not `ready`
- relay mode is not `network`
- Solana signer is not configured
- frontend copy overclaims privacy
- reviewer keys are unavailable to trusted reviewers

## Launch Steps

1. Confirm Railway and Vercel latest deployments are healthy.
2. Run the pre-launch checks above.
3. Confirm the X profile link is correct: https://x.com/IgnisAgent_Ai
4. Confirm public feedback intake is ready.
5. Publish with alpha public preview wording.
6. Watch `/ops`, Railway logs, and public feedback for the first hour.
7. Run `npm run monitor:production --prefix backend` again after launch traffic
   starts.

## Post-Launch Watch

Check every 15 minutes for the first hour:

- API readiness
- relay health
- queued reviews
- failed anchors
- suspicious submission volume
- public reports of broken routes or confusing copy

Daily during public preview:

```bash
npm run monitor:production --prefix backend
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production --prefix backend
```

## Rollback

If a bad frontend deploy ships:

1. Redeploy the previous successful Vercel deployment.
2. Re-run monitor and strict smoke.
3. Record incident notes in `docs/INCIDENT_RESPONSE.md` format.

If a bad backend deploy ships:

1. Redeploy the previous successful Railway deployment.
2. Confirm `/health` and `/api/readiness`.
3. Re-run monitor and strict smoke.
4. Rotate secrets only if exposure or auth bypass is suspected.

## Public Status Rule

If the system is degraded, say exactly what is degraded. Do not imply privacy or
proof guarantees while a required control is failing.
