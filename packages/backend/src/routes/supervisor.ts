import { Router, Request, Response } from 'express';
import { requireAuth, requireSupervisor } from '../middleware/auth.middleware.js';
import { validate } from '../validation/auth.schema.js';
import {
  getReviewQueue,
  getTimesheetForReview,
  getComplianceLogs,
  approveTimesheet,
  rejectTimesheet,
  unlockWeek,
  getPendingReviewCount,
  ReviewError,
} from '../services/review.service.js';
import {
  approveTimesheetSchema,
  rejectTimesheetSchema,
  unlockWeekSchema,
  reviewQueueQuerySchema,
} from '../validation/supervisor.schema.js';

const router = Router();

// All routes require authentication and supervisor role
router.use(requireAuth);
router.use(requireSupervisor);

/**
 * GET /api/supervisor/review-queue
 * List all timesheets awaiting review.
 * Query params: employeeId (optional filter)
 */
router.get('/review-queue', async (req: Request, res: Response) => {
  try {
    const queryResult = reviewQueueQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: queryResult.error.errors,
      });
      return;
    }

    const { employeeId } = queryResult.data;
    const result = await getReviewQueue({ employeeId });

    res.json(result);
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/supervisor/review-count
 * Get count of timesheets pending review.
 */
router.get('/review-count', async (req: Request, res: Response) => {
  try {
    const count = await getPendingReviewCount();
    res.json({ count });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/supervisor/review/:id
 * Get a timesheet for review with full details and compliance logs.
 */
router.get('/review/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const reviewData = await getTimesheetForReview(id);

    if (!reviewData) {
      res.status(404).json({
        error: 'TIMESHEET_NOT_FOUND',
        message: 'Timesheet not found',
      });
      return;
    }

    res.json(reviewData);
  } catch (error) {
    if (error instanceof ReviewError) {
      const statusCode = getStatusCodeForError(error.code);
      res.status(statusCode).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    throw error;
  }
});

/**
 * GET /api/supervisor/review/:id/compliance
 * Get compliance logs for a timesheet.
 */
router.get('/review/:id/compliance', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const logs = await getComplianceLogs(id);

    res.json({ logs });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/supervisor/review/:id/approve
 * Approve a submitted timesheet.
 */
router.post(
  '/review/:id/approve',
  validate(approveTimesheetSchema),
  async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      const { notes } = req.body;

      const timesheet = await approveTimesheet(id, req.employee!.id, notes);

      res.json({
        success: true,
        timesheet,
        message: 'Timesheet approved successfully',
      });
    } catch (error) {
      if (error instanceof ReviewError) {
        const statusCode = getStatusCodeForError(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }
);

/**
 * POST /api/supervisor/review/:id/reject
 * Reject a submitted timesheet.
 */
router.post(
  '/review/:id/reject',
  validate(rejectTimesheetSchema),
  async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      const { notes } = req.body;

      const timesheet = await rejectTimesheet(id, req.employee!.id, notes);

      res.json({
        success: true,
        timesheet,
        message: 'Timesheet returned to employee for revision',
      });
    } catch (error) {
      if (error instanceof ReviewError) {
        const statusCode = getStatusCodeForError(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }
);

/**
 * POST /api/supervisor/unlock-week
 * Unlock a historical week for an employee.
 */
router.post(
  '/unlock-week',
  validate(unlockWeekSchema),
  async (req: Request, res: Response) => {
    try {
      const { employeeId, weekStartDate } = req.body;

      const timesheet = await unlockWeek(employeeId, weekStartDate, req.employee!.id);

      res.json({
        success: true,
        timesheet,
        message: 'Week unlocked successfully',
      });
    } catch (error) {
      if (error instanceof ReviewError) {
        const statusCode = getStatusCodeForError(error.code);
        res.status(statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      throw error;
    }
  }
);

/**
 * Map error codes to HTTP status codes.
 */
function getStatusCodeForError(code: string): number {
  switch (code) {
    case 'TIMESHEET_NOT_FOUND':
    case 'EMPLOYEE_NOT_FOUND':
      return 404;
    case 'TIMESHEET_NOT_SUBMITTED':
    case 'NOTES_REQUIRED':
    case 'NOTES_TOO_SHORT':
    case 'INVALID_WEEK_START_DATE':
      return 400;
    case 'NOT_SUPERVISOR':
      return 403;
    default:
      return 500;
  }
}

export default router;
