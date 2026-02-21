

# ValidToken v0 — Community Consensus Service (MVP Spec)

## 1. Goal

Build a minimal web service that:

- Allows users to register EVM tokens (ETH / BSC)
- Allows wallet-based voting (`valid | risky | unknown`)
- Displays aggregated community consensus
- Does **not** perform automated scam detection
- Only records and aggregates community votes

Primary objective: **Ship a deployable, working service.**

---

## 2. Scope (Strict MVP Boundary)

### Included

- EVM chains only (`eth`, `bsc`)
- Wallet signature-based voting (1 wallet = 1 vote per token)
- Off-chain vote storage (Postgres)
- Public token result page
- Basic submission with optional evidence link
- Deployment to Vercel

### Excluded (Not allowed in MVP)

- On-chain governance
- Staking / weighted voting
- Automated rug detection logic
- Token auto-indexing
- Anti-bot protection
- Advanced UI/branding
- Multi-chain expansion beyond eth/bsc

---

## 3. Tech Stack

### Frontend
- Next.js (App Router)
- wagmi
- viem
- Tailwind (minimal usage)

### Backend
- Next.js Route Handlers (`/app/api/*`)
- Prisma ORM

### Database
- PostgreSQL (Supabase)

### Deployment
- Vercel (App + API)
- Supabase (Postgres DB)

---

## 4. Supported Chains

Enum:

```
eth
bsc
```

Token address format:
- Must be valid EVM address (`0x...`)
- Stored in lowercase

---

## 5. Data Model (Prisma)

```prisma
enum Chain {
  eth
  bsc
}

enum VoteChoice {
  valid
  risky
  unknown
}

model Token {
  id        String   @id @default(cuid())
  chain     Chain
  address   String
  createdAt DateTime @default(now())

  votes       Vote[]
  submissions Submission[]

  @@unique([chain, address])
}

model Submission {
  id        String   @id @default(cuid())
  tokenId   String
  token     Token    @relation(fields: [tokenId], references: [id])
  submitterWallet String
  evidenceUrl String?
  note      String?
  createdAt DateTime @default(now())
}

model Vote {
  id        String   @id @default(cuid())
  tokenId   String
  token     Token    @relation(fields: [tokenId], references: [id])
  voterWallet String
  choice    VoteChoice
  signature String
  message   String
  createdAt DateTime @default(now())

  @@unique([tokenId, voterWallet])
}
```

Normalization rules:
- `address` → lowercase before save
- `voterWallet` → lowercase before save

---

## 6. Voting Flow

### Step 1: Wallet connects

User connects EVM wallet (MetaMask).

---

### Step 2: Request nonce

`POST /api/auth/nonce`

Request:
```json
{ "wallet": "0xabc..." }
```

Response:
```json
{
  "nonce": "random-string",
  "issuedAt": "ISO_TIMESTAMP"
}
```

---

### Step 3: Construct message

Message format (EIP-191 string):

```
ValidToken Vote

Token: {chain}:{address}
Choice: {valid|risky|unknown}
Wallet: {walletAddress}
Nonce: {nonce}
IssuedAt: {isoTime}
```

User signs this message using `signMessage`.

---

### Step 4: Submit vote

`POST /api/votes`

```json
{
  "chain": "eth",
  "address": "0x...",
  "wallet": "0x...",
  "choice": "risky",
  "nonce": "...",
  "issuedAt": "...",
  "signature": "...",
  "message": "..."
}
```

Server validation:

1. Recover signer address from signature
2. Ensure recovered address === wallet
3. Ensure nonce is valid and unused
4. Upsert vote (`tokenId + wallet` unique)

---

## 7. Token Query API

`GET /api/tokens/:chain/:address`

Response:

```json
{
  "token": {
    "chain": "eth",
    "address": "0x..."
  },
  "consensus": {
    "total": 31,
    "valid": 10,
    "risky": 18,
    "unknown": 3,
    "label": "RISKY"
  }
}
```

### Label Logic

- Largest count wins
- Tie → UNKNOWN
- No votes → UNKNOWN

---

## 8. Pages

### `/`

- Chain selector (eth / bsc)
- Token address input
- “Check Token” button
- Redirect to `/t/{chain}/{address}`

---

### `/t/[chain]/[address]`

Sections:

1. Token Info
2. Consensus Bar (valid/risky/unknown)
3. Vote Panel
   - Connect wallet
   - 3 vote buttons
   - Show "My vote"

Optional:
- Submission button (evidence link + note)

---

## 9. UI Rules (Strict)

- Black/white + 1 accent color
- No custom fonts
- No animations
- No marketing landing page
- No branding decisions in MVP

This is a **functional tool**, not a polished product.

---

## 10. Security Constraints (Basic Only)

- Nonce must expire (recommended: 10 minutes)
- Nonce cannot be reused
- Address must be valid EVM format
- No claim of financial safety

Disclaimer required:

> “This reflects community consensus only. Not financial advice.”

---

## 11. Definition of Done (MVP Complete)

Service is considered complete when:

- [ ] Wallet can connect
- [ ] Vote can be signed
- [ ] Vote is stored in Postgres
- [ ] Refresh preserves votes
- [ ] Consensus calculation works
- [ ] Public URL works on Vercel
- [ ] README exists with API example

No further improvements required.

---

## 12. Future Expansion (Post-MVP)

- Weighted voting
- On-chain anchoring
- Token auto-indexing
- Reputation system
- Rate limiting
- Multi-chain expansion

Not allowed before MVP completion.