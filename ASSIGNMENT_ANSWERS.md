# Dino Ventures Backend Assignment — Answers & Design Decisions

This document answers all questions and explains the design choices made for the Internal Wallet Service.

---

## 1. How to Spin Up the Database and Run the Seed Script

### Option A: Docker (Recommended)

```bash
docker-compose up --build
```

This starts PostgreSQL, runs the migration and seed script, and starts the app. The database is ready and seeded automatically.

### Option B: Manual Setup

**Prerequisites:** Node.js 18+, PostgreSQL 14+

**Step 1 — Create the database:**
```bash
createdb wallet_db
```

**Step 2 — Set environment:**
```bash
cp .env.example .env
# Edit .env if needed. Default: postgresql://postgres:postgres@localhost:5432/wallet_db
```

**Step 3 — Run migration:**
```bash
npm run migrate
```
This executes `migrations/001_init_schema.sql` and creates the tables.

**Step 4 — Run seed:**
```bash
# Linux/macOS
psql $DATABASE_URL -f seed.sql

# Windows (PowerShell)
psql $env:DATABASE_URL -f seed.sql
```

Or use the setup script:
```bash
./setup.sh          # Linux/macOS
.\setup.ps1         # Windows
```

**Step 5 — Start the app:**
```bash
npm run dev
```

---

## 2. Technology Choice and Why

| Choice | What I Chose | Why |
|--------|--------------|-----|
| **Backend** | Node.js + TypeScript | Node.js is widely used for APIs and handles I/O well. TypeScript adds type safety for balances and amounts, reducing logic bugs. |
| **Framework** | Express | Simple and well-known. Enough for REST APIs and fits the scope without extra complexity. |
| **Database** | PostgreSQL | Strong ACID guarantees, row-level locking, and JSONB. Suited to financial-style workloads and audit trails. |
| **DB Driver** | node-pg (pg) | Lightweight, no ORM. Full control over SQL and transactions, which is important for the wallet logic. |

**Why not Python/FastAPI?** — Node.js/Express was chosen for familiarity and ecosystem fit. The design would translate cleanly to Python or other stacks.

**Why not an ORM?** — For this use case, explicit SQL and transactions make locking and ledger logic easier to reason about and optimize.

---

## 3. Strategy for Handling Concurrency

### Problem
Multiple requests can update the same wallet at the same time, leading to incorrect balances or lost updates.

### Approach

1. **Row-level locking (`SELECT ... FOR UPDATE`)**  
   Before updating any wallet, its row is locked in the same transaction. Other transactions wait until the lock is released.

2. **Lock ordering (deadlock avoidance)**  
   Wallets are always locked in ascending ID order. For a transfer from wallet A to wallet B, we lock `min(A, B)` first, then `max(A, B)`. This prevents circular waits and deadlocks.

3. **ACID transactions**  
   Balance updates and ledger entries are done in a single transaction. Either everything commits or nothing does.

4. **Balance check after lock**  
   After acquiring the lock, we re-read the balance and verify it is sufficient before debiting. This handles races where the balance changes between the initial read and the lock.

5. **Database constraint**  
   `CHECK (balance >= 0)` on the wallets table ensures no wallet can go negative, even under race conditions.

---

## 4. Idempotency

### Problem
Clients may retry the same request (e.g. due to timeouts or network issues). Without idempotency, a retry could apply the same credit or debit twice.

### Approach

1. **Client sends `X-Idempotency-Key`**  
   Each mutating request must include a unique key (e.g. UUID) identifying that logical operation.

2. **Claim at start**  
   The first thing we do is `INSERT` the key with status "pending". If the insert fails (key already exists), someone else already processed or is processing it.

3. **Return cached response**  
   If the key already exists and has a stored response, we return that instead of processing again.

4. **Store result after processing**  
   After the operation completes, we `UPDATE` the row with the response status and body so future retries get the same result.

5. **409 if in progress**  
   If the key exists but is still "pending", we return 409 Conflict to indicate the request is already being processed.

---

## 5. Ledger-Based Architecture (Double-Entry)

### Why a Ledger?
Instead of only updating a balance column, every transaction creates immutable ledger entries. This provides:

- **Auditability** — Full history of debits and credits.
- **Integrity** — Each transaction has matching debit and credit; total movement per transaction sums to zero.
- **Debugging** — Easier to trace discrepancies and investigate issues.

### How It Works

- Each transfer creates two entries: one **debit** (negative amount) on the source wallet, one **credit** (positive amount) on the destination wallet.
- `ledger_entries` stores: `transaction_id`, `wallet_id`, `amount`, `entry_type`, `balance_after`, `description`, `metadata`.
- The `wallets.balance` column is updated for fast reads; ledger entries are the source of truth for history.

---

## 6. Deadlock Avoidance

### Problem
Transaction A locks wallet 1 then waits for wallet 5. Transaction B locks wallet 5 then waits for wallet 1. Deadlock.

### Approach
All locks are taken in a global order: always by ascending wallet ID. For any pair of wallets (A, B), we always lock `min(A.id, B.id)` first, then `max(A.id, B.id)`. That order is the same for all transactions, so no circular wait is possible.

---

## 7. Flow Design (Top-up, Bonus, Spend)

| Flow | Source | Destination | Purpose |
|------|--------|-------------|---------|
| **Top-up** | system:treasury | user wallet | User buys credits with real money |
| **Bonus** | system:treasury | user wallet | Free credits (referral, incentives) |
| **Spend** | user wallet | system:revenue | User spends credits in the app |

The Treasury is the source of credits. Revenue tracks credits spent. All flows use the same double-entry transfer logic.

---

## 8. Seed Data Summary

- **Asset types:** GOLD_COINS, DIAMONDS, LOYALTY_POINTS  
- **System wallets:** system:treasury (initial supply), system:revenue (0)  
- **Users:** user_001, user_002 with initial balances for each asset  

---

## 9. Demo Frontend

A minimal web UI is provided to exercise the API without curl or Postman:

- Select user_001 or user_002
- View balances
- Perform top-up, bonus, and spend
- Idempotency keys are auto-generated per action

Open `http://localhost:3000/` after starting the app.
