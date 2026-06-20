# IGNIS

> Code without a face.

IGNIS is an anonymous code contribution protocol. It strips identity from code submissions, routes sealed diff bundles through relays, sends work into blind review, and preserves contribution signal for a future Solana-native proof and incentive layer.

IGNIS is focused on anonymous code contribution, blind review, and Solana-native signal.

**GitHub:** [ignis-protocol/ignis](https://github.com/ignis-protocol/ignis)

---

## What IGNIS Does

IGNIS separates identity from contribution quality.

- Generate a local ephemeral identity.
- Strip metadata from a patch or diff bundle.
- Route the sealed bundle through relays.
- Let reviewers judge the code without profile context.
- Build portable signal from accepted work.
- Anchor accepted contribution proofs and incentives to Solana later.

The product principle is simple:

> No resume. No clout. No bias. Just the diff.

---

## Protocol Shape

| Layer | Purpose |
|---|---|
| Ephemeral Identity | Local-only session key for anonymous continuity |
| Metadata Strip | Removes author, email, timezone, host, path, and identity leaks |
| Relay Network | Routes sealed submissions through ingress, mixer, and exit relays |
| Blind Review | Reviewers see diff, tests, and context, not identity |
| Signal Score | Reputation based on accepted work and blind review quality |
| Solana Layer | Future contribution receipts, reviewer stakes, relay bonds, and rewards |

---

## Current Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML/CSS/JS |
| Backend | Node.js + Express |
| API State | In-memory alpha state |
| Settlement / Incentives | Solana planned |
| Wallet | Phantom/Solana support planned |

---

## Project Structure

```text
ignis/
+-- README.md
+-- frontend/
|   +-- index.html      # public landing page
|   +-- terminal.html   # protocol terminal UI
|   +-- favicon.svg
+-- backend/
    +-- server.js       # relay/submission/signal API
    +-- package.json
    +-- .env.example
```

Legacy route files may still exist while the product is being migrated, but the active public server surface is the anonymous code protocol API in `backend/server.js`.

---

## Quickstart

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Server starts on:

```text
http://localhost:3001
```

### Frontend

Open `frontend/index.html` or `frontend/terminal.html` directly in a browser, or deploy `frontend/` as static files.

---

## Terminal Commands

| Command | Description |
|---|---|
| `init` | Create a local ephemeral identity |
| `strip [file]` | Remove identifying metadata from a diff bundle |
| `submit [repo]` | Route a sealed submission through relays |
| `review` | Show blind review queue state |
| `signal` | Show portable signal score and Solana proof plan |
| `network` | Inspect relay path |
| `solana` | Show Solana proof/incentive layer status |
| `wallet connect` | Connect Phantom if available |
| `about` | Explain the new IGNIS direction |

---

## API

```text
GET  /health
GET  /api/relays
POST /api/submissions
GET  /api/submissions
GET  /api/reviews
GET  /api/signal
GET  /api/solana
```

### `POST /api/submissions`

```json
{
  "session": "ash_7f3a2b9c",
  "repo": "owner/repo",
  "summary": "Refactor auth module and add regression tests"
}
```

Response:

```json
{
  "ok": true,
  "submission": {
    "id": "sealed_ab12cd34",
    "metadata_removed": true,
    "review_mode": "blind",
    "solana_proof": "queued_after_acceptance"
  }
}
```

---

## Roadmap

- [x] Rebrand to anonymous code protocol
- [x] Replace public UI with relay/protocol UI
- [x] Replace active backend API with relay/submission/signal endpoints
- [ ] Implement real metadata stripping CLI
- [ ] Implement persistent sealed submission queue
- [ ] Add reviewer workflow and scoring
- [ ] Add Solana wallet auth
- [ ] Deploy Solana signal proof program
- [ ] Design IGNIS SPL incentive layer

---

## Tagline

**IGNIS - code without a face.**
