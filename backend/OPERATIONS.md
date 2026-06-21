# IGNIS Backend Operations

## Required Production Variables

```text
AUTH_SECRET=<32+ random bytes>
REVIEWER_API_KEYS=reviewer-1:<secret>,reviewer-2:<secret>,reviewer-3:<secret>
REVIEWER_API_KEYS_PREVIOUS=
SEALED_BUNDLE_KEYS=2026-01:<base64-32-byte-key>
SEALED_BUNDLE_ACTIVE_KEY_ID=2026-01
CORS_ORIGIN=https://ignis-protocol.com,https://www.ignis-protocol.com
TRUST_PROXY_HOPS=1
```

Railway forwards the original client address through one trusted proxy hop.
Do not set `TRUST_PROXY_HOPS=true`; trusting arbitrary hops allows clients to
spoof their address and bypass IP-based rate limits.

## Sealed Bundle Encryption

Generate a 32-byte key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Configure `SEALED_BUNDLE_KEYS` as `key-id:key-material`. To rotate:

1. Add the new key before the old key.
2. Set `SEALED_BUNDLE_ACTIVE_KEY_ID` to the new key ID.
3. Deploy and allow retained bundles encrypted under the old key to expire.
4. Remove the old key only after no retained bundle references it.

`BUNDLE_RETENTION_DAYS` starts when a review settles. The default is 30 days.
Expired ciphertext is deleted while hashes, decisions, receipts, and proof
records remain.

## Relay Transport

`RELAY_NODES` is a JSON array with three ordered nodes:

```json
[
  {"id":"relay-sea-01","region":"Southeast Asia","role":"ingress","url":"https://relay-sea.example.com","secret":"..."},
  {"id":"relay-sgp-04","region":"Singapore","role":"mixer","url":"https://relay-sgp.example.com","secret":"..."},
  {"id":"relay-ams-09","region":"Amsterdam","role":"exit","url":"https://relay-ams.example.com","secret":"..."}
]
```

Each hop validates a timestamped HMAC request, rejects nonce replay, and returns
a signed receipt chained to the previous hop. Without `RELAY_NODES`, the same
cryptographic pipeline runs in embedded preview mode. Embedded mode is useful
for development but is not network anonymity.

Deploy each relay as a separate service using:

```text
Start command: npm run start:relay
Root directory: /backend
RELAY_NODE_ID=relay-sea-01
RELAY_NODES=<the shared ordered node JSON>
RELAY_NODES_PREVIOUS=<previous shared node JSON during rotation only>
```

Use the matching node ID for each service. A relay receives only the encrypted
envelope, validates its hash, and returns a signed receipt without returning or
persisting the ciphertext.

For relay secret rotation, copy the current node JSON into
`RELAY_NODES_PREVIOUS`, deploy the new `RELAY_NODES` secrets, verify the route,
then remove `RELAY_NODES_PREVIOUS` after the grace window closes.

`GET /api/security` reports whether three independent HTTPS origins are active.
`GET /api/readiness` reports the required production checks used by the public
ops dashboard at `https://ignis-protocol.com/ops`.

## Reviewer Key Rotation

Put new keys in `REVIEWER_API_KEYS`. Move old keys to
`REVIEWER_API_KEYS_PREVIOUS` for a short grace period, deploy, verify reviewer
access, then remove the previous keys. Keep reviewer labels stable: duplicate
vote protection derives reviewer identity from the label so rotation does not
create a new voting identity.

## Abuse Controls and Audit

- `SUBMISSION_QUOTA_PER_HOUR` and `SUBMISSION_QUOTA_PER_DAY` limit each session.
- Secret and malware heuristics run after metadata sanitization and before relay routing.
- `GET /api/audit` requires reviewer authentication and exposes a redacted hash chain.
- `/health` returns `audit_chain_valid`; alert immediately if it becomes false.
- `/api/readiness` returns HTTP 503 if a required check fails and can be used by
  uptime monitors.

Production-safe smoke test:

```bash
npm run smoke:production
```

The default smoke checks health, security, readiness, signal, Solana status,
and relay topology without writing a submission. To intentionally exercise the
full submission path, run:

```bash
IGNIS_SMOKE_SUBMIT=1 npm run smoke:production
```

With the Solana devnet signer active, strict smoke should require anchor signer
config:

```bash
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production
```

Phase 8A readiness documents:

- `docs/AUDIT_PREP.md`
- `docs/LAUNCH_READINESS.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/MONITORING.md`
- `docs/DRILLS.md`
- `docs/PUBLIC_LAUNCH_RUNBOOK.md`
- `docs/REVIEWER_OPERATIONS.md`
- `docs/SECURITY_HARDENING.md`
- `docs/PUBLIC_FEEDBACK.md`
- `docs/PUBLIC_PREVIEW_PLAN.md`

## PostgreSQL

Provision Railway PostgreSQL and expose `DATABASE_URL` to the IGNIS service. On
startup the backend creates `ignis_protocol_state` automatically using
`migrations/001_protocol_state.sql`.

The atomic JSON file remains a local fallback and recovery snapshot. PostgreSQL
is authoritative whenever the connection succeeds.

Backup:

```bash
pg_dump "$DATABASE_URL" --format=custom --file=ignis-backup.dump
```

Restore:

```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" ignis-backup.dump
```

## Solana Devnet Anchor

```text
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_ANCHOR_SECRET_KEY=<base58 secret key or JSON byte array>
```

The signer must hold devnet SOL. Receipt creation does not depend on the signer:
unanchored receipts remain valid and wait in the retry queue.

Never expose the signer key, auth secret, database URL, or reviewer keys to
Vercel or frontend JavaScript.
