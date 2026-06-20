# IGNIS Backend Operations

## Required Production Variables

```text
AUTH_SECRET=<32+ random bytes>
REVIEWER_API_KEYS=reviewer-1:<secret>,reviewer-2:<secret>,reviewer-3:<secret>
CORS_ORIGIN=https://ignis-lac-nine.vercel.app
```

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
