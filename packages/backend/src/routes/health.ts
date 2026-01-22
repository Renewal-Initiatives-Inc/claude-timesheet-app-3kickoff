import { Router } from 'express';
import type { HealthResponse } from '@renewal/types';

const router = Router();

router.get('/health', (_req, res) => {
  const response: HealthResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
  res.json(response);
});

export default router;
