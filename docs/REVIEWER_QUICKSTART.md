# IGNIS Reviewer Quickstart

Reviewer access is for trusted reviewers, not normal contributors.

## Role

Reviewers inspect sanitized diff bundles and vote on technical quality. They do
not see contributor identity, wallet address, country, social graph, original
local paths, or private remotes.

## Flow

1. Open `https://ignis-protocol.com/reviewer`.
2. Enter your reviewer key.
3. Select a queued sealed submission.
4. Read the summary, metadata report, and sanitized diff.
5. Score the work from 1 to 10.
6. Vote `Accept` or `Reject`.
7. Add a short technical note when useful.

## Decision Guide

Accept when:

- The patch is coherent and scoped.
- The diff appears technically useful.
- The sanitized bundle contains enough context to review.
- No obvious secret, malware, or spam pattern remains.

Reject when:

- The diff is spam, empty, or incoherent.
- The change is unsafe or malicious.
- The bundle lacks enough technical context.
- The submission tries to bypass metadata or abuse controls.

## Important Boundaries

- Do not ask contributors for identity.
- Do not vote based on social proof.
- Do not share reviewer keys.
- Do not treat audited alpha as guaranteed anonymity.
- Escalate suspicious payloads before voting if unsure.
