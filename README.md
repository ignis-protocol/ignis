<p align="center">
  <img src="frontend/ignis-mark.svg" width="96" alt="IGNIS logo">
</p>

<h1 align="center">IGNIS</h1>

<p align="center">
  <strong>Code without a face.</strong>
</p>

<p align="center">
  Trusted peer audited alpha for privacy-preserving code contribution. Blind review. Verifiable receipts. Solana mainnet proof anchoring.
</p>

<p align="center">
  <strong>IGNIS Token CA:</strong>
  <code>7ZQP69CJWaxwFSMPjL89tC5FQdLzyLXwqGynedRiGory</code>
</p>

<p align="center">
  <a href="https://ignis-protocol.com"><strong>Website</strong></a>
  &middot;
  <a href="https://ignis-protocol.com/terminal"><strong>Terminal</strong></a>
  &middot;
  <a href="https://api.ignis-protocol.com/health"><strong>API</strong></a>
  &middot;
  <a href="https://x.com/IgnisAgent_Ai"><strong>X</strong></a>
</p>

<p align="center">
  <img alt="Status" src="https://img.shields.io/badge/status-audited%20alpha-00ff41?style=for-the-badge&labelColor=080b10">
  <img alt="Protocol" src="https://img.shields.io/badge/protocol-privacy%20preserving%20code-a78bfa?style=for-the-badge&labelColor=080b10">
  <img alt="Layer" src="https://img.shields.io/badge/layer-Solana%20mainnet-2dd4bf?style=for-the-badge&labelColor=080b10">
</p>

---

## What IGNIS Is

IGNIS is a protocol for builders who want their code judged before their identity.

It lets a contributor submit work through an ephemeral identity, strip identifying metadata, route the sealed contribution through relays, and enter blind review. Accepted work builds portable signal that can later be anchored to Solana.

No resume. No clout. No follower count. Just the diff.

IGNIS is currently a trusted peer audited alpha. The recorded alpha scope is
clear with no critical or high blocker reported, and Phase 8D recovery and
rotation drill evidence is recorded. The official IGNIS token contract is
`7ZQP69CJWaxwFSMPjL89tC5FQdLzyLXwqGynedRiGory` on Solana.

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
| Website | Presents IGNIS as a privacy-preserving contribution protocol |
| Terminal | Interactive protocol interface for sessions, submissions, reviews, signal, and Solana status |
| API | Creates ephemeral sessions, stores sealed submissions, exposes review queue and signal state |
| Signal Layer | Tracks contribution quality without exposing the builder's public identity |
| Reviewer Console | Private short-lived reviewer sessions, blind queue, voting, and history |
| Proof Verifier | Public receipt integrity and Solana anchor verification |
| Solana Layer | Mainnet receipt anchoring and official IGNIS token reference |
| IGNIS Token | Official Solana contract: `7ZQP69CJWaxwFSMPjL89tC5FQdLzyLXwqGynedRiGory` |

---

## Live Audited Alpha

| Surface | URL |
|---|---|
| Website | https://ignis-protocol.com |
| Terminal | https://ignis-protocol.com/terminal |
| Sample Flow | https://ignis-protocol.com/terminal?sample=1 |
| Reviewer Console | https://ignis-protocol.com/reviewer |
| Proof Verifier | https://ignis-protocol.com/proof |
| Ops Status | https://ignis-protocol.com/ops |
| API Health | https://api.ignis-protocol.com/health |
| X | https://x.com/IgnisAgent_Ai |
| Token CA | `7ZQP69CJWaxwFSMPjL89tC5FQdLzyLXwqGynedRiGory` |

---

## Current Audited Alpha Status

Completed:

- Product rebrand to privacy-preserving code contribution.
- Premium frontend and terminal UI.
- Anonymous session API.
- Persistent alpha backend storage.
- Sealed submission API.
- Relay, review, signal, and Solana status endpoints.
- Real diff intake for pasted or uploaded `.diff` / `.patch` files.
- Backend metadata sanitizer with size, line, and binary payload validation.
- Sealed bundle storage with public hashes and encrypted diff/report payloads.
- AES-256-GCM encrypted bundle retention with key rotation support.
- Signed relay-hop receipts, request authentication, and nonce replay protection.
- Secret/malware heuristics and per-session submission quotas.
- Tamper-evident audit trail and reviewer key rotation grace window.
- Submission status endpoint for terminal follow-up checks.
- Reviewer console shows sanitized bundles and metadata reports without exposing identity fields.
- Terminal connected to backend API with local fallback.
- Short-lived reviewer sessions and private reviewer dashboard.
- Phantom sign-message authentication with nonce replay protection.
- Privacy-preserving wallet commitments.
- Verifiable proof receipts for accepted contributions.
- Solana mainnet memo anchoring with retry queue.
- Production mainnet anchor signer support.
- PostgreSQL storage support with JSON fallback.
- Three-hop production relay transport across Southeast Asia, Singapore, and Amsterdam.
- Public readiness dashboard and production-safe smoke test tooling.
- First-run sample diff flow for public users.
- Aggregate public product metrics without user-level tracking.
- Official IGNIS Solana token contract published:
  `7ZQP69CJWaxwFSMPjL89tC5FQdLzyLXwqGynedRiGory`.
