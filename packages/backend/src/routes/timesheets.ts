import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate } from '../validation/common.js';
import {
  getOrCreateTimesheet,
  getTimesheetById,
  getTimesheetWithEntries,
  getEmployeeTimesheets,
  validateTimesheetAccess,
  getWeekDates,
  TimesheetError,
} from '../services/timesheet.service.js';
import { checkCompliance, ComplianceError } from '../services/compliance/index.js';
import {
  createEntry,
  createMultipleEntries,
  updateEntry,
  deleteEntry,
  getEntryById,
  getDailyTotals,
  getWeeklyTotal,
  getHourLimitsForAge,
  previewEntryCompliance,
  TimesheetEntryError,
} from '../services/timesheet-entry.service.js';
import {
  createEntrySchema,
  bulkCreateEntriesSchema,
  updateEntrySchema,
  listTimesheetsQuerySchema,
  previewEntrySchema,
} from '../validation/timesheet.schema.js';
import { getTodayET, getWeekStartDate, isDefaultSchoolDay } from '../utils/timezone.js';
import { calculateAge, checkBirthdayInWeek, getWeeklyAges } from '../utils/age.js';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import type { TimesheetStatus } from '@renewal/types';
import { generateEntryCSV, generateEntryFilename, type EntryExportRow } from '../utils/entry-export.js';

const router: Router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/timesheets
 * List employee's timesheets.
 * Query params: status, limit, offset
 */
router.get('/', async (req: Request, res: Response) => {
  const queryResult = listTimesheetsQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid query parameters',
      details: queryResult.error.errors,
    });
    return;
  }

  const { status, limit, offset } = queryResult.data;

  // Convert 'all' status to undefined (no filter)
  let statusFilter: TimesheetStatus[] | undefined;
  if (status && status !== 'all') {
    statusFilter = [status as TimesheetStatus];
  }

  const result = await getEmployeeTimesheets(req.employee!.id, {
    status: statusFilter,
    limit,
    offset,
  });

  res.json(result);
});

/**
 * GET /api/timesheets/current
 * Get or create timesheet for current week.
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const weekStart = getWeekStartDate(getTodayET());
    const timesheet = await getOrCreateTimesheet(req.employee!.id, weekStart);
    const withEntries = await getTimesheetWithEntries(timesheet.id);

    if (!withEntries) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get timesheet with entries',
      });
      return;
    }

    // Add hour limits based on employee age
    const employeeAge = calculateAge(req.employee!.dateOfBirth, weekStart);
    const limits = getHourLimitsForAge(employeeAge);
    const birthdayInfo = checkBirthdayInWeek(req.employee!.dateOfBirth, weekStart);

    // Generate warnings
    const warnings: string[] = [];
    if (withEntries.totals.weekly >= limits.weeklyLimit * 0.8) {
      warnings.push(`Approaching weekly limit of ${limits.weeklyLimit} hours`);
    }
    for (const [date, hours] of Object.entries(withEntries.totals.daily)) {
      const dailyLimit =
        limits.dailyLimitSchoolDay && isDefaultSchoolDay(date)
          ? limits.dailyLimitSchoolDay
          : limits.dailyLimit;
      if (hours >= dailyLimit * 0.8) {
        warnings.push(`Approaching daily limit on ${date}`);
      }
    }

    res.json({
      ...withEntries,
      totals: {
        ...withEntries.totals,
        limits,
        warnings,
      },
      birthdayInWeek: birthdayInfo.hasBirthday
        ? {
            date: birthdayInfo.birthdayDate?.toISOString().split('T')[0],
            newAge: birthdayInfo.newAge,
          }
        : undefined,
    });
  } catch (error) {
    if (error instanceof TimesheetError) {
      const statusCode = error.code === 'EMPLOYEE_NOT_FOUND' ? 404 : 400;
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
 * GET /api/timesheets/week/:weekStartDate
 * Get or create timesheet for specific week.
 */
