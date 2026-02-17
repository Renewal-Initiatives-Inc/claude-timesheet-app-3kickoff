import { Router, Request, Response } from 'express';
import { requireAuth, requireSupervisor } from '../middleware/auth.middleware.js';
import { syncFundsFromFinancialSystem, getCachedFunds } from '../services/fund-sync.service.js';

const router: Router = Router();

/**
 * GET /api/funds
 * Returns cached funds for dropdown rendering.
 * Any authenticated user can read funds.
 */
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { funds, lastSyncedAt } = await getCachedFunds();
    res.json({ funds, lastSyncedAt });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch funds';
    res.status(500).json({ error: 'FETCH_FUNDS_FAILED', message });
  }
});

/**
 * POST /api/funds/sync
 * Sync funds from financial-system into local cache.
 * Supervisor-only (admin action).
 */
router.post('/sync', requireSupervisor, async (_req: Request, res: Response) => {
  try {
    const synced = await syncFundsFromFinancialSystem();
    res.json({ synced, message: `Synced ${synced} funds from financial-system` });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync funds';
    res.status(500).json({ error: 'SYNC_FUNDS_FAILED', message });
  }
});

export default router;
