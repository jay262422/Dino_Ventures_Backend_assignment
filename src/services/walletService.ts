import { PoolClient } from 'pg';
import { pool } from '../db/pool';

/** Transaction types */
export type TxType = 'topup' | 'bonus' | 'spend';

/** Lock ordering: always acquire locks in ascending wallet ID order to avoid deadlocks */
function sortWalletIdsForLock(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

/**
 * Get wallet by owner_id and asset code (no lock - used to fetch IDs for executeTransfer).
 */
async function getWallet(
  client: PoolClient,
  ownerId: string,
  assetCode: string
): Promise<{ id: number; balance: number } | null> {
  const result = await client.query(
    `SELECT w.id, w.balance FROM wallets w
     JOIN asset_types a ON w.asset_type_id = a.id
     WHERE w.owner_id = $1 AND a.code = $2`,
    [ownerId, assetCode]
  );
  return result.rows[0] ? { id: result.rows[0].id, balance: parseInt(result.rows[0].balance, 10) } : null;
}

/**
 * Execute double-entry transfer: debit from source, credit to destination.
 * Locks wallets in ID order to avoid deadlocks.
 */
async function executeTransfer(
  client: PoolClient,
  transactionId: string,
  fromWalletId: number,
  toWalletId: number,
  amount: number,
  description: string,
  metadata?: object
): Promise<void> {
  const [firstId, secondId] = sortWalletIdsForLock(fromWalletId, toWalletId);

  // Lock both wallets in consistent order (deadlock avoidance)
  const firstRow = await client.query('SELECT id, balance FROM wallets WHERE id = $1 FOR UPDATE', [firstId]);
  let secondRow = firstId !== secondId
    ? await client.query('SELECT id, balance FROM wallets WHERE id = $1 FOR UPDATE', [secondId])
    : firstRow;
  const fromRow = firstId === fromWalletId ? firstRow : secondRow;
  const fromBalance = parseInt(fromRow.rows[0].balance, 10);
  if (fromBalance < amount) throw new Error('Insufficient balance');

  // Debit source
  const fromResult = await client.query(
    'UPDATE wallets SET balance = balance - $1, updated_at = NOW() WHERE id = $2 RETURNING balance',
    [amount, fromWalletId]
  );
  const fromBalanceAfter = parseInt(fromResult.rows[0].balance, 10);

  // Credit destination
  const toResult = await client.query(
    'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2 RETURNING balance',
    [amount, toWalletId]
  );
  const toBalanceAfter = parseInt(toResult.rows[0].balance, 10);

  // Ledger: debit entry (negative amount)
  await client.query(
    `INSERT INTO ledger_entries (transaction_id, wallet_id, amount, entry_type, balance_after, description, metadata)
     VALUES ($1, $2, $3, 'debit', $4, $5, $6)`,
    [transactionId, fromWalletId, -amount, fromBalanceAfter, description, JSON.stringify(metadata || {})]
  );

  // Ledger: credit entry (positive amount)
  await client.query(
    `INSERT INTO ledger_entries (transaction_id, wallet_id, amount, entry_type, balance_after, description, metadata)
     VALUES ($1, $2, $3, 'credit', $4, $5, $6)`,
    [transactionId, toWalletId, amount, toBalanceAfter, description, JSON.stringify(metadata || {})]
  );
}

/**
 * 1. Top-up: User purchases credits. Treasury -> User wallet.
 */
export async function topUp(
  userId: string,
  assetCode: string,
  amount: number,
  paymentRef?: string
): Promise<{ transactionId: string; newBalance: number }> {
  if (amount <= 0) throw new Error('Amount must be positive');

  const client = await pool.connect();
  const transactionId = crypto.randomUUID();

  try {
    await client.query('BEGIN');

    const treasury = await getWallet(client, 'system:treasury', assetCode);
    const userWallet = await getWallet(client, userId, assetCode);

    if (!treasury || !userWallet) {
      await client.query('ROLLBACK');
      throw new Error('Wallet not found');
    }

    await executeTransfer(
      client,
      transactionId,
      treasury.id,
      userWallet.id,
      amount,
      `Top-up: purchased ${amount} ${assetCode}`,
      { payment_ref: paymentRef, type: 'topup' }
    );

    const newBalance = userWallet.balance + amount;
    await client.query('COMMIT');
    return { transactionId, newBalance };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * 2. Bonus: System issues free credits. Treasury -> User wallet.
 */
export async function bonus(
  userId: string,
  assetCode: string,
  amount: number,
  reason?: string
): Promise<{ transactionId: string; newBalance: number }> {
  if (amount <= 0) throw new Error('Amount must be positive');

  const client = await pool.connect();
  const transactionId = crypto.randomUUID();

  try {
    await client.query('BEGIN');

    const treasury = await getWallet(client, 'system:treasury', assetCode);
    const userWallet = await getWallet(client, userId, assetCode);

    if (!treasury || !userWallet) {
      await client.query('ROLLBACK');
      throw new Error('Wallet not found');
    }

    await executeTransfer(
      client,
      transactionId,
      treasury.id,
      userWallet.id,
      amount,
      `Bonus: ${reason || 'incentive'} - ${amount} ${assetCode}`,
      { reason, type: 'bonus' }
    );

    const newBalance = userWallet.balance + amount;
    await client.query('COMMIT');
    return { transactionId, newBalance };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * 3. Spend: User spends credits. User wallet -> Revenue.
 */
export async function spend(
  userId: string,
  assetCode: string,
  amount: number,
  description?: string
): Promise<{ transactionId: string; newBalance: number }> {
  if (amount <= 0) throw new Error('Amount must be positive');

  const client = await pool.connect();
  const transactionId = crypto.randomUUID();

  try {
    await client.query('BEGIN');

    const userWallet = await getWallet(client, userId, assetCode);
    const revenue = await getWallet(client, 'system:revenue', assetCode);

    if (!userWallet || !revenue) {
      await client.query('ROLLBACK');
      throw new Error('Wallet not found');
    }

    if (userWallet.balance < amount) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient balance');
    }

    await executeTransfer(
      client,
      transactionId,
      userWallet.id,
      revenue.id,
      amount,
      description || `Spend: ${amount} ${assetCode}`,
      { type: 'spend' }
    );

    const newBalance = userWallet.balance - amount;
    await client.query('COMMIT');
    return { transactionId, newBalance };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Get balance for a user and asset.
 */
export async function getBalance(userId: string, assetCode: string): Promise<number | null> {
  const result = await pool.query(
    `SELECT w.balance FROM wallets w
     JOIN asset_types a ON w.asset_type_id = a.id
     WHERE w.owner_id = $1 AND a.code = $2 AND w.owner_type = 'user'`,
    [userId, assetCode]
  );
  if (result.rows.length === 0) return null;
  return parseInt(result.rows[0].balance, 10);
}

/**
 * Get all balances for a user.
 */
export async function getAllBalances(userId: string): Promise<{ assetCode: string; balance: number }[]> {
  const result = await pool.query(
    `SELECT a.code AS asset_code, w.balance FROM wallets w
     JOIN asset_types a ON w.asset_type_id = a.id
     WHERE w.owner_id = $1 AND w.owner_type = 'user'`,
    [userId]
  );
  return result.rows.map((r) => ({ assetCode: r.asset_code, balance: parseInt(r.balance, 10) }));
}
