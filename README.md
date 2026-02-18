# Dino Ventures - Internal Wallet Service

A high-traffic internal wallet service for application credits (e.g., Gold Coins, Loyalty Points). Built with **Node.js**, **TypeScript**, **Express**, and **PostgreSQL**.

> **Assignment answers:** See [ASSIGNMENT_ANSWERS.md](./ASSIGNMENT_ANSWERS.md) for detailed answers to setup, technology choices, concurrency strategy, idempotency, ledger design, and other design decisions.

## Features

- **Double-entry ledger** for full auditability
- **Idempotency** on all mutating operations (top-up, bonus, spend)
- **Concurrency-safe** with row-level locking and consistent lock ordering to avoid deadlocks
- **ACID transactions** for data integrity

## Quick Start (Docker)

```bash
# Build and run everything (DB + app + migrations + seed)
docker-compose up --build

# API + Demo UI at http://localhost:3000
```

## Demo Frontend (MVP Prototype)

A minimal web UI is included to demonstrate the wallet flows without using curl or Postman.

- **View balance** for user_001 or user_002
- **Top-up**, **Bonus**, and **Spend** with forms
- Idempotency keys are auto-generated per request

After starting the app, open **http://localhost:3000/** in your browser.

## Deploy (Live URL)

Deploy to **Render** for a live URL. See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions.

> **Live URL:** _Add your Render URL here after deployment (e.g. `https://wallet-service-xxxx.onrender.com`)_

## Manual Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Install dependencies

```bash
npm install
```

### 2. Create database and set env

```bash
createdb wallet_db
cp .env.example .env
# Edit .env if needed (default: postgresql://postgres:postgres@localhost:5432/wallet_db)
```

### 3. Run migration and seed

```bash
npm run migrate
npm run seed
```

Or use the setup script:

```bash
# Linux/macOS
chmod +x setup.sh && ./setup.sh

# Windows (PowerShell)
.\setup.ps1
```

### 4. Start the app

```bash
npm run dev   # development (ts-node-dev)
# or
npm run build && npm start   # production
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/wallet/balance/:userId?asset=GOLD_COINS` | Get balance (optional asset filter) |
| POST | `/wallet/topup` | Top-up (purchase credits) |
| POST | `/wallet/bonus` | Bonus/incentive (free credits) |
| POST | `/wallet/spend` | Spend credits |

### Mutating endpoints require `X-Idempotency-Key` header

Example requests:

```bash
# Get balance
curl http://localhost:3000/wallet/balance/user_001
curl "http://localhost:3000/wallet/balance/user_001?asset=GOLD_COINS"

# Top-up (purchase)
curl -X POST http://localhost:3000/wallet/topup \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: unique-key-123" \
  -d '{"userId":"user_001","assetCode":"GOLD_COINS","amount":100,"paymentRef":"pay_abc"}'

# Bonus
curl -X POST http://localhost:3000/wallet/bonus \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: bonus-key-456" \
  -d '{"userId":"user_001","assetCode":"LOYALTY_POINTS","amount":50,"reason":"referral"}'

# Spend
curl -X POST http://localhost:3000/wallet/spend \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: spend-key-789" \
  -d '{"userId":"user_001","assetCode":"GOLD_COINS","amount":30,"description":"In-game item"}'
```

## Technology Choices

- **Node.js + TypeScript + Express**: Fast, widely used, strong typing for financial logic
- **PostgreSQL**: ACID, row-level locking, ideal for ledger workloads
- **node-pg**: Lightweight, full control over transactions and SQL

## Concurrency Strategy

1. **Row-level locking** – `SELECT ... FOR UPDATE` on wallets before balance changes
2. **Lock ordering** – Always acquire locks in ascending wallet ID order to prevent deadlocks
3. **Double-entry** – Each transaction creates debit + credit ledger entries; sum is zero per transaction
4. **Idempotency** – Claim idempotency key at request start; duplicate requests return cached response

## Project Structure

```
├── frontend/                        # Demo UI (index.html, app.js)
├── migrations/001_init_schema.sql   # DB schema
├── seed.sql                         # Initial data
├── render.yaml                      # Render Blueprint (one-click deploy)
├── DEPLOY.md                        # Deployment instructions
├── setup.sh                         # Migration + seed script
├── src/
│   ├── config/
│   ├── db/                          # Pool, migrations
│   ├── middleware/                  # Idempotency
│   ├── routes/                      # Wallet API
│   ├── services/                    # Wallet logic
│   └── index.ts
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Seed Data

- **Asset types**: GOLD_COINS, DIAMONDS, LOYALTY_POINTS
- **System accounts**: system:treasury, system:revenue
- **Users**: user_001, user_002 (with initial balances)
