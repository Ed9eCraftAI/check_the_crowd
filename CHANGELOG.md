

# Changelog

All notable changes to this project will be documented in this file.

This project follows a simple versioning scheme:
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Fixes and improvements

---

## v0.1.1 - Patch Update (2026-02-24)

### Overview
Post-release stabilization and UX/security updates based on deployment feedback.

### Added

- DEX Screener metadata lookup integration
  - Token symbol/name now fetched and shown in Voting Token area
- Solana chain support for token register/check/vote target selection
- Login session API set (cookie-based)
  - `POST /api/auth/nonce`
  - `POST /api/auth/verify`
  - `GET /api/auth/session`
  - `DELETE /api/auth/session`

### Changed

- Vote flow migrated to session-auth model
  - Login requires one signature at auth step
  - `/api/votes` now validates auth cookie session before upsert
- DB model updated for verification tracking
  - `verificationMethod` added to `Vote` and `VoteHistory`
  - `signature`/`message` fields changed to nullable
- “NEW” badge window changed from 72 hours to 14 days
- Contract input UX improved with inline clear (`x`) button

### Security

- Server-issued, signed, httpOnly session cookie introduced (24h TTL)
- Nonce + signature verification moved to auth-verify step
- Vote write path no longer trusts wallet value from client body

### UX/Behavior

- Removed auto-disconnect logic that forcefully disconnected wallet after 24h
  - Session expiry is now handled by re-auth flow on action

---

## v0.1.0 - Initial Public Release (2026-02-24)

### Overview
First public MVP release of **Check The Crowd**.

Community-based token consensus tool.  
Before you buy, check the crowd.

---

### Added

- WalletConnect-based wallet authentication
- Signature-based login with nonce verification
- One wallet = one vote enforcement
- Vote change with confirmation modal
- Token registration (chain + contract address)
- Supported chains:
  - Ethereum
  - BSC
  - Solana
- “What’s Hot” token list
- Manual refresh support
- 2-minute automatic refresh interval
- Copy contract address button with toast feedback
- Vote state indicator (✓ Voted)
- Responsive layout (desktop & mobile)

---

### Community Signal Logic

- Minimum 5 total votes required to generate signal
- 70% dominance threshold to display “Community leaning”
- Below threshold shows neutral state
- Transparent vote counts displayed
- Non-accusatory, neutral labeling
- Community consensus only (no AI scoring)

---

### Security

- Nonce-based signature verification
- Replay attack prevention
- Wallet-signature mismatch rejection
- Unique vote constraint per wallet per token
- Unique token constraint (chain + address)
- Rate limiting with 429 response and Retry-After header

---

### Technical

- Next.js frontend
- Prisma ORM
- Supabase (PostgreSQL)
- Connection pooler for runtime
- Direct URL for migrations
- Enum-based vote state management

---

### Notes

- This is an early-stage MVP.
- No financial advice.
- Community-driven signals only.
- Future iterations will focus on stability, transparency, and data integrity.
