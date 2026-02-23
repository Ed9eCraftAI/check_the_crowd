# CheckTheCrowd API App

Next.js app (App Router) for community token consensus voting.

## Requirements

- Node.js 20+
- PostgreSQL (Supabase supported)

## Environment Variables

Create `.env` at repository root:

```bash
DATABASE_URL="postgresql://...@...:6543/postgres?pgbouncer=true&sslmode=require"
DIRECT_URL="postgresql://...@...:5432/postgres?sslmode=require"

CHECK_THE_CROWD_WALLETCONNECT_PROJECT_ID="your_walletconnect_project_id"
CHECK_THE_CROWD_X_ACCOUNT="@your_x_account"
CHECK_THE_CROWD_APP_URL="http://localhost:3000"
```

Notes:
- `DATABASE_URL`: runtime connection (pooler recommended).
- `DIRECT_URL`: Prisma schema/migration connection.

## Local Run

```bash
cd api
npm install
npm run postinstall
npm run dev
```

## Schema / Reset

From repository root:

```bash
npx --prefix api prisma db push --schema=prisma/schema.prisma --force-reset
cd api && npm run postinstall
```

## Vote Choices

- `appears_legit`
- `suspicious`
- `unclear`

## API Endpoints

- `POST /api/auth/nonce`
  - Request: `{ "wallet": "0x..." }`
  - Response: `{ walletHash, nonce, issuedAt, expiresAt }`

- `POST /api/tokens/register`
  - Request: `{ "chain": "eth" | "bsc", "address": "0x..." }`

- `GET /api/tokens/:chain/:address`
  - Returns token consensus

- `GET /api/tokens/hot?limit=20&page=1`
  - Returns hot token list with pagination

- `GET /api/votes?chain=...&address=...&wallet=...`
  - Returns existing vote for a wallet on a token

- `POST /api/votes`
  - Request fields:
    - `chain`, `address`, `wallet`, `choice`
    - `nonce`, `signature`, `message`
  - Server validates:
    - signed message format/content
    - recovered signer address
    - nonce validity + one-time use
  - Stores:
    - latest vote in `Vote`
    - full history in `VoteHistory`

## Security Notes

- One wallet, one active vote per token (`Vote` unique constraint).
- Full vote change history stored (`VoteHistory`).
- Wallet addresses are stored as SHA-256 hash in DB.
- Rate limiting is applied to nonce/vote/register/read routes.

## Vercel

- Set project Root Directory to `api`.
- Configure environment variables for both Preview and Production.
