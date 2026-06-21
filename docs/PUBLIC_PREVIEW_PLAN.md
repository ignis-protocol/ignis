# IGNIS Public Preview Plan

## Goals

- Validate the real contributor flow.
- Validate blind reviewer flow and quorum settlement.
- Confirm proof receipt UX is understandable.
- Find copy that overclaims privacy beyond the audited alpha scope.
- Observe spam, malformed diff, public support burden, and reviewer workload.

## Public Preview Model

Public preview is open for real product exploration. The product can be described
as audited alpha, while privacy claims remain scoped to implemented controls.

- Public users can open the product site, terminal, proof verifier, and ops
  dashboard.
- Reviewer access remains key-gated because reviewer actions affect proof
  receipts.
- Operators watch `/ops`, Railway, Vercel, GitHub issues, and public feedback.
- The official token contract may be shown as a reference. Staking, rewards,
  and incentive mechanics are out of scope.

## Entry Criteria

- `npm run smoke:production` passes.
- `/api/readiness` required checks pass.
- Reviewer keys are distributed privately to trusted reviewers.
- Public copy avoids guaranteed anonymity claims.
- Public feedback intake is ready.
- `/terminal`, `/reviewer`, `/proof`, and `/ops` load from clean extensionless
  routes.
- `docs/PUBLIC_LAUNCH_RUNBOOK.md`, `docs/REVIEWER_OPERATIONS.md`, and
  `docs/SECURITY_HARDENING.md` are current.

## Public Launch Window

Start as an audited alpha public preview. Keep launch messaging inside the
recorded audit scope.

## Flow

1. Contributor opens `/terminal`.
2. Contributor runs `init`.
3. Contributor pastes a harmless diff.
4. Contributor runs `strip`.
5. Contributor submits to `ignis-protocol/ignis`.
6. Operator records submission and review IDs.
7. Reviewers log into `/reviewer`.
8. Reviewers cast quorum votes.
9. Contributor or operator verifies receipt at `/proof`.
10. Feedback is recorded in `docs/PUBLIC_FEEDBACK.md` format.

## Public Ready Criteria

- No P0 security/privacy issue.
- No API or relay outage.
- At least three successful full flows.
- Reviewer quorum reaches settlement without manual API calls.
- Proof verifier can be understood without explanation.
- Ops dashboard remains `ready` with Solana signer active.

## No-Go Conditions

- Identity-bearing metadata appears in reviewer UI.
- Relay mode falls back to embedded.
- Audit chain becomes invalid.
- Reviewers cannot reach quorum.
- Users misunderstand the product as a token or reward system.
- Frontend copy claims guaranteed anonymity, untraceable submissions, or formal certification.
