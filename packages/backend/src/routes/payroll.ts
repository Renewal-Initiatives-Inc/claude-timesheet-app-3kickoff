import { Router, Request, Response } from 'express';
import { requireAuth, requireSupervisor } from '../middleware/auth.middleware.js';
import { validate } from '../validation/auth.schema.js';
import {
  getPayrollRecord,
  listPayrollRecords,
  recalculatePayroll,
  markPayrollExported,
  PayrollError,
} from '../services/payroll.service.js';
import {
  payrollReportQuerySchema,
  payrollExportSchema,
} from '../validation/payroll.schema.js';
import { generatePayrollCSV, generatePayrollFilename } from '../utils/payroll-export.js';

const router = Router();

// All routes require authentication and supervisor role
router.use(requireAuth);
router.use(requireSupervisor);

/**
 * GET /api/payroll/timesheet/:timesheetId
 * Get payroll record for a specific timesheet.
 */
router.get('/timesheet/:timesheetId', async (req: Request, res: Response) => {
  try {
    const timesheetId = req.params['timesheetId'] as string;

    const record = await getPayrollRecord(timesheetId);

    if (!record) {
      res.status(404).json({
        error: 'PAYROLL_NOT_FOUND',
        message: 'No payroll record found for this timesheet',
      });
      return;
    }

    res.json({ payroll: record });
  } catch (error) {
    if (error instanceof PayrollError) {
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
 * GET /api/payroll/report
 * List payroll records with filters.
 * Query params: startDate, endDate (required), employeeId (optional)
 */
router.get('/report', async (req: Request, res: Response) => {
  try {
    const queryResult = payrollReportQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: queryResult.error.errors,
      });
      return;
    }

    const { startDate, endDate, employeeId } = queryResult.data;
    const records = await listPayrollRecords({ startDate, endDate, employeeId });

    // Calculate summary totals
    const summary = {
      totalRecords: records.length,
      totalAgriculturalHours: 0,
      totalAgriculturalEarnings: 0,
      totalNonAgriculturalHours: 0,
      totalNonAgriculturalEarnings: 0,
      totalOvertimeHours: 0,
      totalOvertimeEarnings: 0,
      totalEarnings: 0,
    };

    for (const record of records) {
      summary.totalAgriculturalHours += parseFloat(record.agriculturalHours);
      summary.totalAgriculturalEarnings += parseFloat(record.agriculturalEarnings);
      summary.totalNonAgriculturalHours += parseFloat(record.nonAgriculturalHours);
      summary.totalNonAgriculturalEarnings += parseFloat(record.nonAgriculturalEarnings);
      summary.totalOvertimeHours += parseFloat(record.overtimeHours);
      summary.totalOvertimeEarnings += parseFloat(record.overtimeEarnings);
      summary.totalEarnings += parseFloat(record.totalEarnings);
    }

    res.json({
      records,
      summary: {
        ...summary,
        totalAgriculturalHours: summary.totalAgriculturalHours.toFixed(2),
        totalAgriculturalEarnings: summary.totalAgriculturalEarnings.toFixed(2),
        totalNonAgriculturalHours: summary.totalNonAgriculturalHours.toFixed(2),
        totalNonAgriculturalEarnings: summary.totalNonAgriculturalEarnings.toFixed(2),
        totalOvertimeHours: summary.totalOvertimeHours.toFixed(2),
        totalOvertimeEarnings: summary.totalOvertimeEarnings.toFixed(2),
        totalEarnings: summary.totalEarnings.toFixed(2),
      },
    });
  } catch (error) {
    if (error instanceof PayrollError) {
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
 * POST /api/payroll/export
 * Generate and download CSV export for payroll records.
 */
router.post(
  '/export',
  validate(payrollExportSchema),
  async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, employeeId } = req.body;

      const records = await listPayrollRecords({ startDate, endDate, employeeId });

      if (records.length === 0) {
        res.status(404).json({
          error: 'NO_RECORDS',
          message: 'No payroll records found for the specified date range',
        });
        return;
      }

      // Generate CSV
      const csv = generatePayrollCSV(records);
      const filename = generatePayrollFilename(startDate, endDate);

      // Mark records as exported
      const payrollIds = records.map((r) => r.id);
      await markPayrollExported(payrollIds);

      // Send CSV response
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      if (error instanceof PayrollError) {
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
 * POST /api/payroll/recalculate/:timesheetId
 * Recalculate payroll for an approved timesheet.
 */
router.post('/recalculate/:timesheetId', async (req: Request, res: Response) => {
  try {
    const timesheetId = req.params['timesheetId'] as string;

    const record = await recalculatePayroll(timesheetId);

    res.json({
      success: true,
      payroll: record,
      message: 'Payroll recalculated successfully',
    });
  } catch (error) {
    if (error instanceof PayrollError) {
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
    case 'TIMESHEET_NOT_FOUND':
    case 'PAYROLL_NOT_FOUND':
      return 404;
    case 'TIMESHEET_NOT_APPROVED':
    case 'NO_RATE_FOUND':
    case 'INVALID_DATE_RANGE':
      return 400;
    case 'PAYROLL_ALREADY_EXISTS':
      return 409;
    default:
      return 500;
  }
}

export default router;
