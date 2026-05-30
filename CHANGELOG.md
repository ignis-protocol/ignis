# Changelog

## [0.1.0-alpha] — 2025-05 — Initial Release

> ⚠️ **Alpha Release** — $IGNIS token not yet deployed. Token launching via bankr.bot is fully functional. All $IGNIS utilities implemented but run in simulated mode until `IGNIS_CONTRACT` is configured.

### Added
- Terminal UI with fire animation (Ignis △ identity)
- Landing page with flame effects, circuit grid, WAKE-style aesthetic
- 5-step token forge wizard via bankr.bot (no gas, auto LP, 57% fee share)
- Wallet connect (MetaMask / Coinbase Wallet) on Base Mainnet (8453)
- EIP-191 wallet signature auth — session-based, 24hr expiry
- Token registry — sql.js, searchable, paginated
- **△ Launch Key** — $IGNIS balance check for forge eligibility
- **△ Repo Bond** — bond $IGNIS to repo, slash after 90 days inactive
- **△ Commit Currency** — tip merged PRs with $IGNIS, leaderboard
- **△ Proof of Builder** — gitlawb trust score via DID resolution
- Bond watcher — GraphQL subscription + HTTP polling, auto-slash every 6hr
- gitlawb API proxy — live repos, agents, bounties, DID resolution
- Live Base RPC data — block, gas, tx lookup
- Platform stats endpoint

### Infrastructure
- Express backend with rate limiting (60 req/min)
- sql.js (pure JS SQLite) — no native compile, works everywhere
- `workers/bondWatcher.js` — starts with server, auto-reconnects
- `routes/auth.js` — challenge/verify/session management
- `.env.example` — all vars documented

## [Unreleased]
- Deploy $IGNIS token on Base → activate on-chain utilities
- On-chain bond + tip transactions
- Uniswap V3 LP position viewer
- GitlawbGovernance.sol integration
- Farcaster Frame for token sharing
