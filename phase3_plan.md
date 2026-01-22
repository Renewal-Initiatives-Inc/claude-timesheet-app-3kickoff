# Phase 3 Execution Plan: Authentication System

## Overview

**Goal**: Implement secure email/password authentication with account management for the Renewal Initiatives Timesheet Application.

**Prerequisites from Phase 2** (verified):
- [x] Database schema created with `employees` table containing auth fields (`passwordHash`, `failedLoginAttempts`, `lockedUntil`)
- [x] Drizzle ORM configured with PostgreSQL
- [x] Test employees seeded in database
- [x] Express server running with health endpoint

---

## Technology Decisions (from technology_decisions.md)

- **Auth Strategy**: Built-in authentication (bcrypt + JWT + PostgreSQL sessions)
- **Password Hashing**: bcrypt
- **API Tokens**: jsonwebtoken
- **Email Service**: Postmark for password reset emails
- **Session Storage**: PostgreSQL (auditable, survives restarts)

---

## Tasks

### Task 1: Add Authentication Dependencies

**Files to modify:**
- [packages/backend/package.json](packages/backend/package.json)

**Actions:**
1. Add production dependencies:
   - `bcrypt` - Password hashing
   - `jsonwebtoken` - JWT token generation/verification
   - `postmark` - Email service for password reset
   - `uuid` - For generating secure reset tokens
2. Add dev dependencies:
   - `@types/bcrypt`
   - `@types/jsonwebtoken`

**Acceptance Criteria:**
- All dependencies install without errors
- TypeScript types available for all auth libraries

---

### Task 2: Add Session Schema to Database

**Files to create:**
- [packages/backend/src/db/schema/session.ts](packages/backend/src/db/schema/session.ts)

**Files to modify:**
- [packages/backend/src/db/schema/index.ts](packages/backend/src/db/schema/index.ts)

**Actions:**
1. Create `sessions` table schema:
   ```
   sessions
   ├─ id: uuid (primary key)
   ├─ employeeId: uuid (FK to employees)
   ├─ token: varchar (unique, indexed)
   ├─ expiresAt: timestamp
   ├─ createdAt: timestamp
   └─ revokedAt: timestamp (nullable, for logout/invalidation)
   ```
2. Create `passwordResetTokens` table schema:
   ```
   password_reset_tokens
   ├─ id: uuid (primary key)
   ├─ employeeId: uuid (FK to employees)
   ├─ token: varchar (unique, indexed)
   ├─ expiresAt: timestamp
   ├─ usedAt: timestamp (nullable)
   └─ createdAt: timestamp
   ```
3. Export from schema index
4. Run migration to create tables

**Acceptance Criteria:**
- Tables created in database
- Relations to employees table working
- Migration runs successfully

---

### Task 3: Extend Environment Configuration

**Files to modify:**
- [packages/backend/src/config/env.ts](packages/backend/src/config/env.ts)
- [packages/backend/.env.example](packages/backend/.env.example)
- [.env.example](.env.example)

**Actions:**
1. Add environment variables:
   - `JWT_SECRET` - Secret for signing JWTs (required)
   - `JWT_EXPIRES_IN` - Token expiration (default: "7d")
   - `POSTMARK_API_KEY` - Postmark server token (required for email)
   - `PASSWORD_RESET_EXPIRES_HOURS` - Reset token expiration (default: 24)
   - `MAX_LOGIN_ATTEMPTS` - Account lockout threshold (default: 5)
   - `LOCKOUT_DURATION_MINUTES` - How long account stays locked (default: 30)
   - `APP_URL` - Base URL for password reset links

**Acceptance Criteria:**
- Environment validation fails if JWT_SECRET missing
- Sensible defaults for non-critical settings
- Example env files updated for developer reference

---

### Task 4: Create Password Utility Functions

**Files to create:**
- [packages/backend/src/utils/password.ts](packages/backend/src/utils/password.ts)

**Actions:**
1. Create `hashPassword(plaintext: string): Promise<string>` - Uses bcrypt with cost factor 12
2. Create `verifyPassword(plaintext: string, hash: string): Promise<boolean>`
3. Create `generateSecureToken(): string` - For password reset tokens
4. Create password strength validator (minimum 8 chars, at least one letter and one number)

