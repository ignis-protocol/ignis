# IGNIS Operational Drills

Run these drills before public launch. Record the date, operator, commands,
result, and any follow-up actions.

## Backup Drill

Goal: prove that the production PostgreSQL state can be exported.

1. Confirm `/api/readiness` required checks pass.
2. Export the database:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=ignis-backup-YYYYMMDD.dump
```

3. Store the backup in the approved private location.
4. Record file size, timestamp, and checksum.

## Restore Drill

Goal: prove that a backup can be restored without touching production.

1. Create a temporary PostgreSQL instance.
2. Restore the backup into the temporary database:

```bash
pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" ignis-backup-YYYYMMDD.dump
```

3. Point a temporary backend environment at `RESTORE_DATABASE_URL`.
4. Run:

```bash
IGNIS_API_URL=<temporary-api-url> npm run smoke:production
```

5. Destroy the temporary database after verification.

## Reviewer Key Rotation Drill

Goal: rotate reviewer credentials without changing reviewer identity.

1. Generate a new key for one reviewer.
2. Replace that reviewer's key under the same label in `REVIEWER_API_KEYS`.
3. Optionally move the previous key to `REVIEWER_API_KEYS_PREVIOUS` for a short
   grace window.
4. Deploy.
5. Verify reviewer login.
6. Confirm duplicate-vote protection still maps to the same reviewer label.
7. Remove the grace key after the window closes.

## Bundle Key Rotation Drill

Goal: rotate sealed bundle encryption without losing retained bundles.

1. Generate a new 32-byte base64 key.
2. Prepend `new-key-id:<key>` to `SEALED_BUNDLE_KEYS`.
3. Set `SEALED_BUNDLE_ACTIVE_KEY_ID=new-key-id`.
4. Deploy.
5. Run production smoke.
6. Keep old keys until retained bundles encrypted with them expire.

## Relay Secret Rotation Drill

Goal: rotate relay HMAC secrets without breaking the three-hop path.

1. Prepare new secrets for all relay nodes.
2. Update the shared `RELAY_NODES` JSON on the main API and each relay service.
3. Redeploy relays first, then the main API.
4. Check each relay `/health`.
5. Run:

```bash
IGNIS_SMOKE_SUBMIT=1 npm run smoke:production
```

Use this write-path smoke only when a test submission is acceptable.

## AUTH_SECRET Rotation Strategy

`AUTH_SECRET` signs active wallet and reviewer sessions. Rotating it invalidates
existing short-lived sessions. Rotate only during a maintenance window unless a
secret compromise is suspected.

1. Notify reviewers.
2. Set a new `AUTH_SECRET`.
3. Redeploy the API and relays if they depend on the same secret fallback.
4. Ask reviewers to log in again.
5. Run production smoke.
