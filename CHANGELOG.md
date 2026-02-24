

# Changelog

All notable changes to this project will be documented in this file.

This project follows a simple versioning scheme:
- MAJOR: Breaking changes
- MINOR: New features
- PATCH: Fixes and improvements

---

## v0.1 - Initial Public Release (2026-02-24)

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