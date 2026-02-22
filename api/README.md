## Getting Started

Create `.env` (at repository root):

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="your_project_id"
```

Get project id from WalletConnect Cloud.

Then run:

```bash
npm run dev
```

## Dev Data Mode (No DB)

In local development, APIs use `data/dev-store.json` as storage.

- Register token: `POST /api/tokens/register`
- Vote: `POST /api/votes`
- Check consensus: `GET /api/tokens/:chain/:address`

Example:

```bash
curl -X POST http://localhost:3000/api/tokens/register \
  -H "Content-Type: application/json" \
  -d '{"chain":"eth","address":"0x1111111111111111111111111111111111111111"}'
```

```bash
curl -X POST http://localhost:3000/api/votes \
  -H "Content-Type: application/json" \
  -d '{
    "chain":"eth",
    "address":"0x1111111111111111111111111111111111111111",
    "wallet":"0x2222222222222222222222222222222222222222",
    "choice":"suspicious",
    "signature":"dev-signature",
    "message":"dev-message"
  }'
```

```bash
curl http://localhost:3000/api/tokens/eth/0x1111111111111111111111111111111111111111
```
