# Phase 12: Polish & Hardening - Execution Plan

## Overview

**Goal**: Production readiness with security hardening and UX refinement.

**Deliverable**: Production-ready application with security hardened and UX polished.

**Prerequisites**: Phases 1-11 completed (verified via git history)

---

## Task Breakdown

### 1. Security Hardening

#### 1.1 Rate Limiting on Auth Endpoints

**Why**: Account lockout (5 attempts) is ineffective without rate limiting - attackers can retry immediately. Critical for REQ-024 (secure authentication).

**Files to create:**
- `packages/backend/src/middleware/rate-limit.middleware.ts`

**Files to modify:**
- `packages/backend/src/app.ts` - Apply rate limiter to auth routes
- `packages/backend/package.json` - Add `express-rate-limit` dependency

**Implementation:**
```typescript
// Rate limit config:
// - Login: 5 requests per 15 minutes per IP
// - Password reset request: 3 requests per hour per IP
// - Register: 10 requests per hour per IP
// - General API: 100 requests per minute per IP
```

**Tests to write:**
- `packages/backend/src/__tests__/middleware/rate-limit.middleware.test.ts`
- E2E test: Verify rate limit headers returned

**Acceptance criteria:**
- Rate limit headers included in responses (X-RateLimit-*)
- 429 Too Many Requests returned when exceeded
- Different limits for auth vs general endpoints

---

#### 1.2 CSRF Protection

**Why**: CORS with `credentials: true` requires CSRF protection to prevent cross-site request forgery.

**Files to create:**
- `packages/backend/src/middleware/csrf.middleware.ts`

**Files to modify:**
- `packages/backend/src/app.ts` - Add CSRF middleware
- `packages/backend/package.json` - Add `csurf` or custom double-submit cookie pattern
- `packages/frontend/src/api/client.ts` - Include CSRF token in requests

**Implementation approach:**
- Double-submit cookie pattern (simpler than stateful tokens)
- Generate token on login, include in cookie and response
- Frontend sends token in X-CSRF-Token header
- Validate on state-changing requests (POST, PUT, PATCH, DELETE)

**Tests to write:**
- `packages/backend/src/__tests__/middleware/csrf.middleware.test.ts`
- Unit test: Token generation and validation
- Integration test: Reject requests without valid CSRF token

**Acceptance criteria:**
- CSRF token generated on authentication
- State-changing requests require valid token
- 403 Forbidden returned for invalid/missing tokens

---

#### 1.3 Input Sanitization & XSS Prevention

**Why**: While React escapes by default, error messages and notes may contain user input that gets rendered.

**Files to modify:**
- `packages/backend/src/routes/*.ts` - Sanitize user inputs in responses
- `packages/backend/src/services/*.ts` - Sanitize before storage
- `packages/frontend/src/components/*.tsx` - Verify no dangerouslySetInnerHTML

**Implementation:**
- Add DOMPurify for any HTML content (if needed)
- Verify all user-facing strings are escaped
- Review CSP headers in Helmet config for script-src restrictions

**Tests to write:**
- `packages/backend/src/__tests__/utils/sanitization.test.ts`
- Test XSS payloads in: employee names, notes, supervisor notes, error messages

**Acceptance criteria:**
- No XSS vulnerabilities in user-facing content
- CSP headers block inline scripts (verified via browser dev tools)

---

#### 1.4 Global Error Handler

**Why**: Unhandled errors currently crash or leak stack traces. Need centralized handling for consistent responses and logging.

**Files to create:**
- `packages/backend/src/middleware/error-handler.middleware.ts`

**Files to modify:**
- `packages/backend/src/app.ts` - Add global error handler as last middleware

**Implementation:**
```typescript
// Error handler responsibilities:
// 1. Log error details (for debugging)
// 2. Return sanitized response (no stack traces in production)
// 3. Map known error types to appropriate HTTP status codes
// 4. Handle async errors (express-async-errors or wrapper)
```

**Tests to write:**
- `packages/backend/src/__tests__/middleware/error-handler.middleware.test.ts`
- Test: Known error types return correct status codes
- Test: Unknown errors return 500 with generic message
- Test: Stack traces hidden in production

