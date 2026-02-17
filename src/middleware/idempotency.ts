import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';

/**
 * Idempotency: Claim key at start. If already processed, return cached response.
 * If another request is processing, return 409.
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const key = req.headers['x-idempotency-key'] as string;
  if (!key || typeof key !== 'string' || key.trim().length === 0 || key.length > 255) {
    res.status(400).json({ error: 'Missing or invalid X-Idempotency-Key header' });
    return;
  }

  const client = await pool.connect();
  try {
    // Try to claim the key (0 = pending)
    const insertResult = await client.query(
      `INSERT INTO idempotency_keys (idempotency_key, response_status, response_body)
       VALUES ($1, 0, NULL)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING idempotency_key`,
      [key]
    );

    if (insertResult.rowCount && insertResult.rowCount > 0) {
      // We claimed it
      (req as any).idempotencyKey = key;
      next();
      return;
    }

    // Key already exists - check if processing complete
    const selectResult = await client.query(
      'SELECT response_status, response_body FROM idempotency_keys WHERE idempotency_key = $1',
      [key]
    );
    const row = selectResult.rows[0];
    if (row && row.response_status !== 0) {
      res.status(row.response_status).json(row.response_body);
      return;
    }
    res.status(409).json({ error: 'Request with this idempotency key is already in progress' });
  } finally {
    client.release();
  }
}

/**
 * Store idempotency response after successful processing.
 */
export async function storeIdempotencyResponse(
  key: string,
  status: number,
  body: object
): Promise<void> {
  await pool.query(
    `UPDATE idempotency_keys SET response_status = $1, response_body = $2 WHERE idempotency_key = $3`,
    [status, JSON.stringify(body), key]
  );
}
