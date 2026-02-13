import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { getEmployeeByEmail, EmployeePublic } from '../services/auth.service.js';
import { db } from '../db/index.js';
import { employees } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';

// Zitadel configuration
// Trim to remove any accidental newlines from environment variables (common with Vercel)
const ZITADEL_ISSUER_RAW = process.env['ZITADEL_ISSUER'];
const ZITADEL_ISSUER = ZITADEL_ISSUER_RAW?.trim();
if (!ZITADEL_ISSUER) {
  console.warn('ZITADEL_ISSUER not set - auth will fail');
} else if (ZITADEL_ISSUER !== ZITADEL_ISSUER_RAW) {
  console.warn('ZITADEL_ISSUER had whitespace trimmed (check env var for accidental newlines)');
}

// Create JWKS client for token verification
// Zitadel uses /oauth/v2/keys instead of /.well-known/jwks.json
const JWKS = ZITADEL_ISSUER
  ? createRemoteJWKSet(new URL(`${ZITADEL_ISSUER}/oauth/v2/keys`))
  : null;

// Extended JWT payload with Zitadel-specific claims
interface ZitadelJWTPayload extends JWTPayload {
  email?: string;
  email_verified?: boolean;
  name?: string;
  'urn:zitadel:iam:org:project:roles'?: Record<string, unknown>;
}

// Userinfo response from Zitadel
interface ZitadelUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
}

/**
 * Fetch user info from Zitadel userinfo endpoint.
 * Used when email is not included in the access token.
 */
async function fetchUserInfo(accessToken: string): Promise<ZitadelUserInfo | null> {
  if (!ZITADEL_ISSUER) return null;

  try {
    const response = await fetch(`${ZITADEL_ISSUER}/oidc/v1/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch userinfo:', response.status, response.statusText);
      return null;
    }

    return (await response.json()) as ZitadelUserInfo;
  } catch (error) {
    console.error('Error fetching userinfo:', error);
    return null;
  }
}

// Extend Express Request to include employee and Zitadel user info
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      employee?: EmployeePublic;
      zitadelUser?: {
        sub: string;
        email?: string;
        name?: string;
        roles: string[];
        isAdmin: boolean;
      };
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
 * Get employee by Zitadel ID, or link by email if not yet linked.
 */
async function getEmployeeByZitadelId(
  zitadelSub: string,
  email?: string
): Promise<EmployeePublic | null> {
  // First, try to find by zitadel_id
  const [employeeByZitadel] = await db
    .select()
    .from(employees)
    .where(eq(employees.zitadelId, zitadelSub))
    .limit(1);

  if (employeeByZitadel) {
    return {
      id: employeeByZitadel.id,
      name: employeeByZitadel.name,
      email: employeeByZitadel.email,
      dateOfBirth: employeeByZitadel.dateOfBirth,
      status: employeeByZitadel.status,
      isSupervisor: employeeByZitadel.isSupervisor,
      createdAt: employeeByZitadel.createdAt,
      zitadelId: employeeByZitadel.zitadelId,
    };
  }

  // If not found by zitadel_id, try to link by email
  if (email) {
    const employeeByEmail = await getEmployeeByEmail(email);
    if (employeeByEmail && !employeeByEmail.zitadelId) {
      // Link this employee to the Zitadel account
      await db
        .update(employees)
        .set({ zitadelId: zitadelSub })
        .where(eq(employees.id, employeeByEmail.id));

      console.log(`Linked employee ${employeeByEmail.id} to Zitadel user ${zitadelSub}`);
      return employeeByEmail;
    }
    // Return the employee even if already linked to a different Zitadel account
    // (edge case - could indicate duplicate accounts)
    if (employeeByEmail) {
      return employeeByEmail;
    }
  }

  return null;
}

/**
 * Middleware that requires a valid Zitadel authentication token.
 * Validates the JWT against Zitadel's JWKS and links to employee record.
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

  if (!JWKS || !ZITADEL_ISSUER) {
    res.status(500).json({
      error: 'Configuration Error',
      message: 'Authentication service not configured',
    });
    return;
  }

  try {
    // Verify JWT signature and claims against Zitadel
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ZITADEL_ISSUER,
    });

    const zitadelPayload = payload as ZitadelJWTPayload;

    // Extract roles from Zitadel claims
    const rolesClaim = zitadelPayload['urn:zitadel:iam:org:project:roles'] || {};
    const roles = Object.keys(rolesClaim);
    const isAdmin = roles.includes('admin');

    // Deny access unless user has required Zitadel role
    if (!isAdmin && !roles.includes('app:renewal-timesheets')) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this application.',
      });
      return;
    }

    // Get email from token or fetch from userinfo endpoint
    let email = zitadelPayload.email;
    let name = zitadelPayload.name;

    if (!email) {
      // Email not in access token - fetch from userinfo endpoint
      const userInfo = await fetchUserInfo(token);
      if (userInfo) {
        email = userInfo.email;
        name = name || userInfo.name;
      }
    }

    // Attach Zitadel user info to request
    req.zitadelUser = {
      sub: zitadelPayload.sub!,
      email,
      name,
      roles,
      isAdmin,
    };

    // Best-effort employee record lookup (non-blocking)
    const employee = await getEmployeeByZitadelId(zitadelPayload.sub!, email);

    if (employee) {
      // Attach employee to request, override isSupervisor with admin role from Zitadel
      req.employee = {
        ...employee,
        isSupervisor: employee.isSupervisor || isAdmin,
      };
    }

    next();
  } catch (error) {
    const err = error as Error;
    console.error('Token verification failed:', {
      name: err.name,
      message: err.message,
      issuer: ZITADEL_ISSUER,
    });
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
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

  // Check both employee.isSupervisor and Zitadel admin role
  const isSupervisor = req.employee.isSupervisor || req.zitadelUser?.isAdmin;

  if (!isSupervisor) {
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
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token || !JWKS || !ZITADEL_ISSUER) {
    next();
    return;
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ZITADEL_ISSUER,
    });

    const zitadelPayload = payload as ZitadelJWTPayload;
    const rolesClaim = zitadelPayload['urn:zitadel:iam:org:project:roles'] || {};
    const roles = Object.keys(rolesClaim);
    const isAdmin = roles.includes('admin');

    // Get email from token or fetch from userinfo endpoint
    let email = zitadelPayload.email;
    let name = zitadelPayload.name;

    if (!email) {
      const userInfo = await fetchUserInfo(token);
      if (userInfo) {
        email = userInfo.email;
        name = name || userInfo.name;
      }
    }

    req.zitadelUser = {
      sub: zitadelPayload.sub!,
      email,
      name,
      roles,
      isAdmin,
    };

    const employee = await getEmployeeByZitadelId(zitadelPayload.sub!, email);

    if (employee && employee.status === 'active') {
      req.employee = {
        ...employee,
        isSupervisor: employee.isSupervisor || isAdmin,
      };
    }
  } catch {
    // Token invalid, continue without auth
  }

  next();
}