**Acceptance criteria:**
- No stack traces exposed in production error responses
- All errors logged with context
- Consistent error response format

---

#### 1.5 Security Headers Audit

**Why**: Verify Helmet.js is properly configured for production security.

**Files to modify:**
- `packages/backend/src/app.ts` - Review/enhance Helmet configuration

**Verification checklist:**
- [ ] Content-Security-Policy restricts script sources
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] Strict-Transport-Security (HSTS) enabled for production
- [ ] Referrer-Policy set appropriately
- [ ] Permissions-Policy restricts sensitive features

**Tests to write:**
- `packages/backend/src/__tests__/routes/security-headers.test.ts`
- Verify all expected headers present in responses

---

#### 1.6 Cron Job Security

**Why**: CRON_SECRET is defined but cron endpoints need to verify it.

**Files to modify:**
- `packages/backend/src/routes/crons.ts` (if exists) or create cron routes
- Verify secret validation on all cron endpoints

**Implementation:**
```typescript
// Cron endpoints should:
// 1. Check Authorization header for CRON_SECRET
// 2. Return 401 if missing/invalid
// 3. Log cron executions
```

---

### 2. Performance Optimization

#### 2.1 Compliance Check Performance

**Why**: REQ-011 requires compliance checks complete in <5 seconds.

**Files to analyze:**
- `packages/backend/src/services/compliance-rule-engine.ts`
- `packages/backend/src/services/compliance-rules/*.ts`

**Implementation:**
- Add performance logging to compliance check
- Profile database queries during compliance evaluation
- Consider caching employee age calculations
- Evaluate if any rules can run in parallel

**Tests to write:**
- `packages/backend/src/__tests__/services/compliance-rule-engine.performance.test.ts`
- Benchmark: 7-day timesheet with max entries completes in <5s

**Acceptance criteria:**
- Compliance check completes in <5 seconds (logged and verified)
- Performance regression tests added

---

#### 2.2 Database Query Optimization

**Why**: Ensure queries scale with 3-year data retention.

**Files to analyze:**
- All service files with database queries
- Drizzle schema for index coverage

**Implementation:**
- Add database indexes where missing:
  - `timesheets(employeeId, weekStartDate)` - composite index
  - `complianceCheckLogs(timesheetId, createdAt)`
  - `alerts(employeeId, resolved, createdAt)`
  - `payrollRecords(timesheetId, createdAt)`
- Add EXPLAIN ANALYZE to slow query tests

**Files to modify:**
- `packages/backend/src/db/schema.ts` - Add indexes

**Tests to write:**
- Query performance tests for common operations

---

#### 2.3 Frontend Bundle Size Review

**Why**: Mobile field use requires fast loading on cellular connections.

**Files to analyze:**
- `packages/frontend/vite.config.ts`
- `packages/frontend/package.json` dependencies

**Implementation:**
- Run `npm run build` and analyze bundle size
- Identify large dependencies for potential lazy loading
- Consider code splitting for supervisor-only routes
- Enable tree shaking verification

**Deliverables:**
- Bundle size report (target: <500KB gzipped for main bundle)
- Lazy load supervisor-only pages

---

### 3. Error Handling Refinement

#### 3.1 User-Friendly Error Messages

**Why**: REQ-011 requires error messages provide "sufficient guidance for first-attempt resolution."

**Files to modify:**
- `packages/backend/src/services/*.ts` - Review error messages
- `packages/frontend/src/components/ComplianceErrorDisplay.tsx` - Improve display
- All error code mappings

**Implementation:**
- Audit all error codes for user-friendliness
- Add remediation guidance to all compliance errors
- Ensure no technical jargon in user-facing messages
- Test with sample user (imagine 12-year-old reading it)

**Error message template:**
```
What happened: [Clear description]
Why it happened: [Simple explanation]
How to fix it: [Specific action]
```

---

#### 3.2 Error Logging Infrastructure

**Why**: Production debugging requires structured logging.

**Files to create:**
- `packages/backend/src/utils/logger.ts`

**Files to modify:**
- All route files - Replace console.error with structured logger
- `packages/backend/src/middleware/error-handler.middleware.ts` - Use logger