**Acceptance Criteria:**
- Passwords hashed with bcrypt, cannot be reversed
- Password verification returns true/false (no timing attacks)
- Generated tokens are cryptographically secure (256 bits)

---

### Task 5: Create JWT Utility Functions

**Files to create:**
- [packages/backend/src/utils/jwt.ts](packages/backend/src/utils/jwt.ts)

**Actions:**
1. Create `signToken(payload: TokenPayload): string` - Signs JWT with employee ID and role
2. Create `verifyToken(token: string): TokenPayload | null` - Verifies and decodes JWT
3. Define `TokenPayload` interface:
   ```typescript
   interface TokenPayload {
     employeeId: string;
     email: string;
     isSupervisor: boolean;
     iat?: number;
     exp?: number;
   }
   ```

**Acceptance Criteria:**
- Tokens include employee ID, email, and supervisor flag
- Tokens expire after configured duration
- Invalid/expired tokens return null (not throw)

---

### Task 6: Create Session Service

**Files to create:**
- [packages/backend/src/services/session.service.ts](packages/backend/src/services/session.service.ts)

**Actions:**
1. Create `createSession(employeeId: string): Promise<Session>` - Creates DB session record
2. Create `getActiveSession(token: string): Promise<Session | null>` - Finds non-expired, non-revoked session
3. Create `revokeSession(token: string): Promise<void>` - Marks session as revoked
4. Create `revokeAllSessions(employeeId: string): Promise<void>` - Revokes all sessions for employee
5. Create `cleanupExpiredSessions(): Promise<number>` - Deletes old sessions (for scheduled job)

**Acceptance Criteria:**
- Sessions stored in PostgreSQL
- Revoked sessions cannot be used
- Expired sessions cannot be used

---

### Task 7: Create Auth Service

**Files to create:**
- [packages/backend/src/services/auth.service.ts](packages/backend/src/services/auth.service.ts)

**Actions:**
1. Create `register(data: RegisterData): Promise<Employee>`:
   - Called by supervisors to create new employees
   - Hash password with bcrypt
   - Return employee without password hash
2. Create `login(email: string, password: string): Promise<LoginResult>`:
   - Check if account is locked (`lockedUntil > now`)
   - Verify password
   - On failure: increment `failedLoginAttempts`, lock if >= 5 attempts
   - On success: reset `failedLoginAttempts`, create session, return token
3. Create `logout(token: string): Promise<void>`:
   - Revoke the session
4. Create `checkAccountLocked(employeeId: string): Promise<{ locked: boolean; until?: Date }>`
5. Create `resetFailedAttempts(employeeId: string): Promise<void>`

**Acceptance Criteria:**
- Login returns JWT on success
- Login returns error on wrong password (increment attempts)
- Account locks after 5 failed attempts
- Locked accounts show unlock time in error

**Satisfies Requirements:**
- REQ-024.4: Lock accounts after repeated failed login attempts

---

### Task 8: Create Password Reset Service

**Files to create:**
- [packages/backend/src/services/password-reset.service.ts](packages/backend/src/services/password-reset.service.ts)

