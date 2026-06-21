# IGNIS User Flow

This is the public contributor flow for audited alpha users.

## Fastest Test Path

1. Open `https://ignis-protocol.com/terminal?sample=1`.
2. Run `init`.
3. Run `strip`.
4. Run `submit ignis-protocol/ignis`.
5. Copy the submission ID from the terminal.
6. Check it with `status <submission_id>`.
7. Wait for trusted reviewers to settle the blind review.
8. Run `proof` or open `https://ignis-protocol.com/proof`.

## Real Diff Path

1. Open `https://ignis-protocol.com/terminal`.
2. Run `init`.
3. Run `paste` or `upload`.
4. Stage a unified `.diff` or `.patch`.
5. Run `strip`.
6. Review the sanitizer report.
7. Run `submit owner/repo`.
8. Use `status`, `proof`, and `verify` for follow-up.

## User Does Not Need

- Reviewer key.
- Bankr account.
- Token wallet.
- Solana funds.
- GitHub OAuth.

## Optional Wallet

`wallet connect` is optional. It attaches a private wallet commitment to a
session. Submissions still work without Phantom.