**Implementation:**
- Create logger utility (consider pino for performance)
- Log levels: error, warn, info, debug
- Include request ID for tracing
- Scrub sensitive data (passwords, tokens, PII)
- JSON format for production (easier to parse)

**Tests to write:**
- `packages/backend/src/__tests__/utils/logger.test.ts`
- Verify sensitive data is not logged

---

### 4. Mobile Responsiveness

**Why**: REQ notes "field use on phones" - employees may submit timesheets from the farm.

**Files to review/modify:**
- `packages/frontend/src/components/TimesheetGrid.tsx`
- `packages/frontend/src/pages/Timesheet.tsx`
- `packages/frontend/src/pages/Login.tsx`
- All modal components

**Implementation:**
- Test on common phone sizes (375px, 390px, 414px widths)
- Ensure touch targets are ≥44px
- Verify forms are usable without horizontal scrolling
- Test timesheet grid scrolling behavior
- Ensure modals don't overflow on small screens

**Tests to write:**
- `e2e/mobile-responsiveness.spec.ts`
- Playwright tests at mobile viewport sizes
- Screenshot comparisons for regression

**Acceptance criteria:**
- All critical flows usable at 375px width
- No horizontal scrolling required
- Touch targets meet accessibility guidelines

---

### 5. Accessibility Review (WCAG 2.1 Level AA)

#### 5.1 Semantic HTML & ARIA

**Files to review:**
- All frontend components
- Focus on: forms, modals, data tables, error displays

**Checklist:**
- [ ] Proper heading hierarchy (h1 → h2 → h3)
- [ ] Form labels associated with inputs (htmlFor/id)
- [ ] Error messages linked to fields (aria-describedby)
- [ ] Modal focus trap and escape key handling
- [ ] Data tables have proper headers (scope, headers)
- [ ] Interactive elements have accessible names
- [ ] Color contrast ratio ≥4.5:1 for text

**Tools:**
- axe-core browser extension
- Lighthouse accessibility audit
- Manual keyboard navigation testing

---

#### 5.2 Keyboard Navigation

**Files to modify as needed:**
- Modal components - Focus trap
- Dropdown menus - Arrow key navigation
- Data tables - Row navigation

**Tests to write:**
- `e2e/accessibility.spec.ts`
- Tab order verification
- Focus visible on all interactive elements
- Escape key closes modals

**Acceptance criteria:**
- All functionality accessible via keyboard
- Focus visible at all times
- Logical tab order

---

#### 5.3 Screen Reader Testing

**Manual testing:**
- Test with VoiceOver (macOS)
- Verify form field announcements
- Verify error announcements
- Verify dynamic content updates (aria-live)

---

### 6. Load Testing

**Why**: Verify system handles realistic data volumes over 3-year retention period.

#### 6.1 Test Data Generation

**Files to create:**
- `packages/backend/src/scripts/generate-load-test-data.ts`

**Data volume targets (simulating 3 years):**
- 20 employees
- 156 weeks of timesheets per employee (3 years)
- ~5 entries per timesheet
- 3,120 timesheets total
- 15,600 timesheet entries
- 100,000+ compliance check logs

---

#### 6.2 Performance Benchmarks

**Files to create:**
- `packages/backend/src/__tests__/performance/load-test.ts`

**Scenarios to test:**
1. Login under load (10 concurrent)
2. Dashboard load with full data
3. Report generation with 3-year data range
4. Compliance check with maximum entries
5. Payroll export with large dataset

**Acceptance criteria:**
- Dashboard loads in <3 seconds with 3-year data
- Compliance check <5 seconds (per REQ-011)
- Report generation <10 seconds for full history
- No memory leaks during sustained operation

---

### 7. Documentation

#### 7.1 API Documentation

**Files to create:**
- `docs/api.md` or OpenAPI spec

**Coverage:**
- All endpoints with request/response schemas
- Authentication requirements
- Error codes and meanings
- Rate limit information
- Example requests/responses

---

#### 7.2 Deployment Guide

**Files to create:**
- `docs/deployment.md`

**Content:**
- Environment variable reference
- Vercel deployment steps
- Database migration process
- Backup/restore procedures
- Monitoring setup
- Rollback procedures
- Troubleshooting guide

