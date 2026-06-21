# IGNIS Solana Signer Handoff

The devnet anchor signer was generated locally and stored in `backend/.env.local`.
That file is intentionally ignored by git and must not be committed.

## Current Devnet Signer

```text
AJtFAby1xGnTKgpoC3z5uB64aWeBTqDeZTeYmB6M9Gzr
```

## Funding Required

The default Solana devnet RPC faucet returned a 429/faucet-dry response during
setup. Fund the signer above from:

```text
https://faucet.solana.com
```

Use devnet. A small amount is enough for memo anchoring tests.

## Enable Production Anchor Signer

After the signer has devnet SOL:

1. Set these Railway variables on the `ignis` backend service:

```text
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_ANCHOR_SECRET_KEY=<value from backend/.env.local>
```

2. Redeploy the `ignis` service.
3. Run strict smoke:

```bash
cd backend
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production
```

4. Run a full write-path smoke only when a test submission is acceptable:

```bash
IGNIS_SMOKE_SUBMIT=1 IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production
```

## Custody Notes

- Do not paste `SOLANA_ANCHOR_SECRET_KEY` into chat, tickets, docs, or frontend
  code.
- Keep a private backup of the signer secret if the signer must be recoverable.
- Rotate the signer before public launch if the key has been exposed outside the
  backend environment.
