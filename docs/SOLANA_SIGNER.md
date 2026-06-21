# IGNIS Solana Signer Handoff

The devnet anchor signer was generated locally and stored in `backend/.env.local`.
That file is intentionally ignored by git and must not be committed.

## Current Devnet Signer

```text
AJtFAby1xGnTKgpoC3z5uB64aWeBTqDeZTeYmB6M9Gzr
```

## Current Status

- Status: funded and active on Solana devnet.
- Balance verified: 10 devnet SOL.
- Production backend variables are configured on Railway.
- Strict production smoke passes with Solana required.

## Production Anchor Signer

The `ignis` backend service uses:

```text
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_ANCHOR_SECRET_KEY=<value from backend/.env.local>
```

Run strict smoke after any signer, Solana, or Railway env change:

```bash
cd backend
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production
```

Run a full write-path smoke only when a test submission is acceptable:

```bash
IGNIS_SMOKE_SUBMIT=1 IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production
```

## Custody Notes

- Do not paste `SOLANA_ANCHOR_SECRET_KEY` into chat, tickets, docs, or frontend
  code.
- Keep a private backup of the signer secret if the signer must be recoverable.
- Rotate the signer before public launch if the key has been exposed outside the
  backend environment.
