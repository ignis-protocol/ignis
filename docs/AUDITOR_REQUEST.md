# Optional Formal Auditor Request

Subject: Formal security and privacy review for IGNIS, a privacy-preserving code contribution protocol

## Summary

IGNIS lets contributors submit sanitized code diffs through a relay path for blind
review. Accepted work receives a verifiable proof receipt and can be anchored to
Solana. The audited alpha scope is recorded, and a formal third-party review can
be used before making stronger privacy or anonymity claims.

## Scope

- Metadata sanitizer and reviewer-visible bundle surface.
- AES-256-GCM sealed bundle retention and key rotation.
- Three-hop relay transport, HMAC request authentication, nonce replay defense,
  and signed receipt chain.
- Reviewer authentication, key rotation, duplicate-vote prevention, and quorum
  settlement.
- Proof receipt integrity and wallet commitment privacy.
- Audit event hash chain.
- Rate limits, CORS, proxy trust, and abuse controls.
- Solana signer and memo anchoring design.

## Materials

- `docs/AUDIT_PREP.md`
- `docs/THREAT_MODEL.md`
- `docs/LAUNCH_READINESS.md`
- `docs/INCIDENT_RESPONSE.md`
- `docs/MONITORING.md`
- `backend/OPERATIONS.md`
- Source code in `backend/` and `frontend/`

## Expected Deliverables

- Findings with severity and reproduction steps.
- Privacy claim assessment.
- Relay topology and traffic-analysis risk assessment.
- Recommendations for public launch wording.
- Confirmation of unresolved risks that must remain documented.

## Known Limitations

- Relay services are not yet operated by independent third parties.
- Solana mainnet anchoring requires a funded dedicated signer and strict Solana
  smoke before live anchoring is claimed.
- Public preview abuse data is still early.
- Token contract publication is in scope only as a public reference; staking,
  rewards, and incentive mechanics are out of scope.
