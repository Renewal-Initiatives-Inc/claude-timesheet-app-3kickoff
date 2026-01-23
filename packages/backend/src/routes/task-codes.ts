import { Router, Request, Response } from 'express';
import { requireAuth, requireSupervisor } from '../middleware/auth.middleware.js';
import {
  listTaskCodes,
  getTaskCodeById,
  getTaskCodeByCode,
  createTaskCode,
  updateTaskCode,
  addRate,
  getRateHistory,
  getTaskCodesForEmployee,
  TaskCodeError,
} from '../services/task-code.service.js';
import { validate } from '../validation/auth.schema.js';
import {
  createTaskCodeSchema,
  updateTaskCodeSchema,
  addRateSchema,
  taskCodeListQuerySchema,
} from '../validation/task-code.schema.js';

const router = Router();

/**
 * GET /api/task-codes
 * List all task codes with optional filters.
 * Query params: isAgricultural, isHazardous, forAge, includeInactive, search
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const queryResult = taskCodeListQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: queryResult.error.errors,
      });
      return;
    }

    const { isAgricultural, isHazardous, forAge, includeInactive, search } = queryResult.data;

    const result = await listTaskCodes({
      isAgricultural: isAgricultural === 'true' ? true : isAgricultural === 'false' ? false : undefined,
      isHazardous: isHazardous === 'true' ? true : isHazardous === 'false' ? false : undefined,
      forAge,
      includeInactive: includeInactive === 'true',
      search,
    });

    res.json(result);
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/task-codes/for-employee/:employeeId
 * Get task codes filtered by employee's age.
 */
router.get('/for-employee/:employeeId', requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.params['employeeId'] as string;
    const result = await getTaskCodesForEmployee(employeeId);

    res.json(result);
  } catch (error) {
    if (error instanceof TaskCodeError) {
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
 * GET /api/task-codes/by-code/:code
 * Get a task code by its code string.
 */
router.get('/by-code/:code', requireAuth, async (req: Request, res: Response) => {
  try {
    const code = req.params['code'] as string;
    const taskCode = await getTaskCodeByCode(code);

    if (!taskCode) {
      res.status(404).json({
        error: 'TASK_CODE_NOT_FOUND',
        message: 'Task code not found',
      });
      return;
    }

    res.json({ taskCode });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/task-codes/:id
 * Get a single task code with rate history.
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const taskCode = await getTaskCodeById(id);

    if (!taskCode) {
      res.status(404).json({
        error: 'TASK_CODE_NOT_FOUND',
        message: 'Task code not found',
      });
      return;
    }

    res.json({ taskCode });
  } catch (error) {
    throw error;
  }
});

/**
 * POST /api/task-codes
 * Create a new task code with initial rate.
 * Supervisor only.
 */
router.post(
  '/',
  requireAuth,
  requireSupervisor,
  validate(createTaskCodeSchema),
  async (req: Request, res: Response) => {
    try {
      const taskCode = await createTaskCode(req.body);

      res.status(201).json({ taskCode });
    } catch (error) {
      if (error instanceof TaskCodeError) {
        const statusCode =
          error.code === 'CODE_ALREADY_EXISTS' ? 409 :
          error.code === 'INVALID_MIN_AGE' ? 400 :
          400;
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
 * PATCH /api/task-codes/:id
 * Update a task code.
 * Supervisor only. Code field cannot be changed.
 */
router.patch(
  '/:id',
  requireAuth,
  requireSupervisor,
  validate(updateTaskCodeSchema),
  async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      const taskCode = await updateTaskCode(id, req.body);

      res.json({ taskCode });
    } catch (error) {
      if (error instanceof TaskCodeError) {
        const statusCode =
          error.code === 'TASK_CODE_NOT_FOUND' ? 404 :
          error.code === 'INVALID_MIN_AGE' ? 400 :
          error.code === 'CODE_IMMUTABLE' ? 400 :
          400;
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
 * POST /api/task-codes/:id/rates
 * Add a new rate to a task code.
 * Supervisor only. Effective date cannot be in the past.
 */
router.post(
  '/:id/rates',
  requireAuth,
  requireSupervisor,
  validate(addRateSchema),
  async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      const rate = await addRate(id, req.body);

      res.status(201).json({ rate });
    } catch (error) {
      if (error instanceof TaskCodeError) {
        const statusCode =
          error.code === 'TASK_CODE_NOT_FOUND' ? 404 :
          error.code === 'INVALID_EFFECTIVE_DATE' ? 400 :
          400;
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
 * GET /api/task-codes/:id/rates
 * Get rate history for a task code.
 */
router.get('/:id/rates', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const rates = await getRateHistory(id);

    res.json({ rates });
  } catch (error) {
    if (error instanceof TaskCodeError) {
      const statusCode = error.code === 'TASK_CODE_NOT_FOUND' ? 404 : 400;
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
