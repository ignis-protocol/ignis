<p align="center">
  <img src="frontend/ignis-mark.svg" width="96" alt="IGNIS logo">
</p>

<h1 align="center">IGNIS</h1>

<p align="center">
  <strong>Code without a face.</strong>
</p>

<p align="center">
  Anonymous code contribution. Blind review. Verifiable receipts. Solana devnet proof anchoring.
</p>

<p align="center">
  <a href="https://ignis-lac-nine.vercel.app"><strong>Website</strong></a>
  ·
  <a href="https://ignis-lac-nine.vercel.app/terminal.html"><strong>Terminal</strong></a>
  ·
  <a href="https://ignis-production-1c71.up.railway.app/health"><strong>API</strong></a>
  ·
  <a href="https://x.com/IgnisAgent_Ai"><strong>X</strong></a>
</p>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/status-alpha-00ff41?style=for-the-badge&labelColor=080b10">
  <img alt="Protocol" src="https://img.shields.io/badge/protocol-anonymous%20code-a78bfa?style=for-the-badge&labelColor=080b10">
  <img alt="Layer" src="https://img.shields.io/badge/layer-Solana%20devnet-2dd4bf?style=for-the-badge&labelColor=080b10">
</p>

---

## What IGNIS Is

IGNIS is a protocol for builders who want their code judged before their identity.

It lets a contributor submit work through an ephemeral identity, strip identifying metadata, route the sealed contribution through relays, and enter blind review. Accepted work builds portable signal that can later be anchored to Solana.

No resume. No clout. No follower count. Just the diff.

---

## Product Flow

```text
Builder
  |
  v
Ephemeral identity
  |
  v
Metadata strip
  |
  v
Sealed submission
  |
  v
Relay route
  |
  v
Blind review
  |
  v
Signal score
  |
  v
Solana proof layer
```

---

## Core Product

| Product Surface | What it does |
|---|---|
| Website | Presents IGNIS as an anonymous contribution protocol |
| Terminal | Interactive protocol interface for sessions, submissions, reviews, signal, and Solana status |
| API | Creates anonymous sessions, stores sealed submissions, exposes review queue and signal state |
| Signal Layer | Tracks contribution quality without exposing the builder's public identity |
| Reviewer Console | Private short-lived reviewer sessions, blind queue, voting, and history |
| Proof Verifier | Public receipt integrity and Solana anchor verification |
| Solana Layer | Devnet receipt anchoring without a coin, staking, or rewards |

---

## Live Alpha

| Surface | URL |
|---|---|
| Website | https://ignis-lac-nine.vercel.app |
| Terminal | https://ignis-lac-nine.vercel.app/terminal.html |
| Reviewer Console | https://ignis-lac-nine.vercel.app/reviewer.html |
| Proof Verifier | https://ignis-lac-nine.vercel.app/proof.html |
| API Health | https://ignis-production-1c71.up.railway.app/health |
| X | https://x.com/IgnisAgent_Ai |

---

## Current Alpha Status

Completed:

- Product rebrand to anonymous code contribution.
- Premium frontend and terminal UI.
- Anonymous session API.
- Persistent alpha backend storage.
- Sealed submission API.
- Relay, review, signal, and Solana status endpoints.
- Terminal connected to backend API with local fallback.
- Short-lived reviewer sessions and private reviewer dashboard.
- Phantom sign-message authentication with nonce replay protection.
- Privacy-preserving wallet commitments.
- Verifiable proof receipts for accepted contributions.
- Solana devnet memo anchoring with retry queue.
- PostgreSQL storage support with JSON fallback.

Not done yet:

- Real metadata stripping CLI.
- Production relay transport and anonymity audit.
- Funded production devnet anchor signer.
- IGNIS SPL incentive layer.

---

## Terminal Commands

| Command | Description |
|---|---|
| `init` | Create an ephemeral anonymous identity |
| `strip [file]` | Simulate metadata stripping for a diff bundle |
| `submit [repo]` | Create a sealed anonymous submission |
| `review` | Inspect the blind review queue |
| `signal` | Read contribution signal state |
| `network` | Inspect relay route state |
| `solana` | Read devnet proof anchor state |
| `wallet connect` | Attempt Phantom/Solana wallet connection |
| `proof` | Inspect the accepted receipt for the current submission |
| `verify [proof]` | Verify receipt integrity and anchor state |

---

## API Surface

```text
GET  /health
POST /api/sessions
GET  /api/sessions/:id
GET  /api/relays
POST /api/submissions
GET  /api/submissions
GET  /api/submissions/:id
GET  /api/reviews
GET  /api/reviews/:id
POST /api/reviews/:id/votes
POST /api/reviewer/session
GET  /api/reviewer/me
POST /api/wallet/challenge
POST /api/wallet/verify
GET  /api/wallet/me
GET  /api/proofs
GET  /api/proofs/:id
POST /api/proofs/verify
POST /api/proofs/:id/anchor
GET  /api/signal
GET  /api/solana
```

Create an anonymous session:

```json
{
  "label": "terminal ephemeral identity",
  "public_key": "optional-client-key"
}
```

Create a sealed submission:

```json
{
  "session": "ash_ab12cd34ef",
  "repo": "owner/repo",
  "summary": "Refactor auth module and add regression tests",
  "metadata": {
    "author": "removed",
    "email": "removed"
  }
}
```

Cast a reviewer vote:

```bash
curl -X POST https://ignis-production-1c71.up.railway.app/api/reviews/REVIEW_ID/votes \
  -H "Content-Type: application/json" \
  -H "X-Reviewer-Key: YOUR_REVIEWER_KEY" \
  -d '{"decision":"accept","score":9,"note":"Tests pass and the change is scoped."}'
```

Reviewer keys are configured only on the backend through `REVIEWER_API_KEYS`.
The API stores reviewer fingerprints, blocks duplicate votes, and settles a review
after the configured odd-numbered quorum is reached. Partial decisions and scores
stay hidden until settlement; settled feedback is exposed without reviewer identity.

Wallet authentication uses an expiring nonce and Ed25519 `signMessage`. The wallet
address never enters the reviewer bundle. Accepted receipts contain only a salted,
private ownership commitment.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Backend | Node.js, Express |
| Storage | PostgreSQL with atomic JSON fallback |
| Deployment | Vercel frontend, Railway backend |
| Proof Layer | Solana devnet memo anchoring |

---

## Local Development

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Frontend:

```bash
python -m http.server 5173 --directory frontend
```

Open:

```text
http://localhost:5173
http://localhost:5173/terminal.html
```

---

## Roadmap

- [x] Product rebrand.
- [x] Premium website and terminal.
- [x] Backend Phase 1: foundation, storage, validation, health.
- [x] Backend Phase 2: anonymous sessions and sealed submissions.
- [x] Phase 3: blind review voting, quorum, and scoring.
- [x] Phase 4: reviewer console, wallet auth, proof receipts, PostgreSQL support, and Solana devnet anchor queue.
- [ ] Phase 5: production hardening, monitoring, and incentive design.

---

<p align="center">
  <strong>IGNIS</strong><br>
  code without a face.
</p>
