import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';

const router: Router = Router();

/**
 * POST /api/auth/logout
 * For Zitadel-based auth, this just clears the client session.
 * The actual session is managed by Zitadel.
 */
router.post('/logout', requireAuth, async (_req: Request, res: Response) => {
  // With Zitadel SSO, logout is handled client-side via signoutRedirect()
  // This endpoint exists for backwards compatibility
  res.status(204).send();
});

/**
 * GET /api/auth/me
 * Get current authenticated user info.
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    employee: req.employee,
  });
});

export default router;
