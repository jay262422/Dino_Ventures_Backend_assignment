import { Router, Request, Response } from 'express';
import * as walletService from '../services/walletService';
import { idempotencyMiddleware, storeIdempotencyResponse } from '../middleware/idempotency';

const router = Router();

function getBody(req: Request): { userId?: string; assetCode?: string; amount?: number; paymentRef?: string; reason?: string; description?: string } {
  return req.body || {};
}

// Balance - no idempotency needed (read-only)
router.get('/balance/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const assetCode = req.query.asset as string;
    if (assetCode) {
      const balance = await walletService.getBalance(userId, assetCode);
      if (balance === null) {
        res.status(404).json({ error: 'Wallet not found' });
        return;
      }
      res.json({ userId, assetCode, balance });
    } else {
      const balances = await walletService.getAllBalances(userId);
      res.json({ userId, balances });
    }
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// 1. Top-up (requires idempotency)
router.post('/topup', idempotencyMiddleware, async (req: Request, res: Response) => {
  const idempotencyKey = (req as any).idempotencyKey;
  try {
    const { userId, assetCode, amount, paymentRef } = getBody(req);
    if (!userId || !assetCode || !amount || typeof amount !== 'number') {
      res.status(400).json({ error: 'userId, assetCode, and amount are required' });
      return;
    }
    const result = await walletService.topUp(userId, assetCode, amount, paymentRef);
    const body = { transactionId: result.transactionId, newBalance: result.newBalance };
    await storeIdempotencyResponse(idempotencyKey, 200, body);
    res.json(body);
  } catch (e) {
    const err = e as Error;
    const status = err.message === 'Wallet not found' ? 404 : err.message === 'Amount must be positive' ? 400 : 500;
    const body = { error: err.message };
    await storeIdempotencyResponse(idempotencyKey, status, body);
    res.status(status).json(body);
  }
});

// 2. Bonus (requires idempotency)
router.post('/bonus', idempotencyMiddleware, async (req: Request, res: Response) => {
  const idempotencyKey = (req as any).idempotencyKey;
  try {
    const { userId, assetCode, amount, reason } = getBody(req);
    if (!userId || !assetCode || !amount || typeof amount !== 'number') {
      res.status(400).json({ error: 'userId, assetCode, and amount are required' });
      return;
    }
    const result = await walletService.bonus(userId, assetCode, amount, reason);
    const body = { transactionId: result.transactionId, newBalance: result.newBalance };
    await storeIdempotencyResponse(idempotencyKey, 200, body);
    res.json(body);
  } catch (e) {
    const err = e as Error;
    const status = err.message === 'Wallet not found' ? 404 : err.message === 'Amount must be positive' ? 400 : 500;
    const body = { error: err.message };
    await storeIdempotencyResponse(idempotencyKey, status, body);
    res.status(status).json(body);
  }
});

// 3. Spend (requires idempotency)
router.post('/spend', idempotencyMiddleware, async (req: Request, res: Response) => {
  const idempotencyKey = (req as any).idempotencyKey;
  try {
    const { userId, assetCode, amount, description } = getBody(req);
    if (!userId || !assetCode || !amount || typeof amount !== 'number') {
      res.status(400).json({ error: 'userId, assetCode, and amount are required' });
      return;
    }
    const result = await walletService.spend(userId, assetCode, amount, description);
    const body = { transactionId: result.transactionId, newBalance: result.newBalance };
    await storeIdempotencyResponse(idempotencyKey, 200, body);
    res.json(body);
  } catch (e) {
    const err = e as Error;
    const status =
      err.message === 'Wallet not found'
        ? 404
        : err.message === 'Insufficient balance'
        ? 402
        : err.message === 'Amount must be positive'
        ? 400
        : 500;
    const body = { error: err.message };
    await storeIdempotencyResponse(idempotencyKey, status, body);
    res.status(status).json(body);
  }
});

export default router;
