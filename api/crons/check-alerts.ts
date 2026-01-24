import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAndSendAlerts } from '../../packages/backend/src/services/notification.service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST or GET requests (Vercel cron typically uses GET)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret to prevent unauthorized calls
  const cronSecret = process.env.CRON_SECRET;

  // Ensure CRON_SECRET is configured (prevent empty secret matching)
  if (!cronSecret || cronSecret.length < 16) {
    console.error('CRON_SECRET not configured or too short');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Unauthorized cron attempt:', {
      ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      timestamp: new Date().toISOString(),
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await generateAndSendAlerts();

    console.log('Cron job completed:', {
      alertCount: result.alertCount,
      emailsSent: result.emailsSent,
      errors: result.errors.length,
    });

    return res.status(200).json({
      success: true,
      alertsGenerated: result.alertCount,
      emailsSent: result.emailsSent,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
