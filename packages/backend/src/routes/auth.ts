import { Router, Request, Response } from 'express';
import {
  register,
  login,
  logout,
  AuthError,
} from '../services/auth.service.js';
import {
  requestPasswordReset,
  validateResetToken,
  completePasswordReset,
  PasswordResetError,
} from '../services/password-reset.service.js';
import { sendWelcomeEmail } from '../services/email.service.js';
import { requireAuth, requireSupervisor } from '../middleware/auth.middleware.js';
import {
  validate,
  registerSchema,
  loginSchema,
  passwordResetRequestSchema,
  passwordResetValidateSchema,
  passwordResetCompleteSchema,
} from '../validation/auth.schema.js';

const router = Router();

/**
 * POST /api/auth/register
 * Create a new employee account (supervisor only).
 * Returns the employee and their required documents based on age.
 */
router.post(
  '/register',
  requireAuth,
  requireSupervisor,
  validate(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const { employee, requiredDocuments } = await register(req.body);

      // Send welcome email with temporary credentials
      await sendWelcomeEmail(employee.email, employee.name, req.body.tempPassword);

      res.status(201).json({
        message: 'Employee registered successfully',
        employee,
        requiredDocuments,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        const statusCode =
          error.code === 'EMAIL_EXISTS' ? 409 :
          error.code === 'AGE_TOO_YOUNG' ? 400 :
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
 * POST /api/auth/login
 * Authenticate with email and password.
 */
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await login(email, password);

    res.json({
      token: result.token,
      employee: result.employee,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const statusCode = error.code === 'ACCOUNT_LOCKED' ? 423 : 401;
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
 * POST /api/auth/logout
 * Invalidate the current session.
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  await logout(req.token!);
  res.status(204).send();
});

/**
 * POST /api/auth/password-reset/request
 * Request a password reset email.
 * Always returns 200 to avoid revealing if email exists.
 */
router.post(
  '/password-reset/request',
  validate(passwordResetRequestSchema),
  async (req: Request, res: Response) => {
    const { email } = req.body;
    await requestPasswordReset(email);

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
);

/**
 * POST /api/auth/password-reset/validate
 * Validate a password reset token.
 */
router.post(
  '/password-reset/validate',
  validate(passwordResetValidateSchema),
  async (req: Request, res: Response) => {
    const { token } = req.body;
    const employee = await validateResetToken(token);

    if (!employee) {
      res.status(400).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired reset token',
      });
      return;
    }

    res.json({
      valid: true,
      email: employee.email,
    });
  }
);

/**
 * POST /api/auth/password-reset/complete
 * Complete password reset with new password.
 */
router.post(
  '/password-reset/complete',
  validate(passwordResetCompleteSchema),
  async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      await completePasswordReset(token, newPassword);

      res.json({
        message: 'Password has been reset successfully. Please log in with your new password.',
      });
    } catch (error) {
      if (error instanceof PasswordResetError) {
        res.status(400).json({
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
 * GET /api/auth/me
 * Get current authenticated user info.
 */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    employee: req.employee,
  });
});

export default router;
