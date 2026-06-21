# IGNIS Incident Response

This runbook covers the most likely production incidents during alpha and beta.

## First Checks

```bash
cd backend
npm run smoke:production
```

Open:

- https://ignis-protocol.com/ops
- https://api.ignis-protocol.com/health
- https://api.ignis-protocol.com/api/readiness

## Severity

| Severity | Examples |
|---|---|
| SEV1 | API down, database unavailable, audit chain invalid, reviewer auth bypass |
| SEV2 | One relay down, proof issuance broken, CORS blocks production site |
| SEV3 | Solana anchoring delayed, frontend route broken, degraded ops warning |

## API Down

1. Check Railway deployment status for `ignis`.
2. Inspect latest deploy logs.
3. If latest deploy is bad, redeploy the previous successful commit.
4. Run `npm run smoke:production`.
5. Post incident notes with timestamp, deployment ID, and root cause.

## Relay Failure

1. Check `/api/readiness` relay check.
2. Check each relay `/health` endpoint.
3. Redeploy the failed relay service.
4. Confirm `/api/security` shows three network relay nodes.
5. Run `IGNIS_SMOKE_SUBMIT=1 npm run smoke:production` only if a write-path
   test is needed.

## Audit Chain Invalid

1. Stop public beta intake if possible.
2. Export current PostgreSQL state for forensic review.
3. Do not manually rewrite audit events unless the incident is understood.
4. Compare latest deploy and DB changes.
5. Rotate secrets if tampering is suspected.

## Reviewer Key Compromise

1. Remove compromised key from `REVIEWER_API_KEYS`.
2. Add replacement key with the same reviewer label.
3. Move the old key to `REVIEWER_API_KEYS_PREVIOUS` only if a short grace
   period is intentional and safe.
4. Deploy and verify `/api/reviewer/session`.
5. Review recent votes and audit events.

## Bundle Key Rotation

1. Generate a new 32-byte base64 key.
2. Prepend it to `SEALED_BUNDLE_KEYS`.
3. Set `SEALED_BUNDLE_ACTIVE_KEY_ID`.
4. Deploy.
5. Keep old keys until all retained bundles using them expire.

## Database Recovery

Backup:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=ignis-backup.dump
```

Restore:

```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" ignis-backup.dump
```

After restore, run:

```bash
npm run smoke:production
```
