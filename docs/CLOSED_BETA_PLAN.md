# IGNIS Closed Beta Plan

## Goals

- Validate the real contributor flow.
- Validate blind reviewer flow and quorum settlement.
- Confirm proof receipt UX is understandable.
- Find copy that overclaims privacy before audit.
- Observe spam, malformed diff, and support burden.

## Cohort

Start with:

- 3 reviewers with private reviewer keys.
- 5 to 10 contributors who can submit harmless diffs.
- 1 operator watching `/ops`, Railway, Vercel, and feedback.

## Entry Criteria

- `npm run smoke:production` passes.
- `/api/readiness` required checks pass.
- Reviewer keys distributed privately.
- Public copy avoids guaranteed anonymity claims.
- Feedback template is ready for each tester.

## Test Window

Recommended first run: 48 hours.

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
10. Feedback is recorded in `docs/BETA_FEEDBACK.md` format.

## Exit Criteria

- No P0 security/privacy issue.
- No API or relay outage.
- At least three successful full flows.
- Reviewer quorum reaches settlement without manual API calls.
- Proof verifier can be understood without explanation.

## No-Go Conditions

- Identity-bearing metadata appears in reviewer UI.
- Relay mode falls back to embedded.
- Audit chain becomes invalid.
- Reviewers cannot reach quorum.
- Users misunderstand the product as a token or reward system.
