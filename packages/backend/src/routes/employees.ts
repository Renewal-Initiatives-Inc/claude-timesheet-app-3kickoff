import { Router, Request, Response } from 'express';
import { requireAuth, requireSupervisor } from '../middleware/auth.middleware.js';
import {
  listEmployees,
  getEmployeeById,
  updateEmployee,
  archiveEmployee,
  getEmployeeDocuments,
  getRequiredDocuments,
  EmployeeError,
} from '../services/employee.service.js';
import { getDocumentationStatus } from '../services/documentation-status.service.js';
import {
  updateEmployeeSchema,
  employeeListQuerySchema,
} from '../validation/employee.schema.js';
import { validate } from '../validation/auth.schema.js';

const router: Router = Router();

/**
 * GET /api/employees
 * List all employees with documentation status summary.
 * Query params: status (active/archived/all), search (name/email)
 */
router.get('/', requireAuth, requireSupervisor, async (req: Request, res: Response) => {
  try {
    const queryResult = employeeListQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid query parameters',
        details: queryResult.error.errors,
      });
      return;
    }

    const employees = await listEmployees(queryResult.data);

    res.json({ employees });
  } catch (error) {
    throw error;
  }
});

/**
 * GET /api/employees/:id
 * Get a single employee with full documentation details.
 */
router.get('/:id', requireAuth, requireSupervisor, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const employee = await getEmployeeById(id);

    if (!employee) {
      res.status(404).json({
        error: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found',
      });
      return;
    }

    // Get full documentation details
    const documents = await getEmployeeDocuments(id);
    const requiredDocuments = getRequiredDocuments(employee.age);
    const documentationStatus = await getDocumentationStatus(id);

    res.json({
      employee,
      documents,
      requiredDocuments,
      documentationStatus,
    });
  } catch (error) {
    if (error instanceof EmployeeError) {
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
 * PATCH /api/employees/:id
 * Update an employee's name or email.
 * Cannot change dateOfBirth or isSupervisor after creation.
 */
router.patch(
  '/:id',
  requireAuth,
  requireSupervisor,
  validate(updateEmployeeSchema),
  async (req: Request, res: Response) => {
    try {
      const id = req.params['id'] as string;
      const employee = await updateEmployee(id, req.body);

      res.json({ employee });
    } catch (error) {
      if (error instanceof EmployeeError) {
        const statusCode =
          error.code === 'EMPLOYEE_NOT_FOUND' ? 404 :
          error.code === 'EMAIL_EXISTS' ? 409 :
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
 * DELETE /api/employees/:id
 * Archive an employee (soft delete).
 * Sets status to 'archived' - no hard delete.
 */
router.delete('/:id', requireAuth, requireSupervisor, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    await archiveEmployee(id, req.employee!.id);

    res.json({ message: 'Employee archived successfully' });
  } catch (error) {
    if (error instanceof EmployeeError) {
      const statusCode =
        error.code === 'EMPLOYEE_NOT_FOUND' ? 404 :
        error.code === 'CANNOT_ARCHIVE_SELF' ? 400 :
        error.code === 'INVALID_STATUS' ? 400 :
        400;
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
 * GET /api/employees/:id/documents
 * List all documents for an employee.
 */
router.get('/:id/documents', requireAuth, requireSupervisor, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const documents = await getEmployeeDocuments(id);

    res.json({ documents });
  } catch (error) {
    if (error instanceof EmployeeError) {
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
 * GET /api/employees/:id/documentation-status
 * Get documentation compliance status for an employee.
 * Can be accessed by any authenticated user (for self-check).
 */
router.get('/:id/documentation-status', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    // Allow employees to view their own status, supervisors can view anyone's
    if (!req.employee!.isSupervisor && req.employee!.id !== id) {
      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You can only view your own documentation status',
      });
      return;
    }

    const employee = await getEmployeeById(id);

    if (!employee) {
      res.status(404).json({
        error: 'EMPLOYEE_NOT_FOUND',
        message: 'Employee not found',
      });
      return;
    }

    const documentationStatus = await getDocumentationStatus(id);
    const requiredDocuments = getRequiredDocuments(employee.age);

    res.json({
      documentationStatus,
      requiredDocuments,
    });
  } catch (error) {
    if (error instanceof EmployeeError) {
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

export default router;
