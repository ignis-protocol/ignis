# IGNIS Solana Mainnet Signer Handoff

The production anchor signer must be a dedicated Solana mainnet keypair used
only by the backend. Do not reuse a personal wallet, deployer wallet, or token
treasury wallet for receipt anchoring.

## Mainnet Signer

```text
<dedicated signer public key>
```

## Current Status

- Status: mainnet-ready in code.
- Production requires a funded mainnet signer in Railway.
- Strict production smoke must pass after the Railway env update.

## Production Anchor Signer

The `ignis` backend service uses:

```text
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_ANCHOR_SECRET_KEY=<base58 secret key or JSON byte array>
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
- Keep the signer funded with a small operational SOL balance for memo
  transaction fees.
- Keep a private backup of the signer secret if the signer must be recoverable.
- Rotate the signer immediately if the key has been exposed outside the backend
  environment.
