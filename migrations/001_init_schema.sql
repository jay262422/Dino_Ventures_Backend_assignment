-- Dino Ventures Wallet Service - Schema
-- Double-entry ledger architecture for auditability

-- Asset types (e.g., Gold Coins, Diamonds, Loyalty Points)
CREATE TABLE IF NOT EXISTS asset_types (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Wallets: each user/system has one wallet per asset type
CREATE TABLE IF NOT EXISTS wallets (
  id            SERIAL PRIMARY KEY,
  owner_id      VARCHAR(100) NOT NULL,           -- user_id or 'system:<account_name>'
  owner_type    VARCHAR(20) NOT NULL CHECK (owner_type IN ('user', 'system')),
  asset_type_id INT NOT NULL REFERENCES asset_types(id),
  balance       BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, asset_type_id)
);

CREATE INDEX idx_wallets_owner ON wallets(owner_id);
CREATE INDEX idx_wallets_asset ON wallets(asset_type_id);

-- Ledger entries: double-entry (every transaction has debit + credit)
CREATE TABLE IF NOT EXISTS ledger_entries (
  id            BIGSERIAL PRIMARY KEY,
  transaction_id UUID NOT NULL,
  wallet_id     INT NOT NULL REFERENCES wallets(id),
  amount        BIGINT NOT NULL,                 -- positive = credit, negative = debit
  entry_type    VARCHAR(20) NOT NULL,            -- 'debit' | 'credit'
  balance_after BIGINT NOT NULL,
  description   VARCHAR(255),
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ledger_transaction ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_wallet ON ledger_entries(wallet_id);
CREATE INDEX idx_ledger_created ON ledger_entries(created_at);

-- Idempotency: prevent duplicate processing (0 = pending/processing)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  response_status INT NOT NULL DEFAULT 0,
  response_body   JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
