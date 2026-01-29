import { Router, Request, Response } from 'express';
import { requireAuth, requireSupervisor } from '../middleware/auth.middleware.js';
import {
  getComplianceAuditReport,
  getTimesheetHistoryReport,
  ReportError,
} from '../services/reports.service.js';
import {
  complianceAuditQuerySchema,
  complianceAuditExportSchema,
  timesheetHistoryQuerySchema,
} from '../validation/reports.schema.js';
import { generateComplianceAuditCSV } from '../utils/compliance-export.js';

const router: Router = Router();

// All routes require authentication and supervisor role
router.use(requireAuth);
router.use(requireSupervisor);

/**
 * GET /api/reports/compliance-audit
 * Get compliance audit records with filters.
 * Query params: startDate, endDate (required), employeeId, ageBand, result, ruleId (optional)
 */
router.get('/compliance-audit', async (req: Request, res: Response) => {
  try {
    const queryResult = complianceAuditQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: queryResult.error.errors,
      });
      return;
    }

    const filters = queryResult.data;
    const report = await getComplianceAuditReport(filters);

    res.json(report);
  } catch (error) {
    if (error instanceof ReportError) {
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
 * POST /api/reports/compliance-audit/export
 * Export compliance audit records as CSV.
 */
router.post('/compliance-audit/export', async (req: Request, res: Response) => {
  try {
    const bodyResult = complianceAuditExportSchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: bodyResult.error.errors,
      });
      return;
    }

    const filters = bodyResult.data;
    const report = await getComplianceAuditReport(filters);

    if (report.records.length === 0) {
      res.status(404).json({
        error: 'NO_DATA_FOUND',
        message: 'No compliance audit records found for the specified filters',
      });
      return;
    }

    // Generate CSV
    const csv = generateComplianceAuditCSV(report.records);
    const filename = `compliance-audit-${filters.startDate}-to-${filters.endDate}.csv`;

    // Send CSV response
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    if (error instanceof ReportError) {
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
 * GET /api/reports/timesheet-history
 * Get timesheet history records with filters.
 * Query params: startDate, endDate (required), employeeId, status, ageBand (optional)
 */
router.get('/timesheet-history', async (req: Request, res: Response) => {
  try {
    const queryResult = timesheetHistoryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: queryResult.error.errors,
      });
      return;
    }

    const filters = queryResult.data;
    const report = await getTimesheetHistoryReport(filters);

    res.json(report);
  } catch (error) {
    if (error instanceof ReportError) {
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
 * Map error codes to HTTP status codes.
 */
function getStatusCodeForError(code: string): number {
  switch (code) {
    case 'INVALID_DATE_RANGE':
      return 400;
    case 'NO_DATA_FOUND':
      return 404;
    default:
      return 500;
  }
}

export default router;