---

### 8. Code Quality & Harmonization

#### 8.1 Fix Convention Violations

**From harmonization_plan.md:**

**Files to modify:**
- `packages/frontend/src/components/TaskCodeForm.tsx`
  - Rename `validationError` → `error`
- `packages/frontend/src/components/SchoolDayOverrideModal.tsx`
  - Rename `.confirm-button` → `.submit-button` (if applicable)

---

#### 8.2 Test Coverage Gaps

**Files to create/modify:**
- Unskip `e2e/auth.spec.ts` tests
- Add missing route tests
- Add React component tests

**Target:** 80% code coverage on critical paths (auth, compliance, payroll)

---

## Execution Order

The tasks should be executed in this order to manage dependencies:

1. **Security First** (1.1-1.6) - Foundational for production
2. **Error Handling** (3.1-3.2) - Required for security and debugging
3. **Performance** (2.1-2.3) - Verify before load testing
4. **Load Testing** (6.1-6.2) - Requires performance optimizations
5. **Mobile & Accessibility** (4, 5) - UX polish
6. **Documentation** (7.1-7.2) - After features stabilized
7. **Code Quality** (8.1-8.2) - Final cleanup

---

## Testing Summary

### New Test Files

| File | Type | Purpose |
|------|------|---------|
| `rate-limit.middleware.test.ts` | Unit | Rate limiting logic |
| `csrf.middleware.test.ts` | Unit | CSRF token validation |
| `error-handler.middleware.test.ts` | Unit | Global error handling |
| `security-headers.test.ts` | Integration | HTTP security headers |
| `sanitization.test.ts` | Unit | XSS prevention |
| `logger.test.ts` | Unit | Logging utility |
| `compliance-rule-engine.performance.test.ts` | Performance | <5s compliance check |
| `load-test.ts` | Performance | System under load |
| `mobile-responsiveness.spec.ts` | E2E | Mobile viewport testing |
| `accessibility.spec.ts` | E2E | Keyboard/screen reader |

### E2E Test Updates

- Unskip `auth.spec.ts` - Full auth flow testing
- Add rate limit verification
- Add CSRF token flow
- Mobile viewport testing
- Accessibility verification

---

## Requirements Satisfied

| Requirement | How Addressed |
|------------|---------------|
| REQ-011 (Compliance <5s) | Performance testing & optimization |
| REQ-022 (3-year retention) | Load testing with 3-year data |
| REQ-024 (Secure auth) | Rate limiting, CSRF, security headers |
| Success Metrics (timesheet <5min) | Mobile responsiveness |
| Zero security breaches | Full security audit |

---

## Estimated Complexity

| Task Group | Complexity | Risk |
|------------|------------|------|
| Security Hardening | High | Medium (new middleware) |
| Performance | Medium | Low (optimization) |
| Error Handling | Medium | Low (refactoring) |
| Mobile/Accessibility | Medium | Low (CSS/ARIA) |
| Load Testing | Medium | Low (scripting) |
| Documentation | Low | None |

---

## Dependencies to Verify

Before starting Phase 12, verify:

- [ ] All Phase 11 (Reporting & Audit) features working
- [ ] Database migrations up to date
- [ ] All existing tests passing
- [ ] No critical bugs in previous phases

---

## Success Criteria

Phase 12 is complete when:

- [ ] Rate limiting active on auth endpoints (verified via headers)
- [ ] CSRF protection enabled (verified via test)
- [ ] Global error handler catches all errors (no stack traces in production)
- [ ] Security headers audit passes (Helmet configured)
- [ ] Compliance check <5 seconds (benchmark test)
- [ ] Database indexes added for common queries
- [ ] Frontend bundle <500KB gzipped
- [ ] Mobile responsive at 375px width
- [ ] WCAG 2.1 AA compliance (no critical axe-core violations)
- [ ] Load test passes with 3-year data volume
- [ ] API documentation complete
- [ ] Deployment guide complete
- [ ] All existing tests still passing
- [ ] 80% test coverage on critical paths

---

## Next Steps

Run `/execute-phase 12` to begin implementation.