- Trusted peer security and product-flow audit recorded as clear, with no
  critical or high blocker for the audited-alpha scope.
- Phase 8D recovery, restore, key-rotation, relay-rotation, and launch-decision
  evidence recorded.

---

## Terminal Commands

| Command | Description |
|---|---|
| `init` | Create an ephemeral local identity |
| `paste` | Open the diff intake panel |
| `upload` | Load a local `.diff` or `.patch` file into the terminal |
| `strip` | Sanitize the staged diff through the backend |
| `submit [repo]` | Create a sealed privacy-preserving submission |
| `status [submission]` | Check review/proof status for a sealed submission |
| `review` | Inspect the blind review queue |
| `signal` | Read contribution signal state |
| `network` | Inspect relay route state |
| `solana` | Read mainnet proof anchor state |
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
GET  /api/security
GET  /api/readiness
POST /api/sanitize
POST /api/submissions
GET  /api/submissions
GET  /api/submissions/:id
GET  /api/submissions/:id/status
GET  /api/reviews
GET  /api/reviews/:id
POST /api/reviews/:id/votes
POST /api/reviewer/session
GET  /api/reviewer/me
GET  /api/audit
POST /api/wallet/challenge
POST /api/wallet/verify
GET  /api/wallet/me
GET  /api/proofs
GET  /api/proofs/:id
POST /api/proofs/verify
POST /api/proofs/:id/anchor
GET  /api/signal
GET  /api/solana
GET  /api/public-metrics
```

Create an ephemeral session:

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
  "diff": "diff --git a/src/auth.js b/src/auth.js\n..."
}
```

Diff intake accepts unified diffs and patches. The backend rejects blank input,
oversized payloads, excessive line counts, and binary diff markers before a
bundle reaches blind review.

Cast a reviewer vote:

```bash
curl -X POST https://api.ignis-protocol.com/api/reviews/REVIEW_ID/votes \
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
| Proof Layer | Solana mainnet memo anchoring |

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
http://localhost:5173/terminal
```

Production smoke checks:

```bash
cd backend
npm run monitor:production
npm run smoke:production
```

The monitor script checks public HTTP endpoints from `monitoring/http-checks.json`.
The smoke script checks frontend routes, health, readiness, relay status, signal,
and Solana state without creating a submission. To run the full submit path
intentionally:

```bash
IGNIS_SMOKE_SUBMIT=1 npm run smoke:production
```

With the Solana mainnet signer active, strict smoke can require anchor signer
config:

```bash
IGNIS_SMOKE_REQUIRE_SOLANA=1 npm run smoke:production
```

Launch and audit prep:

- [Audit record](docs/AUDIT.md)
- [Audit prep package](docs/AUDIT_PREP.md)
- [Privacy exposure audit](docs/PRIVACY_EXPOSURE_AUDIT.md)
- [Launch copy pack](docs/LAUNCH_COPY.md)
- [User flow](docs/USER_FLOW.md)
- [Reviewer quickstart](docs/REVIEWER_QUICKSTART.md)
- [Launch readiness checklist](docs/LAUNCH_READINESS.md)
- [Incident response runbook](docs/INCIDENT_RESPONSE.md)
- [Monitoring plan](docs/MONITORING.md)
- [Operational drills](docs/DRILLS.md)
- [Public launch runbook](docs/PUBLIC_LAUNCH_RUNBOOK.md)
- [Reviewer operations](docs/REVIEWER_OPERATIONS.md)
- [Security hardening checklist](docs/SECURITY_HARDENING.md)
- [Public feedback template](docs/PUBLIC_FEEDBACK.md)
- [Solana signer handoff](docs/SOLANA_SIGNER.md)
- [Auditor request](docs/AUDITOR_REQUEST.md)
- [Public preview plan](docs/PUBLIC_PREVIEW_PLAN.md)
- [Monitoring check config](monitoring/http-checks.json)

---

## Roadmap

- [x] Product rebrand.
- [x] Premium website and terminal.
- [x] Backend Phase 1: foundation, storage, validation, health.
- [x] Backend Phase 2: anonymous sessions and sealed submissions.
- [x] Phase 3: blind review voting, quorum, and scoring.
- [x] Phase 4: reviewer console, wallet auth, proof receipts, PostgreSQL support, and Solana mainnet anchoring.
- [x] Phase 5: real diff intake, metadata sanitizer, sealed review bundles, and end-to-end review flow.
- [x] Phase 6: encrypted retention, signed relay transport, abuse controls, key rotation, and audit chain.
- [x] Phase 7: readiness dashboard, production smoke suite, ops docs, CORS cleanup, and public polish.
- [x] Phase 8A: audit prep package, launch checklist, incident response, and stricter smoke tooling.
- [x] Phase 8B: free-first public preview hardening, monitoring, launch runbook, reviewer operations, feedback intake, and security hardening.
- [x] Phase 8C: public user flow, reviewer onboarding, sample diff, CTA polish, and aggregate metrics.
- [x] Phase 8D: recovery drill evidence, optional formal third-party audit, and broader public launch decision.

---

<p align="center">
  <strong>IGNIS</strong><br>
  code without a face.
</p>
