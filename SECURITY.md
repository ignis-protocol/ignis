# Security Policy

IGNIS is privacy-sensitive software. Treat metadata leaks, relay bypasses, identity correlation, and reviewer deanonymization as security issues.

## Current Status

IGNIS is alpha software. The current app demonstrates the protocol surface and API shape, but it is not yet a production anonymity system.

Do not assume production-grade privacy until the following exist:

- Real metadata stripping tests.
- Sealed bundle validation.
- Relay transport hardening.
- Independent reviewer deanonymization audit.
- Solana anchor architecture and signer key-management audit.
- Abuse and spam controls.

## Report Issues

Please open a private security advisory on GitHub or contact the maintainers directly.

Include:

- A concise description.
- Steps to reproduce.
- What identity or metadata can leak.
- Expected impact.
- Suggested mitigation if known.

## High Priority Findings

- Submission exposes author identity.
- Metadata stripping misses emails, usernames, hostnames, paths, timestamps, or remote URLs.
- Relay path can be bypassed.
- Reviewer can infer contributor identity from hidden fields.
- Solana proof links anonymous submissions to a public wallet without consent.
- API allows spam or stored payload abuse.

## Phase 4 Controls

- Wallet authentication uses one-time challenges with five-minute expiry.
- Used challenges cannot be replayed.
- Wallet addresses are removed from challenges after verification.
- Public receipts use salted ownership commitments, not address hashes.
- Reviewer keys are exchanged for short-lived signed sessions and are not stored permanently by the dashboard.
- Review queue and submission listing require reviewer authentication.
- Partial vote decisions and scores remain hidden until quorum settlement.
- Solana anchor failures enter a bounded exponential retry queue.

`AUTH_SECRET`, `REVIEWER_API_KEYS`, `DATABASE_URL`, and `SOLANA_ANCHOR_SECRET_KEY`
must only exist in backend environment variables.