**Actions:**
1. Create `requestReset(email: string): Promise<void>`:
   - Generate secure token
   - Store in `passwordResetTokens` with expiration
   - Send email via Postmark with reset link
   - Always return success (don't reveal if email exists)
2. Create `validateResetToken(token: string): Promise<Employee | null>`:
   - Check token exists, not expired, not used
   - Return employee if valid
3. Create `completeReset(token: string, newPassword: string): Promise<void>`:
   - Validate token
   - Validate password strength
   - Update password hash
   - Mark token as used
   - Revoke all existing sessions

**Acceptance Criteria:**
- Reset tokens expire after configured time (default 24 hours)
- Each token can only be used once
- Password change invalidates all existing sessions
- Email doesn't reveal if account exists (timing-safe)

**Satisfies Requirements:**
- REQ-024.2: Provide password reset via email

---

### Task 9: Create Email Service

**Files to create:**
- [packages/backend/src/services/email.service.ts](packages/backend/src/services/email.service.ts)

**Actions:**
1. Create Postmark client initialization
2. Create `sendPasswordResetEmail(to: string, resetLink: string): Promise<void>`
3. Create `sendWelcomeEmail(to: string, tempPassword: string): Promise<void>` (for new accounts)
4. Add error handling that logs failures but doesn't block user flow

**Templates needed:**
- Password reset email with link and expiration notice
- Welcome email with temporary password

**Acceptance Criteria:**
- Emails sent via Postmark
- Failures logged but don't crash application
- Templates are clear and professional

---

### Task 10: Create Authentication Middleware

**Files to create:**
- [packages/backend/src/middleware/auth.middleware.ts](packages/backend/src/middleware/auth.middleware.ts)

**Actions:**
1. Create `requireAuth` middleware:
   - Extract token from Authorization header (`Bearer <token>`)
   - Verify JWT
   - Check session exists and is valid in database
   - Attach employee to `req.employee`
   - Return 401 if invalid
2. Create `requireSupervisor` middleware:
   - Runs after `requireAuth`
   - Check `req.employee.isSupervisor === true`
   - Return 403 if not supervisor
3. Create `optionalAuth` middleware:
   - Same as requireAuth but doesn't fail if no token
   - Useful for endpoints that behave differently when logged in

**Acceptance Criteria:**
- Protected routes return 401 without valid token
- Supervisor routes return 403 for non-supervisors
- Token checked against database session (not just JWT validity)

---

### Task 11: Create Auth Routes

**Files to create:**
- [packages/backend/src/routes/auth.ts](packages/backend/src/routes/auth.ts)

**Endpoints:**

1. `POST /api/auth/register` (supervisor only)
   - Body: `{ name, email, dateOfBirth, isSupervisor?, tempPassword }`
   - Creates employee account
   - Sends welcome email with credentials
   - Returns: employee data (no password)

2. `POST /api/auth/login`
   - Body: `{ email, password }`
   - Returns: `{ token, employee }` on success
   - Returns: 401 with error message on failure
   - Returns: 423 if account locked (with unlock time)

3. `POST /api/auth/logout`
   - Requires: valid token
   - Revokes current session
   - Returns: 204 No Content

4. `POST /api/auth/password-reset/request`
   - Body: `{ email }`
   - Always returns 200 (don't reveal if email exists)
   - Sends reset email if account exists

5. `POST /api/auth/password-reset/validate`
   - Body: `{ token }`
   - Returns: 200 if valid, 400 if invalid/expired

6. `POST /api/auth/password-reset/complete`
   - Body: `{ token, newPassword }`
   - Returns: 200 on success
   - Returns: 400 if token invalid or password too weak

7. `GET /api/auth/me`
   - Requires: valid token
   - Returns: current employee data

**Files to modify:**
- [packages/backend/src/app.ts](packages/backend/src/app.ts) - Add auth routes

**Acceptance Criteria:**
- All endpoints respond with correct status codes
- Validation errors return helpful messages
- Login/logout work end-to-end

**Satisfies Requirements:**
- REQ-024.1: Authenticate users via email and password
- REQ-024.2: Provide password reset via email
- REQ-024.3: Enforce minimum password complexity
- REQ-024.4: Lock accounts after repeated failed login attempts

---

### Task 12: Add Request Validation Schemas

**Files to create:**
- [packages/backend/src/validation/auth.schema.ts](packages/backend/src/validation/auth.schema.ts)

**Actions:**
1. Create Zod schemas for all auth request bodies:
   - `registerSchema` - name, email, dateOfBirth, tempPassword
   - `loginSchema` - email, password
   - `passwordResetRequestSchema` - email
   - `passwordResetCompleteSchema` - token, newPassword
2. Create validation middleware using Zod

**Acceptance Criteria:**
- Invalid requests return 400 with specific error messages
- All input is validated before processing
- No SQL injection or XSS possible through inputs

---

### Task 13: Update Shared Types

**Files to modify:**
- [shared/types/src/api.ts](shared/types/src/api.ts)

**Actions:**
1. Add auth-related types:
   ```typescript
   interface LoginRequest { email: string; password: string; }
   interface LoginResponse { token: string; employee: EmployeePublic; }
   interface EmployeePublic { id: string; name: string; email: string; isSupervisor: boolean; }
   interface RegisterRequest { name: string; email: string; dateOfBirth: string; isSupervisor?: boolean; tempPassword: string; }
   interface PasswordResetRequest { email: string; }
   interface PasswordResetComplete { token: string; newPassword: string; }
   ```

**Acceptance Criteria:**
- Types shared between frontend and backend
- Frontend can import types for API calls

---

### Task 14: Update Seed Script for Auth Testing

**Files to modify:**
- [packages/backend/src/db/seed.ts](packages/backend/src/db/seed.ts)

**Actions:**
1. Add password hashes for test employees
2. Set default test password: `TestPass123!`
3. Update supervisor account with known credentials for testing

**Acceptance Criteria:**
- Test employees can log in after seeding
- Supervisor has known test password for E2E tests

---

### Task 15: Write Unit Tests for Auth Utilities

**Files to create:**
- [packages/backend/src/__tests__/utils/password.test.ts](packages/backend/src/__tests__/utils/password.test.ts)
- [packages/backend/src/__tests__/utils/jwt.test.ts](packages/backend/src/__tests__/utils/jwt.test.ts)

**Tests for password utils:**
- Password hashing produces different hash each time (salt)
- Correct password verifies successfully
- Wrong password fails verification
- Password strength validation works (min length, complexity)

**Tests for JWT utils:**
- Token signs and verifies correctly
- Expired token returns null
- Invalid token returns null
- Payload contains expected fields

**Acceptance Criteria:**
- 100% coverage of password utility functions
- Edge cases tested (empty strings, very long passwords, etc.)

---

### Task 16: Write Unit Tests for Auth Services

**Files to create:**
- [packages/backend/src/__tests__/services/auth.service.test.ts](packages/backend/src/__tests__/services/auth.service.test.ts)
- [packages/backend/src/__tests__/services/password-reset.service.test.ts](packages/backend/src/__tests__/services/password-reset.service.test.ts)
- [packages/backend/src/__tests__/services/session.service.test.ts](packages/backend/src/__tests__/services/session.service.test.ts)

**Tests for auth service:**
- Successful login returns token
- Wrong password increments failed attempts
- Account locks after 5 failed attempts
- Locked account returns correct error
- Successful login resets failed attempts
- Logout revokes session

**Tests for password reset:**
- Reset request creates token
- Valid token returns employee
- Expired token returns null
- Used token returns null
- Complete reset updates password and revokes sessions

**Tests for session service:**
- Session creation works
- Active session lookup works
- Revoked session not returned
- Expired session not returned

**Acceptance Criteria:**
- All happy paths tested
- Error conditions tested
- Account lockout behavior verified

---

### Task 17: Write Integration Tests for Auth Routes

**Files to create:**
- [packages/backend/src/__tests__/routes/auth.test.ts](packages/backend/src/__tests__/routes/auth.test.ts)

**Tests:**
- `POST /api/auth/login` - success returns token
- `POST /api/auth/login` - wrong password returns 401
- `POST /api/auth/login` - account lockout after 5 attempts returns 423
- `POST /api/auth/logout` - invalidates session
- `GET /api/auth/me` - returns current user with valid token
- `GET /api/auth/me` - returns 401 without token
- `POST /api/auth/register` - creates employee (supervisor only)
- `POST /api/auth/register` - returns 403 for non-supervisor
- `POST /api/auth/password-reset/request` - always returns 200
- `POST /api/auth/password-reset/complete` - resets password with valid token

**Acceptance Criteria:**
- All routes return expected status codes
- Authentication flow works end-to-end
- Error messages are helpful but don't leak info

---

### Task 18: Write E2E Tests for Login Flow

**Files to create:**
- [e2e/auth.spec.ts](e2e/auth.spec.ts)

**Tests (using Playwright):**
- User can log in with valid credentials
- User sees error with invalid credentials
- User is redirected after login
- Logged-in user sees their name
- User can log out
- Logged-out user cannot access protected pages

**Note**: Frontend login UI will be built in Phase 4, but we'll stub the E2E test structure now.

**Acceptance Criteria:**
- Test structure ready for frontend implementation
- Backend auth flow verified through API tests

---

## File Summary

### New Files to Create (17 files)
| File | Description |
|------|-------------|
| `packages/backend/src/db/schema/session.ts` | Session and password reset token tables |
| `packages/backend/src/utils/password.ts` | Password hashing and validation |
| `packages/backend/src/utils/jwt.ts` | JWT signing and verification |
| `packages/backend/src/services/session.service.ts` | Session CRUD operations |
| `packages/backend/src/services/auth.service.ts` | Login, logout, registration |
| `packages/backend/src/services/password-reset.service.ts` | Password reset flow |
| `packages/backend/src/services/email.service.ts` | Postmark email sending |
| `packages/backend/src/middleware/auth.middleware.ts` | Auth middleware (requireAuth, requireSupervisor) |
| `packages/backend/src/routes/auth.ts` | Auth API endpoints |
| `packages/backend/src/validation/auth.schema.ts` | Request validation schemas |
| `packages/backend/src/__tests__/utils/password.test.ts` | Password utility tests |
| `packages/backend/src/__tests__/utils/jwt.test.ts` | JWT utility tests |
| `packages/backend/src/__tests__/services/auth.service.test.ts` | Auth service tests |
| `packages/backend/src/__tests__/services/password-reset.service.test.ts` | Password reset tests |
| `packages/backend/src/__tests__/services/session.service.test.ts` | Session service tests |
| `packages/backend/src/__tests__/routes/auth.test.ts` | Auth route integration tests |
| `e2e/auth.spec.ts` | Playwright E2E test stub |

### Files to Modify (6 files)
| File | Changes |
|------|---------|
| `packages/backend/package.json` | Add bcrypt, jsonwebtoken, postmark dependencies |
| `packages/backend/src/db/schema/index.ts` | Export session schema |
| `packages/backend/src/config/env.ts` | Add JWT_SECRET, POSTMARK_API_KEY, etc. |
| `packages/backend/.env.example` | Document new environment variables |
| `packages/backend/src/app.ts` | Add auth routes |
| `packages/backend/src/db/seed.ts` | Add password hashes for test users |
| `shared/types/src/api.ts` | Add auth-related types |

---

## Requirements Satisfaction

This phase satisfies the following requirements from requirements.md:

| Requirement | Acceptance Criteria | How Addressed |
|-------------|---------------------|---------------|
| REQ-024.1 | Authenticate users via email and password | Login endpoint with email/password |
| REQ-024.2 | Provide password reset via email | Password reset flow with Postmark |
| REQ-024.3 | Enforce minimum password complexity | Validation in password utils |
| REQ-024.4 | Lock accounts after repeated failed login attempts | `failedLoginAttempts` counter + lockout |
| REQ-024.5 | Use HTTPS for all communications | Already handled by Vercel deployment |

---

## Verification Checklist

Before marking Phase 3 complete:

- [ ] All 17 new files created
- [ ] Database migration runs successfully
- [ ] Test employee can log in with seeded credentials
- [ ] Login returns JWT token
- [ ] JWT can be used to access protected endpoints
- [ ] Wrong password increments failed attempts
- [ ] Account locks after 5 failed attempts
- [ ] Locked account shows unlock time
- [ ] Password reset email sends (or logs in dev mode)
- [ ] Password reset token works
- [ ] New password replaces old password
- [ ] All sessions revoked on password change
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] TypeScript compilation succeeds
- [ ] No eslint errors

---

## Execution Order

Recommended order for implementation:

1. **Dependencies & Config** (Tasks 1, 3)
2. **Database Schema** (Task 2) + run migration
3. **Utility Functions** (Tasks 4, 5, 15 - tests alongside)
4. **Services** (Tasks 6, 7, 8, 9, 16 - tests alongside)
5. **Validation & Types** (Tasks 12, 13)
6. **Middleware** (Task 10)
7. **Routes** (Task 11)
8. **Seed Update** (Task 14)
9. **Integration Tests** (Task 17)
10. **E2E Test Stub** (Task 18)

---

## Notes

- **COPPA Compliance**: Minor data stays in our PostgreSQL - no third-party auth services store user data
- **Session Storage**: Using PostgreSQL for sessions (auditable, survives restarts) per technology decisions
- **Email in Dev**: In development mode, email content should be logged to console instead of sent
- **Password Hashing Cost**: Using bcrypt cost factor 12 (good balance of security vs performance)
- **Token Expiration**: JWT expires in 7 days, reset token expires in 24 hours (configurable)

---

## Next Steps

After Phase 3 is complete:
- Run `/execute-phase 3` to implement this plan
- Then proceed to Phase 4: Employee & Document Management
