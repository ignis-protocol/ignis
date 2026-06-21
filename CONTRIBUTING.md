# Contributing to IGNIS

IGNIS is a privacy-preserving code contribution protocol. Contributions should move the project toward metadata stripping, relay routing, blind review, portable signal, and Solana-native proof infrastructure.

## Areas That Need Work

- **Frontend** - protocol landing page, terminal UX, reviewer screens.
- **Relay API** - sealed submission flow, relay status, rate limits, abuse controls.
- **Metadata stripping** - sanitizer coverage, leak tests, and reviewer-safe bundle previews.
- **Blind review** - reviewer queues, scoring, quorum, audit trail.
- **Solana** - wallet auth, contribution receipts, and optional devnet anchoring.
- **Security** - privacy threat modeling, metadata leak tests, relay abuse prevention.

## Local Development

```bash
cd backend
npm install
npm start
```

Open:

```text
http://localhost:5173
http://localhost:5173/terminal
```

## Contribution Standard

- Keep public copy aligned with `code without a face.`
- Do not reintroduce the previous product terminology.
- Treat privacy claims carefully. Sanitized diff intake is live, but relay anonymity and Solana anchoring still need independent audit before stronger guarantees.
- Prefer small, inspectable changes with clear tests or manual verification notes.

## Commit Style

Use concise imperative commits:

```text
feat: add sealed submission endpoint
fix: prevent metadata field leak in strip preview
docs: update relay threat model
```
