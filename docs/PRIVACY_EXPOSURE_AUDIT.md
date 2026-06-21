# IGNIS Privacy Exposure Audit

Recorded: 2026-06-21

## Result

No developer or operator IP address was found in the current source tree,
tracked assets, public page content, public API responses, DNS origin records,
or reachable Git content.

The public website resolves through Vercel and the API resolves through
Railway. Visitors see provider edge infrastructure, not a developer home or
workstation IP address.

## Audited Surfaces

- Current tracked source and static assets.
- Reachable Git history and tracked filenames.
- Public DNS records for the website and API.
- Frontend links, metadata, scripts, images, stylesheets, and forms.
- Public API serializers, errors, readiness data, and security status.
- Backend request logging and relay health responses.
- Local ignored protocol state for IP, email, user path, and raw wallet fields.
- Production dependency vulnerability report.

## Privacy Hardening Applied

- Removed passive Google Fonts requests and self-hosted the required fonts.
- Added a restrictive frontend Content Security Policy.
- Added `X-Frame-Options: DENY` to frontend, API, and relay responses.
- Added `Cache-Control: no-store` to API responses.
- Increased new capability identifiers from 48 bits to 128 bits.
- Removed internal relay receipts, encryption key identifiers, original hashes,
  and abuse reports from public submission serialization.
- Reduced public session lookup responses to lifecycle status only.
- Added IPv6 stripping alongside existing IPv4 stripping.
- Added regression coverage for passive third-party requests, security headers,
  identifier entropy, serializer redaction, and IP sanitization.
- Changed repository-local Git author configuration to a GitHub noreply address
  for future commits.

## Expected Infrastructure Processing

Vercel, Railway, DNS providers, and network carriers may process visitor IP
addresses as part of normal TLS termination, routing, abuse prevention, and
rate limiting. IGNIS does not expose those addresses through its public API or
application logs.

## Remaining Identity Metadata

Historical Git commits contain the previous Git author email address. Removing
that metadata requires rewriting published Git history and force-pushing the
repository. This is separate from IP exposure and should only be done as a
coordinated repository migration.

## Claim Boundary

This audit establishes that the deployed application does not publish the
developer IP and that submitted IPv4/IPv6 literals are sanitized. It does not
claim resistance against global traffic analysis, provider subpoenas, malware
on an operator device, or account-level correlation by hosting providers.
