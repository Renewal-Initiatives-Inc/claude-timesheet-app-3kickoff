import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateAndSendAlerts } from '../../packages/backend/src/services/notification.service.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
