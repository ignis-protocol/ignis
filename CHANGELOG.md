# Changelog

## v0.1.0-alpha

### Rebrand

- Repositioned IGNIS as an anonymous code contribution protocol.
- Adopted the tagline: `code without a face.`
- Replaced the previous narrative with metadata stripping, relay routing, blind review, portable signal, and Solana-native proof/incentive planning.

### Frontend

- Rebuilt the landing page around the new protocol direction.
- Rebuilt the terminal UI around `init`, `strip`, `submit`, `review`, `signal`, `network`, `solana`, and `wallet connect`.
- Added a darker editorial/terminal identity with relay visuals, signal copy, and animated identity elements.

### Backend

- Replaced the public API surface with relay, submission, review, signal, and Solana status endpoints.
- Removed legacy routes and server boot behavior.
- Simplified backend dependencies to the active protocol API.

### Roadmap

- Implement real metadata stripping.
- Persist sealed submissions.
- Build blind reviewer workflow.
- Add Solana wallet authentication.
- Deploy the Solana signal proof program.