router.get('/week/:weekStartDate', async (req: Request, res: Response) => {
  try {
    const weekStartDate = req.params['weekStartDate'] as string;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStartDate)) {
      res.status(400).json({
        error: 'INVALID_DATE_FORMAT',
        message: 'Week start date must be in YYYY-MM-DD format',
      });
      return;
    }

    const timesheet = await getOrCreateTimesheet(req.employee!.id, weekStartDate);
    const withEntries = await getTimesheetWithEntries(timesheet.id);

    if (!withEntries) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to get timesheet with entries',
      });
      return;
    }

    // Add hour limits based on employee age
    const employeeAge = calculateAge(req.employee!.dateOfBirth, weekStartDate);
    const limits = getHourLimitsForAge(employeeAge);
    const birthdayInfo = checkBirthdayInWeek(req.employee!.dateOfBirth, weekStartDate);

    // Generate warnings
    const warnings: string[] = [];
    if (withEntries.totals.weekly >= limits.weeklyLimit * 0.8) {
      warnings.push(`Approaching weekly limit of ${limits.weeklyLimit} hours`);
    }
    for (const [date, hours] of Object.entries(withEntries.totals.daily)) {
      const dailyLimit =
        limits.dailyLimitSchoolDay && isDefaultSchoolDay(date)
          ? limits.dailyLimitSchoolDay
          : limits.dailyLimit;
      if (hours >= dailyLimit * 0.8) {
        warnings.push(`Approaching daily limit on ${date}`);
      }
    }

    res.json({
      ...withEntries,
      totals: {
        ...withEntries.totals,
        limits,
        warnings,
      },
      birthdayInWeek: birthdayInfo.hasBirthday
        ? {
            date: birthdayInfo.birthdayDate?.toISOString().split('T')[0],
            newAge: birthdayInfo.newAge,
          }
        : undefined,
    });
  } catch (error) {
    if (error instanceof TimesheetError) {
      const statusCode =
        error.code === 'EMPLOYEE_NOT_FOUND'
          ? 404
          : error.code === 'INVALID_WEEK_START_DATE'
            ? 400
            : 400;
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
 * GET /api/timesheets/:id
 * Get timesheet by ID with entries.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;

    // Verify access
    const hasAccess = await validateTimesheetAccess(id, req.employee!.id);
    if (!hasAccess) {
      res.status(403).json({
        error: 'TIMESHEET_ACCESS_DENIED',
        message: 'You do not have access to this timesheet',
      });
      return;
    }

    const withEntries = await getTimesheetWithEntries(id);

    if (!withEntries) {
      res.status(404).json({
        error: 'TIMESHEET_NOT_FOUND',
        message: 'Timesheet not found',
      });
      return;
    }

    // Add hour limits based on employee age
    const employeeAge = calculateAge(req.employee!.dateOfBirth, withEntries.weekStartDate);
    const limits = getHourLimitsForAge(employeeAge);
    const birthdayInfo = checkBirthdayInWeek(req.employee!.dateOfBirth, withEntries.weekStartDate);

    // Generate warnings
    const warnings: string[] = [];
    if (withEntries.totals.weekly >= limits.weeklyLimit * 0.8) {
      warnings.push(`Approaching weekly limit of ${limits.weeklyLimit} hours`);
    }
    for (const [date, hours] of Object.entries(withEntries.totals.daily)) {
      const dailyLimit =
        limits.dailyLimitSchoolDay && isDefaultSchoolDay(date)
          ? limits.dailyLimitSchoolDay
          : limits.dailyLimit;
      if (hours >= dailyLimit * 0.8) {
        warnings.push(`Approaching daily limit on ${date}`);
      }
    }

    res.json({
      ...withEntries,
      totals: {
        ...withEntries.totals,
        limits,
        warnings,
      },
      birthdayInWeek: birthdayInfo.hasBirthday
        ? {
            date: birthdayInfo.birthdayDate?.toISOString().split('T')[0],
            newAge: birthdayInfo.newAge,
          }
        : undefined,
    });
  } catch (error) {
    if (error instanceof TimesheetError) {
      const statusCode = error.code === 'TIMESHEET_NOT_FOUND' ? 404 : 400;
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
 * POST /api/timesheets/:id/entries
 * Add entry to timesheet.
 */
router.post('/:id/entries', validate(createEntrySchema), async (req: Request, res: Response) => {
  try {
    const timesheetId = req.params['id'] as string;

    // Verify access
    const hasAccess = await validateTimesheetAccess(timesheetId, req.employee!.id);
    if (!hasAccess) {
      res.status(403).json({
        error: 'TIMESHEET_ACCESS_DENIED',
        message: 'You do not have access to this timesheet',
      });
      return;
    }

    const entry = await createEntry(timesheetId, req.body);

    res.status(201).json({ entry });
  } catch (error) {
    if (error instanceof TimesheetError || error instanceof TimesheetEntryError) {
      const statusCode =
        error.code === 'TIMESHEET_NOT_FOUND'
          ? 404
          : error.code === 'ENTRY_NOT_FOUND'
            ? 404
            : error.code === 'TASK_CODE_NOT_FOUND'
              ? 404
              : error.code === 'TIMESHEET_NOT_EDITABLE'
                ? 400
                : 400;
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
 * POST /api/timesheets/:id/entries/bulk
 * Add multiple entries to timesheet at once (for multi-day drag).
 */
router.post(
  '/:id/entries/bulk',
  validate(bulkCreateEntriesSchema),
  async (req: Request, res: Response) => {
    try {
      const timesheetId = req.params['id'] as string;

      // Verify access
      const hasAccess = await validateTimesheetAccess(timesheetId, req.employee!.id);
      if (!hasAccess) {
        res.status(403).json({
          error: 'TIMESHEET_ACCESS_DENIED',
          message: 'You do not have access to this timesheet',
        });
        return;
      }

      const result = await createMultipleEntries(timesheetId, req.body.entries);

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof TimesheetError || error instanceof TimesheetEntryError) {
        const statusCode =
          error.code === 'TIMESHEET_NOT_FOUND'
            ? 404
            : error.code === 'TASK_CODE_NOT_FOUND'
              ? 404
              : error.code === 'TIMESHEET_NOT_EDITABLE'
                ? 400
                : 400;
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
 * POST /api/timesheets/:id/entries/preview
 * Preview compliance for a proposed entry without saving.
 * Used for real-time compliance feedback in timeline UI.
 */
router.post(
  '/:id/entries/preview',
  validate(previewEntrySchema),
  async (req: Request, res: Response) => {
    try {
      const timesheetId = req.params['id'] as string;

      // Verify access
      const hasAccess = await validateTimesheetAccess(timesheetId, req.employee!.id);
      if (!hasAccess) {
        res.status(403).json({
          error: 'TIMESHEET_ACCESS_DENIED',
          message: 'You do not have access to this timesheet',
        });
        return;
      }

      const preview = await previewEntryCompliance(timesheetId, req.body);

      res.json(preview);
    } catch (error) {
      if (error instanceof TimesheetError || error instanceof TimesheetEntryError) {
        const statusCode =
          error.code === 'TIMESHEET_NOT_FOUND'
            ? 404
            : error.code === 'TASK_CODE_NOT_FOUND'
              ? 404
              : 400;
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
 * PATCH /api/timesheets/:id/entries/:entryId
 * Update entry on timesheet.
 */
router.patch(
  '/:id/entries/:entryId',
  validate(updateEntrySchema),
  async (req: Request, res: Response) => {
    try {
      const timesheetId = req.params['id'] as string;
      const entryId = req.params['entryId'] as string;

      // Verify access
      const hasAccess = await validateTimesheetAccess(timesheetId, req.employee!.id);
      if (!hasAccess) {
        res.status(403).json({
          error: 'TIMESHEET_ACCESS_DENIED',
          message: 'You do not have access to this timesheet',
        });
        return;
      }

      // Verify entry belongs to timesheet
      const existingEntry = await getEntryById(entryId);
      if (!existingEntry || existingEntry.timesheetId !== timesheetId) {
        res.status(404).json({
          error: 'ENTRY_NOT_FOUND',
          message: 'Entry not found in this timesheet',
        });
        return;
      }

      const entry = await updateEntry(entryId, req.body);

      res.json({ entry });
    } catch (error) {
      if (error instanceof TimesheetError || error instanceof TimesheetEntryError) {
        const statusCode =
          error.code === 'TIMESHEET_NOT_FOUND'
            ? 404
            : error.code === 'ENTRY_NOT_FOUND'
              ? 404
              : error.code === 'TASK_CODE_NOT_FOUND'
                ? 404
                : error.code === 'TIMESHEET_NOT_EDITABLE'
                  ? 400
                  : 400;
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
 * DELETE /api/timesheets/:id/entries/:entryId
 * Delete entry from timesheet.
 */
router.delete('/:id/entries/:entryId', async (req: Request, res: Response) => {
  try {
    const timesheetId = req.params['id'] as string;
    const entryId = req.params['entryId'] as string;

    // Verify access
    const hasAccess = await validateTimesheetAccess(timesheetId, req.employee!.id);
    if (!hasAccess) {
      res.status(403).json({
        error: 'TIMESHEET_ACCESS_DENIED',
        message: 'You do not have access to this timesheet',
      });
      return;
    }

    // Verify entry belongs to timesheet
    const existingEntry = await getEntryById(entryId);
    if (!existingEntry || existingEntry.timesheetId !== timesheetId) {
      res.status(404).json({
        error: 'ENTRY_NOT_FOUND',
        message: 'Entry not found in this timesheet',
      });
      return;
    }

    await deleteEntry(entryId);

    res.status(204).send();
  } catch (error) {
    if (error instanceof TimesheetError || error instanceof TimesheetEntryError) {
      const statusCode =
        error.code === 'TIMESHEET_NOT_FOUND'
          ? 404
          : error.code === 'ENTRY_NOT_FOUND'
            ? 404
            : error.code === 'TIMESHEET_NOT_EDITABLE'
              ? 400
              : 400;
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
 * GET /api/timesheets/:id/entries/export
 * Export timesheet entries as CSV with notes.
 */
router.get('/:id/entries/export', async (req: Request, res: Response) => {
  try {
    const timesheetId = req.params['id'] as string;

    // Verify access
    const hasAccess = await validateTimesheetAccess(timesheetId, req.employee!.id);
    if (!hasAccess) {
      res.status(403).json({
        error: 'TIMESHEET_ACCESS_DENIED',
        message: 'You do not have access to this timesheet',
      });
      return;
    }

    const withEntries = await getTimesheetWithEntries(timesheetId);
    if (!withEntries) {
      res.status(404).json({
        error: 'TIMESHEET_NOT_FOUND',
        message: 'Timesheet not found',
      });
      return;
    }

    if (withEntries.entries.length === 0) {
      res.status(404).json({
        error: 'NO_ENTRIES',
        message: 'No entries to export',
      });
      return;
    }

    // Map entries to export rows
    const rows: EntryExportRow[] = withEntries.entries.map((entry) => {
      const hours = parseFloat(entry.hours);
      const rate = entry.taskCode.currentRate;
      return {
        workDate: entry.workDate,
        taskCode: entry.taskCode.code,
        taskName: entry.taskCode.name,
        startTime: entry.startTime,
        endTime: entry.endTime,
        hours: entry.hours,
        rate: rate.toFixed(2),
        earnings: (hours * rate).toFixed(2),
        notes: entry.notes,
      };
    });

    const csv = generateEntryCSV(rows);
    const filename = generateEntryFilename(withEntries.weekStartDate);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    if (error instanceof TimesheetError) {
      const statusCode = error.code === 'TIMESHEET_NOT_FOUND' ? 404 : 400;
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
 * GET /api/timesheets/:id/totals
 * Get daily and weekly totals for a timesheet.
 */
router.get('/:id/totals', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;

    // Verify access
    const hasAccess = await validateTimesheetAccess(id, req.employee!.id);
    if (!hasAccess) {
      res.status(403).json({
        error: 'TIMESHEET_ACCESS_DENIED',
        message: 'You do not have access to this timesheet',
      });
      return;
    }

    const timesheet = await getTimesheetById(id);
    if (!timesheet) {
      res.status(404).json({
        error: 'TIMESHEET_NOT_FOUND',
        message: 'Timesheet not found',
      });
      return;
    }

    const daily = await getDailyTotals(id);
    const weekly = await getWeeklyTotal(id);

    // Add hour limits based on employee age
    const employeeAge = calculateAge(req.employee!.dateOfBirth, timesheet.weekStartDate);
    const limits = getHourLimitsForAge(employeeAge);

    // Generate warnings
    const warnings: string[] = [];
    if (weekly >= limits.weeklyLimit * 0.8) {
      warnings.push(`Approaching weekly limit of ${limits.weeklyLimit} hours`);
    }
    for (const [date, hours] of Object.entries(daily)) {
      const dailyLimit =
        limits.dailyLimitSchoolDay && isDefaultSchoolDay(date)
          ? limits.dailyLimitSchoolDay
          : limits.dailyLimit;
      if (hours >= dailyLimit * 0.8) {
        warnings.push(`Approaching daily limit on ${date}`);
      }
    }

    res.json({
      daily,
      weekly,
      limits,
      warnings,
    });
  } catch (error) {
    if (error instanceof TimesheetError) {
      const statusCode = error.code === 'TIMESHEET_NOT_FOUND' ? 404 : 400;
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
 * GET /api/timesheets/:id/week-info
 * Get week information including dates, school day defaults, and employee ages.
 */
router.get('/:id/week-info', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;

    // Verify access
    const hasAccess = await validateTimesheetAccess(id, req.employee!.id);
    if (!hasAccess) {
      res.status(403).json({
        error: 'TIMESHEET_ACCESS_DENIED',
        message: 'You do not have access to this timesheet',
      });
      return;
    }

    const timesheet = await getTimesheetById(id);
    if (!timesheet) {
      res.status(404).json({
        error: 'TIMESHEET_NOT_FOUND',
        message: 'Timesheet not found',
      });
      return;
    }

    const weekDates = getWeekDates(timesheet.weekStartDate);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeklyAges = getWeeklyAges(req.employee!.dateOfBirth, timesheet.weekStartDate);
    const birthdayInfo = checkBirthdayInWeek(req.employee!.dateOfBirth, timesheet.weekStartDate);

    const weekEndDate = new Date(timesheet.weekStartDate + 'T00:00:00');
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    const dates = weekDates.map((date, index) => ({
      date,
      dayOfWeek: dayNames[index],
      isSchoolDay: isDefaultSchoolDay(date),
      employeeAge: weeklyAges.get(date) ?? 0,
    }));

    res.json({
      weekStartDate: timesheet.weekStartDate,
      weekEndDate: weekEndDate.toISOString().split('T')[0],
      dates,
      birthdayInWeek: birthdayInfo.hasBirthday
        ? {
            date: birthdayInfo.birthdayDate?.toISOString().split('T')[0],
            newAge: birthdayInfo.newAge,
          }
        : undefined,
    });
  } catch (error) {
    if (error instanceof TimesheetError) {
      const statusCode = error.code === 'TIMESHEET_NOT_FOUND' ? 404 : 400;
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
 * POST /api/timesheets/:id/submit
 * Submit timesheet for compliance check and supervisor review.
 */
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;

    // Verify access
    const hasAccess = await validateTimesheetAccess(id, req.employee!.id);
    if (!hasAccess) {
      res.status(403).json({
        error: 'TIMESHEET_ACCESS_DENIED',
        message: 'You do not have access to this timesheet',
      });
      return;
    }

    // Verify timesheet exists and is editable
    const timesheet = await getTimesheetById(id);
    if (!timesheet) {
      res.status(404).json({
        error: 'TIMESHEET_NOT_FOUND',
        message: 'Timesheet not found',
      });
      return;
    }

    if (timesheet.status !== 'open') {
      res.status(400).json({
        error: 'TIMESHEET_ALREADY_SUBMITTED',
        message: 'This timesheet has already been submitted',
      });
      return;
    }

    // Run compliance checks
    const complianceResult = await checkCompliance(id);

    if (!complianceResult.passed) {
      // Return detailed errors without changing status
      res.status(400).json({
        error: 'COMPLIANCE_CHECK_FAILED',
        message: 'Compliance check failed',
        passed: false,
        violations: complianceResult.violations,
        summary: {
          total: complianceResult.results.length,
          passed: complianceResult.passedRules.length,
          failed: complianceResult.failedRules.length,
          notApplicable: complianceResult.notApplicableRules.length,
        },
      });
      return;
    }

    // All checks passed - update status to submitted
    await db
      .update(schema.timesheets)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.timesheets.id, id));

    res.json({
      passed: true,
      message: 'Timesheet submitted successfully',
      status: 'submitted',
      complianceSummary: {
        total: complianceResult.results.length,
        passed: complianceResult.passedRules.length,
        notApplicable: complianceResult.notApplicableRules.length,
      },
    });
  } catch (error) {
    if (error instanceof TimesheetError) {
      const statusCode = error.code === 'TIMESHEET_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    if (error instanceof ComplianceError) {
      const statusCode = error.code === 'TIMESHEET_NOT_FOUND' ? 404 : 500;
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
 * POST /api/timesheets/:id/validate
 * Preview compliance check without submitting.
 */
router.post('/:id/validate', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;

    // Verify access
    const hasAccess = await validateTimesheetAccess(id, req.employee!.id);
    if (!hasAccess) {
      res.status(403).json({
        error: 'TIMESHEET_ACCESS_DENIED',
        message: 'You do not have access to this timesheet',
      });
      return;
    }

    // Run compliance preview (no logging)
    const { previewCompliance } = await import('../services/compliance/index.js');
    const result = await previewCompliance(id);

    res.json({
      valid: result.valid,
      violations: result.violations,
    });
  } catch (error) {
    if (error instanceof TimesheetError) {
      const statusCode = error.code === 'TIMESHEET_NOT_FOUND' ? 404 : 400;
      res.status(statusCode).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    if (error instanceof ComplianceError) {
      const statusCode = error.code === 'TIMESHEET_NOT_FOUND' ? 404 : 500;
      res.status(statusCode).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    throw error;
  }
});

export default router;
