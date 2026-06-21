# Phase 8D Evidence

Date: 2026-06-22 UTC+7

Scope: recovery drill evidence, rotation drill evidence, launch decision, and
production smoke verification for the audited alpha public preview.

## Decision

Phase 8D is complete for the audited alpha public preview scope.

IGNIS is clear for broader public preview positioning when described as a
trusted peer audited alpha privacy-preserving code contribution protocol with
audit evidence recorded. Do not describe it as guaranteed anonymity, formally
certified privacy, staking infrastructure, or reward infrastructure.

## Automated Drill Evidence

Command:

```bash
npm run drill:phase8d --prefix backend
```

Result: pass.

Validated controls:

- Storage backup and restore drill using an isolated JSON snapshot.
- Reviewer key rotation with stable reviewer identity.
- Sealed bundle key rotation with previous-bundle readability.
- Relay secret rotation with previous-secret grace and replay protection.
- `AUTH_SECRET` rotation invalidates existing short-lived sessions.

Recorded drill output:

```json
{
  "ok": true,
  "phase": "8D",
  "started_at": "2026-06-21T19:15:46.164Z",
  "completed_at": "2026-06-21T19:15:46.187Z",
  "drills": [
    {
      "name": "storage_backup_restore",
      "status": "pass",
      "driver": "json-file",
      "checksum": "sha256:89cc220ba74e6b8ae48993d08d97e4c345f8e0dea7eb9e55115970b20e4b413a",
      "records_restored": 2
    },
    {
      "name": "reviewer_key_rotation",
      "status": "pass",
      "stable_identity": "52c46aaf1980",
      "old_key_changed": true
    },
    {
      "name": "bundle_key_rotation",
      "status": "pass",
      "previous_bundle_readable": true,
      "active_key_id": "2026-07-active"
    },
    {
      "name": "relay_secret_rotation",
      "status": "pass",
      "previous_secret_grace": true,
      "replay_protection": true,
      "nodes": [
        "relay-sea-01",
        "relay-sgp-04",
        "relay-ams-09"
      ]
    },
    {
      "name": "auth_secret_rotation",
      "status": "pass",
      "old_sessions_invalidated": true
    }
  ]
}
```

## Production Verification

Command:

```bash
npm test --prefix backend
```

Result: pass, 9/9 tests.

Command:

```bash
npm run monitor:production --prefix backend
```

Result: pass, 7/7 production checks.

Command:

```bash
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production --prefix backend
```

Result: pass. Site routes, API readiness, PostgreSQL storage, relay transport,
reviewer quorum, audit chain, trusted peer audit, and Solana signer state were
all reported healthy for the recorded environment.

## Operational Notes

- No destructive production restore was performed.
- The automated recovery drill proves the application state restore path in an
  isolated snapshot. Production PostgreSQL export and temporary restore commands
  remain documented in `docs/DRILLS.md` and `backend/OPERATIONS.md`.
- Relay rotation now supports `RELAY_NODES_PREVIOUS` for a short grace window,
  so relay services can accept both old and new secrets during coordinated
  rotation.
- The current Railway Southeast Asia relay hostname still contains a legacy
  service slug. Public labels use `Southeast Asia`; rename the Railway service
  before changing monitor URLs.
