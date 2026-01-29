import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import { getActiveSession } from '../services/session.service.js';
import { getEmployeeById, EmployeePublic } from '../services/auth.service.js';

// Extend Express Request to include employee
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      employee?: EmployeePublic;
      token?: string;
    }
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Middleware that requires a valid authentication token.
 * Attaches employee to req.employee on success.
 * Returns 401 if token is invalid or session doesn't exist.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  // Verify JWT signature and expiration
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
    return;
  }

  // Verify session exists in database (not revoked)
  const session = await getActiveSession(token);
  if (!session) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session expired or revoked',
    });
    return;
  }

  // Get fresh employee data
  const employee = await getEmployeeById(payload.employeeId);
  if (!employee) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'User not found',
    });
    return;
  }

  // Check if employee is still active
  if (employee.status !== 'active') {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Account is not active',
    });
    return;
  }

  // Attach employee and token to request
  req.employee = employee;
  req.token = token;

  next();
}

/**
 * Middleware that requires supervisor role.
 * Must be used after requireAuth middleware.
 */
export async function requireSupervisor(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.employee) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
    return;
  }

  if (!req.employee.isSupervisor) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Supervisor access required',
    });
    return;
  }

  next();
}

/**
 * Middleware that optionally attaches authentication.
 * Does not fail if no token is present.
 * Useful for endpoints that behave differently for authenticated users.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  // Verify JWT
  const payload = verifyToken(token);
  if (!payload) {
    next();
    return;
  }

  // Verify session exists in database
  const session = await getActiveSession(token);
  if (!session) {
    next();
    return;
  }

  // Get employee data
  const employee = await getEmployeeById(payload.employeeId);
  if (employee && employee.status === 'active') {
    req.employee = employee;
    req.token = token;
  }

  next();
}
