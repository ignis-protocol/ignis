# IGNIS Monitoring Plan

This plan defines the free-first checks to run before public preview and to
recreate in an uptime provider when budget allows.

The same checks are also represented in `monitoring/http-checks.json` as a
provider-neutral source of truth.

## Free-First Monitoring

No paid monitoring provider is required for the first public preview pass.

Run the lightweight HTTP monitor from any machine:

```bash
cd backend
npm run monitor:production
```

The command reads `monitoring/http-checks.json`, checks every public endpoint,
verifies expected HTTP statuses, validates configured JSON fields, and exits
non-zero if any check fails. It does not create submissions or mutate
production state.

For stricter release checks, run:

```bash
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production
```

Use the lightweight monitor for daily checks. Use strict smoke before releases,
after Railway/Vercel deploys, and after environment-variable changes.

## Optional Free Provider Setup

If a free uptime provider is used later, recreate the checks from
`monitoring/http-checks.json` exactly:

- Use `GET` for every URL.
- Match the expected HTTP status.
- For JSON endpoints, assert the configured fields such as `ok: true`,
  `ready: true`, `audit_chain_valid: true`, and `relay_production_ready: true`.
- Use 5-minute intervals for website pages and 1-minute intervals for API and
  relay health when the free tier allows it.
- Send alerts to an email or Telegram channel controlled by the operator.

Do not add write-path checks to a public uptime provider. Submission smoke tests
must stay manual because they create production records.

## Public HTTP Checks

| Check | URL | Expected |
|---|---|---|
| Website | `https://ignis-protocol.com` | HTTP 200 |
| Ops dashboard | `https://ignis-protocol.com/ops` | HTTP 200 |
| API health | `https://api.ignis-protocol.com/health` | HTTP 200, `ok: true` |
| API readiness | `https://api.ignis-protocol.com/api/readiness` | HTTP 200, `ready: true` |
| Southeast Asia relay | `https://ignis-relay-tyo-production.up.railway.app/health` | HTTP 200, `ok: true` |
| Singapore relay | `https://ignis-relay-sgp-production.up.railway.app/health` | HTTP 200, `ok: true` |
| Amsterdam relay | `https://ignis-relay-ams-production.up.railway.app/health` | HTTP 200, `ok: true` |

The first relay is physically configured in Railway's Southeast Asia region.
The service name still contains `tyo` for historical continuity; public labels
must use `Southeast Asia`.

## Alert Conditions

Alert immediately when:

- `/health` is not HTTP 200.
- `/api/readiness` has `ready: false`.
- Any required readiness check is not `pass`.
- Any relay `/health` check fails twice in a row.
- `audit_chain_valid` is false.
- `relay_production_ready` is false.
- PostgreSQL storage is not writable.
- `queued_reviews` grows unexpectedly for the active public preview window.
- `failed_anchors` grows while the Solana signer is configured and funded.

## Suggested Cadence

| Target | Interval |
|---|---|
| Website and ops dashboard | 5 minutes |
| API health and readiness | 1 minute |
| Relay health | 1 minute |
| Production smoke script | manual before release, daily during public preview |

## Manual Verification

```bash
cd backend
npm run monitor:production
npm run smoke:production
```

With signer provisioning active:

```bash
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production
```

Only run write-path smoke when a real production submission is acceptable:

```bash
IGNIS_SMOKE_SUBMIT=1 npm run smoke:production
```
