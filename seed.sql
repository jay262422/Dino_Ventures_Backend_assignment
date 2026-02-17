-- Dino Ventures Wallet Service - Seed Data
-- Run after migrations. Usage: psql $DATABASE_URL -f seed.sql

-- 1. Asset Types
INSERT INTO asset_types (code, name, description) VALUES
  ('GOLD_COINS', 'Gold Coins', 'Primary in-game currency'),
  ('DIAMONDS', 'Diamonds', 'Premium currency for special items'),
  ('LOYALTY_POINTS', 'Loyalty Points', 'Reward points for engagement')
ON CONFLICT (code) DO NOTHING;

-- 2. System Accounts (source/destination for funds)
-- Treasury: holds funds from purchases (user pays real money -> credits go here first, then to user)
-- Revenue: tracks revenue from spends
INSERT INTO wallets (owner_id, owner_type, asset_type_id, balance) VALUES
  ('system:treasury', 'system', (SELECT id FROM asset_types WHERE code = 'GOLD_COINS'), 1000000),
  ('system:treasury', 'system', (SELECT id FROM asset_types WHERE code = 'DIAMONDS'), 50000),
  ('system:treasury', 'system', (SELECT id FROM asset_types WHERE code = 'LOYALTY_POINTS'), 100000),
  ('system:revenue', 'system', (SELECT id FROM asset_types WHERE code = 'GOLD_COINS'), 0),
  ('system:revenue', 'system', (SELECT id FROM asset_types WHERE code = 'DIAMONDS'), 0),
  ('system:revenue', 'system', (SELECT id FROM asset_types WHERE code = 'LOYALTY_POINTS'), 0)
ON CONFLICT (owner_id, asset_type_id) DO NOTHING;

-- 3. User Accounts (at least two users with initial balances)
INSERT INTO wallets (owner_id, owner_type, asset_type_id, balance) VALUES
  ('user_001', 'user', (SELECT id FROM asset_types WHERE code = 'GOLD_COINS'), 500),
  ('user_001', 'user', (SELECT id FROM asset_types WHERE code = 'DIAMONDS'), 10),
  ('user_001', 'user', (SELECT id FROM asset_types WHERE code = 'LOYALTY_POINTS'), 100),
  ('user_002', 'user', (SELECT id FROM asset_types WHERE code = 'GOLD_COINS'), 250),
  ('user_002', 'user', (SELECT id FROM asset_types WHERE code = 'DIAMONDS'), 5),
  ('user_002', 'user', (SELECT id FROM asset_types WHERE code = 'LOYALTY_POINTS'), 50)
ON CONFLICT (owner_id, asset_type_id) DO NOTHING;
