# IGNIS Phase 6 Threat Model

## Assets

- contributor identity and local metadata;
- sanitized code bundle before review settlement;
- reviewer identity, credentials, and votes;
- wallet ownership commitment;
- proof receipt integrity;
- relay and encryption keys.

## Trust Boundaries

1. Contributor browser to IGNIS API.
2. IGNIS API to relay origins.
3. Relay transport to encrypted bundle storage.
4. Encrypted storage to authenticated reviewer session.
5. Review settlement to proof and Solana anchor workers.

## Implemented Controls

| Threat | Control |
|---|---|
| Identity metadata in patches | Structured sanitizer and reviewer leak tests |
| Plaintext bundle database compromise | AES-256-GCM envelope encryption with authenticated context |
| Relay message tampering | Encrypted-envelope hash checks, HMAC-authenticated requests, and signed chained hop receipts |
| Relay replay | Timestamp window and nonce replay store |
| Credential or obvious malware submission | Secret and execution-pattern scanner |
| Submission flooding | Per-session hourly and daily quotas plus global rate limiting |
| Reviewer key compromise during rotation | Active and grace key sets with stable reviewer identity |
| Duplicate voting after rotation | Reviewer identity derived from label, not key material |
| Audit event modification | Canonical hash chain across audit events |
| Wallet signature replay | Single-use expiring challenges retained until expiry |
| Indefinite code retention | Configurable post-settlement encrypted bundle deletion |

## Residual Risks

- Embedded relay mode does not provide network-level source separation.
- Three HTTPS origins do not by themselves defeat timing or global traffic analysis.
- Sanitizers and malware heuristics can miss novel identity markers or payloads.
- Application memory contains decrypted bundles while an authenticated reviewer
  response is being generated.
- Operators with access to active vault keys and storage can decrypt retained bundles.
- PostgreSQL currently stores protocol state as one JSON document, which limits
  row-level isolation and high-volume concurrency.
- No independent security or privacy audit has been completed.

## Required Production Topology

- Three separately deployed HTTPS relay origins in Tokyo, Singapore, and Amsterdam.
- Distinct infrastructure accounts or operators where possible.
- Independent relay secrets with a documented rotation schedule.
- Railway backend connected only to PostgreSQL and the relay origins.
- Secrets managed in provider secret stores and excluded from frontend deployments.
- Alerting for relay failures, audit-chain failure, quota spikes, and repeated authentication failures.

## Claims Policy

Allowed:

- encrypted sealed bundles;
- signed relay receipts;
- blind reviewer surface;
- privacy-preserving wallet commitments.

Not allowed before an independent audit:

- guaranteed anonymity;
- untraceable submissions;
- traffic-analysis resistance;
- zero-knowledge review;
- production-audited privacy.
