# Ignis △
> Forge tokens from code.

> [!WARNING]
> **ALPHA** — $IGNIS token not yet deployed. All utilities (Launch Key, Repo Bond, Commit Tip, Proof of Builder) are fully implemented but run in **simulated mode** until `IGNIS_CONTRACT` is set in `.env`. Token launching via bankr.bot is fully functional today.

**Ignis** (Latin: *fire*) is a terminal-style token launchpad built on **gitlawb** × **Base**. Push your repo, forge a token via bankr.bot, bond $IGNIS to prove you're serious, and let contributors earn proportional to their commits.

**Live at:** ignis-protocol.xyz (coming soon)  
**Built on:** [gitlawb](https://gitlawb.com) · [Base](https://base.org) · [bankr.bot](https://bankr.bot)  
**GitHub:** [ignis-protocol/ignis](https://github.com/ignis-protocol/ignis)

---

## What makes Ignis different

Every other launchpad creates tokens from hype. Ignis creates tokens from code.

- Token is attached to a real repo with commit history
- Contributors earn $IGNIS proportional to merged PRs
- Builder bonds $IGNIS to their repo — if the repo dies, the bond is slashed
- Trust score from gitlawb DID is verifiable on-chain

*Code is the new capital.*

---

## $IGNIS Utility

| Utility | What it does |
|---|---|
| **△ Launch Key** | Must hold $IGNIS to forge a token on Ignis |
| **△ Repo Bond** | Bond $IGNIS to your repo — slashed if inactive 90 days |
| **△ Commit Currency** | Tip merged PRs with $IGNIS — on-chain proof of value |
| **△ Proof of Builder** | $IGNIS balance boosts your gitlawb trust score |

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Backend | Node.js + Express |
| Database | SQLite via sql.js (pure JS) |
| Chain | Base Mainnet (chain ID 8453) |
| Launch engine | bankr.bot Deploy API (Partner Key), Agent API fallback |
| Identity | gitlawb DID (Ed25519) |
| Wallet auth | EIP-191 personal_sign + session tokens |
| Bond watcher | GraphQL subscription + HTTP polling fallback |

---

## Project Structure

```
ignis/
├── README.md
├── CHANGELOG.md · CONTRIBUTING.md · SECURITY.md
├── frontend/
│   ├── index.html      ← landing page with fire animation
│   └── terminal.html   ← terminal app (all commands)
└── backend/
    ├── server.js       ← Express server + bond watcher boot
    ├── db.js           ← sql.js schema + all queries
    ├── package.json
    ├── .env.example
    ├── workers/
    │   └── bondWatcher.js
    └── routes/
        ├── auth.js       ← wallet challenge/verify/session
        ├── bankr.js      ← bankr.bot Deploy API + Agent API fallback
        ├── bond.js       ← repo bond CRUD + slash
        ├── gitlawb.js    ← gitlawb node proxy (repos, agents, trust, bounties)
        ├── launchkey.js  ← $IGNIS balance check
        ├── network.js    ← live Base RPC
        ├── stats.js      ← platform stats
        ├── tips.js       ← commit tipping + leaderboard
        └── tokens.js     ← token registry CRUD
```

---

## Quickstart

### Prerequisites
- Node.js 18+
- Bankr Partner Key for production no-gas launches, or a Bankr API key for fallback Agent API testing

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in BANKR_PARTNER_KEY for production deploys
# Optional fallback: BANKR_API_KEY

npm install
npm start
# → http://localhost:3001
```

### 2. Frontend

Open `frontend/index.html` in your browser. Update `API_BASE` at the top of each HTML file to point to your backend.

---

## Terminal Commands

| Command | Description |
|---|---|
| `forge` | Open 5-step token forge wizard via bankr.bot |
| `key [address]` | Check $IGNIS balance for Launch Key |
| `bond [repo]` | View / manage repo bonds |
| `tip [repo] [commit] [amt]` | Tip a commit with $IGNIS |
| `leaderboard` | Top contributors by $IGNIS earned |
| `wallet connect` | Connect MetaMask / Coinbase Wallet |
| `wallet auth` | Sign message — unlock bond & tip |
| `agents` | Live gitlawb agent DIDs + trust scores |
| `repos` | Live gitlawb repos + bond status |
| `bounties` | Open bounties from GitlawbBounties.sol |
| `did [did:gitlawb:...]` | Resolve DID → trust score |
| `network` | Live Base + gitlawb stats |
| `gas` | Live gas oracle |
| `tokens` | Browse Ignis token registry |
| `bankr status` | Check bankr.bot connection |
| `about` | What is Ignis |

---

## How Forge Works

```
1. wallet connect    → connect to Base Mainnet
2. wallet auth       → sign message, prove ownership
3. forge             → 5-step wizard:
   Step 1: connected wallet fee recipient (or Bankr API key fallback)
   Step 2: project name + description
   Step 3: symbol + socials + gitlawb repo
   Step 4: repo bond amount ($IGNIS to lock)
   Step 5: review → forge
4. bankr.bot launches → fair launch on Base, auto LP, no gas
5. repo bond created  → $IGNIS locked, watcher monitors
6. token registered   → saved to Ignis registry
```

---

## API Reference

```
GET  /api/auth/challenge/:address
POST /api/auth/verify
GET  /api/auth/me

GET  /api/tokens
POST /api/tokens
GET  /api/tokens/recent
GET  /api/tokens/:id
GET  /api/tokens/deployer/:address

POST /api/bankr/launch
GET  /api/bankr/job/:jobId
POST /api/bankr/save
GET  /api/bankr/status
POST /api/bankr/prompt

GET  /api/launchkey/check/:address
GET  /api/launchkey/threshold

POST /api/bond
GET  /api/bond
GET  /api/bond/:repo
POST /api/bond/ping
POST /api/bond/slash

POST /api/tips
GET  /api/tips/contributor/:address
GET  /api/tips/repo/:repo
GET  /api/tips/commit/:hash
GET  /api/tips/leaderboard

GET  /api/gitlawb/repos
GET  /api/gitlawb/agents
GET  /api/gitlawb/did/:did
GET  /api/gitlawb/trust/:did
GET  /api/gitlawb/bounties
GET  /api/gitlawb/network

GET  /api/network
GET  /api/network/gas
GET  /api/network/block/:n
GET  /api/network/tx/:hash
GET  /api/stats
GET  /health
```

---

## Environment Variables

```bash
PORT=3001
BANKR_API_KEY=bk_your_key_here    # from bankr.bot/api
BANKR_PARTNER_KEY=bk_ptr_your_key_here # preferred: Token Launch Deploy API
BASE_RPC_URL=https://mainnet.base.org
GITLAWB_NODE=https://node.gitlawb.com
CORS_ORIGIN=*

# After $IGNIS is deployed
IGNIS_CONTRACT=                    # $IGNIS token on Base
MIN_IGNIS_TO_LAUNCH=1000
MIN_BOND_IGNIS=100
MIN_TIP_IGNIS=1

# Optional
GITLAWB_BOUNTIES_CONTRACT=
BASESCAN_API_KEY=
BOND_POLL_MS=60000
```

---

## Deployment

### Backend — Railway / Render / Fly.io
```
Root Directory: backend
Start Command:  node server.js
```

### Frontend — Vercel / Netlify / IPFS
Update `API_BASE` in both HTML files to your backend URL, then deploy `frontend/` as static.

---

## Roadmap

- [x] Terminal UI + landing page with fire animation
- [x] bankr.bot integration (no gas, auto LP, 57% fee share)
- [x] Wallet connect + EIP-191 signature auth
- [x] Token registry (sql.js)
- [x] Launch Key utility
- [x] Repo Bond utility + auto-slash watcher
- [x] Commit Currency (tip system + leaderboard)
- [x] Proof of Builder (gitlawb trust score)
- [x] Live gitlawb data (repos, agents, bounties, DIDs)
- [ ] Deploy $IGNIS token → activate all on-chain utilities
- [ ] On-chain bond + tip transactions
- [ ] Uniswap V3 LP position viewer
- [ ] GitlawbGovernance.sol integration
- [ ] Farcaster Frame for token sharing

---

## Built on

- [gitlawb](https://gitlawb.com) — decentralized git for AI agents
- [Base](https://base.org) — Ethereum L2 (chain 8453)
- [bankr.bot](https://bankr.bot) — token launch engine
- [ethers.js](https://ethers.org) v5

---

*"Ignis — forge tokens from code. △"*
