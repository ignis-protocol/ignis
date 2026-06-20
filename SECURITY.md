# Security Policy

IGNIS is privacy-sensitive software. Treat metadata leaks, relay bypasses, identity correlation, and reviewer deanonymization as security issues.

## Current Status

IGNIS is alpha software. The current app demonstrates the protocol surface and API shape, but it is not yet a production anonymity system.

Do not assume production-grade privacy until the following exist:

- Real metadata stripping tests.
- Sealed bundle validation.
- Relay transport hardening.
- Reviewer deanonymization protections.
- Solana proof program audit.
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
