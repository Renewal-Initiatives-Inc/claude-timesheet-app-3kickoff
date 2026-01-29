# Phase 13: Deployment & Launch - Execution Plan

## Overview

**Goal**: Deploy to production and verify all systems operational.

**Deliverable**: Live production application with real users.

**Prerequisites**: Phases 1-12 completed (project scaffolding through polish & hardening)

---

## Pre-Deployment Checklist

Before beginning deployment, verify these prerequisites:

- [ ] All Phase 12 security hardening complete
- [ ] All existing tests passing (`npm run test:run`)
- [ ] E2E tests passing locally (`npm run test:e2e`)
- [ ] No critical TypeScript errors (`npm run typecheck`)
- [ ] Code committed to main branch
- [ ] Vercel project connected to GitHub repository

---

## Task Breakdown

### 1. Configure Production Environment Variables

**Why**: Production requires different secrets, URLs, and service configurations than development.

**Location**: Vercel Dashboard → Project Settings → Environment Variables

**Production Environment Variables:**

```bash
# Database (REQUIRED)
# Get from Vercel Postgres dashboard after creating database
DATABASE_URL=postgres://...@...-pooler.vercel-storage.com/verceldb

# Authentication (REQUIRED)
# Generate new production secrets - DO NOT reuse development secrets
JWT_SECRET=<generate-64-char-hex>  # node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_EXPIRES_IN=7d

# Email - Postmark (REQUIRED for notifications)
POSTMARK_API_KEY=<production-server-token>  # Get from Postmark dashboard
EMAIL_FROM=noreply@renewal.org

# URLs (REQUIRED)
FRONTEND_URL=https://<your-app>.vercel.app
APP_URL=https://<your-app>.vercel.app
NODE_ENV=production

# Password Reset
PASSWORD_RESET_EXPIRES_HOURS=24

# Account Security
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=30

# Cron Job Security (REQUIRED)
# Generate new secret - DO NOT reuse development secret
CRON_SECRET=<generate-32-char-hex>  # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Vercel Blob (auto-configured if using Vercel Blob storage)
BLOB_READ_WRITE_TOKEN=<from-vercel-blob-dashboard>
```

**Acceptance Criteria:**

- [ ] All required environment variables set in Vercel dashboard
- [ ] Variables set for Production environment (not Preview/Development)
- [ ] No development secrets used in production
- [ ] JWT_SECRET is unique 64+ character string
- [ ] CRON_SECRET is unique 32+ character string

---

### 2. Set Up Production Database

**Why**: Production needs its own PostgreSQL instance with proper connection pooling.

#### 2.1 Create Vercel Postgres Database

**Steps:**

1. Go to Vercel Dashboard → Storage → Create Database
2. Select PostgreSQL
3. Choose region closest to users (US East recommended)
4. Note the connection string (automatically added to env vars)

**Verification:**

```bash
# Connection string should use pooler endpoint for serverless
# Format: postgres://...@...-pooler.vercel-storage.com/verceldb
```

#### 2.2 Run Database Migrations

**Steps:**

1. Set DATABASE_URL environment variable locally to production database
2. Run migrations:

```bash
# From project root with production DATABASE_URL
npm run db:migrate -w @renewal/backend
```

**Verification:**

```bash
# Verify tables created (via Vercel Postgres dashboard or psql)
# Expected tables:
# - employees
# - employee_documents
# - sessions
# - task_codes
# - task_code_rates
# - timesheets
# - timesheet_entries
# - compliance_check_logs
# - alerts
# - payroll_records
```

**Acceptance Criteria:**

- [ ] All migrations run successfully
- [ ] All tables created with correct schema
- [ ] Indexes created for performance-critical queries
- [ ] Connection pooling verified (using pooler URL)

---

### 3. Seed Production Task Codes

**Why**: Task codes define the work types, rates, and compliance attributes. Rates must be verified with organization before launch.

#### 3.1 Verify Task Codes with Organization

**Before seeding, confirm with Renewal Initiatives:**

| Code | Name                          | Rate      | Ag/Non-Ag        | Min Age | Notes            |
| ---- | ----------------------------- | --------- | ---------------- | ------- | ---------------- |
| F1   | Field Harvesting - Light      | $8.00/hr  | Agricultural     | 12      |                  |
| F2   | Field Planting                | $8.00/hr  | Agricultural     | 12      |                  |
| F3   | Irrigation Assistance         | $8.00/hr  | Agricultural     | 14      |                  |
| F4   | Equipment Operation - Light   | $8.00/hr  | Agricultural     | 16      | Power machinery  |
| F5   | Heavy Equipment Operation     | $8.00/hr  | Agricultural     | 18      | Hazardous        |
| F6   | Pesticide Application         | $8.00/hr  | Agricultural     | 18      | Hazardous        |
| R1   | Farm Stand - Customer Service | $15.00/hr | Non-Agricultural | 12      |                  |
| R2   | Farm Stand - Cash Register    | $15.00/hr | Non-Agricultural | 16      | Cash handling    |
| R3   | Inventory Stocking            | $15.00/hr | Non-Agricultural | 12      |                  |
| A1   | Office Filing                 | $15.00/hr | Non-Agricultural | 14      |                  |
| A2   | Data Entry                    | $15.00/hr | Non-Agricultural | 14      |                  |
| M1   | Grounds Keeping - Light       | $15.00/hr | Non-Agricultural | 12      |                  |
| M2   | Grounds Keeping - Power Tools | $15.00/hr | Non-Agricultural | 16      | Power machinery  |
| D1   | Delivery Driver               | $15.00/hr | Non-Agricultural | 18      | Driving required |

**Questions for organization:**

- [ ] Are rates accurate? (Agricultural minimum: $8/hr, Non-agricultural: $15/hr)
- [ ] Any additional task codes needed?
- [ ] Any task codes to remove or modify?
- [ ] Effective date for rates?

#### 3.2 Create Production Seed Script

**File to create:** `packages/backend/src/db/seed-production.ts`

```typescript
/**
 * Production seed script - creates task codes only.
 *
 * Does NOT create test employees or passwords.
 * Run ONLY ONCE on fresh production database.
 */

// Implementation: Same as seed.ts but only task codes and rates
// No test employees or documents
```

**Commands:**

```bash
# Run production seed (task codes only)
npm run db:seed:production -w @renewal/backend
```

**Acceptance Criteria:**

- [ ] Task codes confirmed with organization
- [ ] Rates verified accurate
- [ ] Production seed script created (no test data)
- [ ] Task codes seeded to production database
- [ ] Verified via application (login as supervisor, view task codes)

---

### 4. Create Initial Supervisor Account

**Why**: At least one supervisor must exist to onboard employees and approve timesheets.

#### 4.1 Determine Initial Supervisor

**Collect from organization:**

- Full name: **\*\*\*\***\_\_\_\_**\*\*\*\***
- Email: **\*\*\*\***\_\_\_\_**\*\*\*\***
- Temporary password: (will be reset on first login)

#### 4.2 Create Account via API or Script

**Option A: Admin seed script**

**File to create:** `packages/backend/src/db/create-admin.ts`

```typescript
/**
 * Creates initial supervisor account.
 *
 * Usage: tsx --env-file=.env.production src/db/create-admin.ts \
 *   --name "Sarah Supervisor" \
 *   --email "sarah@renewal.org" \
 *   --password "TempPass123!"
 */
```

**Option B: Direct database insert (if script not needed)**

```sql
-- Run via Vercel Postgres console
INSERT INTO employees (
  name, email, date_of_birth, is_supervisor,
  password_hash, failed_login_attempts, status
) VALUES (
  'Sarah Supervisor',
  'sarah@renewal.org',
  '1989-01-15',  -- Adult
  true,
  '<bcrypt-hash>',  -- Generate: npx bcrypt-cli hash "TempPassword123!"
  0,
  'active'
);
```

**Acceptance Criteria:**

- [ ] Initial supervisor account created
- [ ] Supervisor can log in to production
- [ ] Password reset works for supervisor
- [ ] Supervisor sees empty employee list and task codes

---

### 5. Deploy to Vercel Production

**Why**: Push code to production and verify deployment succeeds.

#### 5.1 Trigger Production Deployment

**Option A: Git push (recommended)**

```bash
git push origin main
```

**Option B: Vercel CLI**

```bash
vercel --prod
```

#### 5.2 Verify Deployment

**Checks:**

- [ ] Build completes successfully (Vercel dashboard → Deployments)
- [ ] No build errors in logs
- [ ] Production URL accessible (https://<app>.vercel.app)
- [ ] API health check returns 200 (`/api/health`)

**Acceptance Criteria:**

- [ ] Production deployment successful
- [ ] No build errors
- [ ] Application loads in browser
- [ ] API responding

---

### 6. Full E2E Test Suite on Production

**Why**: Verify all features work correctly in production environment.

#### 6.1 Manual Smoke Tests

Perform these tests as the initial supervisor:

**Authentication Flow:**

- [ ] Login with supervisor credentials
- [ ] Logout works
- [ ] Invalid credentials rejected
- [ ] Account lockout after 5 failed attempts
- [ ] Password reset email received
- [ ] Password reset completes successfully

**Employee Management:**

- [ ] Create new employee (adult first)
- [ ] Create minor employee (age 14)
- [ ] Upload parental consent document
- [ ] Upload work permit document
- [ ] Employee receives credentials email

**Task Code Management:**

- [ ] View all task codes
- [ ] Task codes filtered by age (test with minor employee)
- [ ] Add new rate to task code
- [ ] Rate versioning visible

**Timesheet Flow (as employee):**

- [ ] Create timesheet for current week
- [ ] Add time entries
- [ ] Task dropdown filtered by age
- [ ] School day tracking works
- [ ] Compliance warnings display
- [ ] Submit timesheet

**Compliance Engine:**

- [ ] Submit valid timesheet → success
- [ ] Submit invalid timesheet (over hours) → compliance error
- [ ] Error messages are actionable
- [ ] Compliance check logs created

**Supervisor Review:**

- [ ] See pending timesheets queue
- [ ] Review timesheet (read-only)
- [ ] Approve timesheet
- [ ] Reject timesheet with notes
- [ ] Employee sees rejection notes

**Payroll:**

- [ ] Calculate payroll for approved timesheet
- [ ] Export CSV downloads correctly
- [ ] Payroll record created

**Alerts & Notifications:**

- [ ] Dashboard shows pending counts
- [ ] Alert notifications display

**Reports:**

- [ ] Compliance audit report generates
- [ ] Timesheet history report generates
- [ ] Filters work correctly

#### 6.2 Automated E2E Tests (Optional)

```bash
# Run Playwright tests against production
# Requires setting PLAYWRIGHT_BASE_URL
PLAYWRIGHT_BASE_URL=https://<app>.vercel.app npm run test:e2e
```

**Note**: Some E2E tests may need modification to work with production (no database reset between tests).

**Acceptance Criteria:**

- [ ] All smoke tests pass
- [ ] Critical user flows verified
- [ ] No JavaScript errors in browser console
- [ ] No 500 errors in API responses

---

### 7. Verify Email Delivery (Postmark)

**Why**: Email notifications are critical for password reset, credentials, and alerts.

#### 7.1 Configure Postmark Production

**Steps:**

1. Log into Postmark dashboard
2. Create production server (or use existing)
3. Get server API token
4. Add to Vercel environment variables
5. Verify sender domain (renewal.org)

**Verification Emails to Send:**

- [ ] Password reset request → Email received
- [ ] New employee creation → Credentials email received
- [ ] (If alerts due) → Alert email received

**Postmark Dashboard Checks:**

- [ ] Activity feed shows sent emails
- [ ] No bounces or complaints
- [ ] Delivery rate > 95%

**Acceptance Criteria:**

- [ ] Postmark production server configured
- [ ] Sender domain verified
- [ ] Test emails delivered successfully
- [ ] No emails going to spam

---

### 8. Verify Document Upload (Vercel Blob)

**Why**: Consent forms and work permits must be uploadable and retrievable.

#### 8.1 Test Document Upload

**Steps:**

1. Create test minor employee
2. Upload parental consent document (PDF)
3. Upload work permit document (PDF)
4. Verify documents appear in employee record
5. Download/view documents

**Verification:**

- [ ] Documents upload without error
- [ ] Documents stored in Vercel Blob
- [ ] Documents retrievable
- [ ] File size limits enforced
- [ ] File type validation works

**Vercel Blob Dashboard Checks:**

- [ ] Files visible in storage
- [ ] Usage within limits

**Acceptance Criteria:**

- [ ] Document upload works
- [ ] Documents persist and are retrievable
- [ ] Storage quotas acceptable

---

### 9. Verify Cron Job Functionality

**Why**: Daily alert checks must run automatically.

#### 9.1 Manual Cron Test

**Trigger cron manually (with auth):**

```bash
curl -X GET "https://<app>.vercel.app/api/crons/check-alerts" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

**Expected response:**

```json
{
  "success": true,
  "alertsGenerated": 0,
  "emailsSent": 0
}
```

**Verification:**

- [ ] Cron endpoint responds with 200
- [ ] Unauthorized requests rejected (401)
- [ ] Alerts generated if employees have upcoming events
- [ ] Emails sent for generated alerts

**Vercel Dashboard Checks:**

- [ ] Cron job visible in project settings
- [ ] Schedule correct (daily at 8 AM ET / 1 PM UTC)

**Acceptance Criteria:**

- [ ] Cron job executes successfully
- [ ] Alerts generated correctly
- [ ] Emails sent for alerts
- [ ] Unauthorized access blocked

---

### 10. Create Backup & Recovery Procedures

**Why**: Must be able to recover from data loss or corruption.

#### 10.1 Document Backup Procedure

**File to create:** `docs/BACKUP.md`

**Content:**

````markdown
# Backup & Recovery Procedures

## Automatic Backups

Vercel Postgres provides automatic daily backups:

- Retention: 7 days (Hobby plan) / 30 days (Pro plan)
- Point-in-time recovery available on Pro plan

## Manual Backup

### Database Export

```bash
# Export full database
pg_dump "DATABASE_URL" > backup_$(date +%Y%m%d).sql

# Export specific tables
pg_dump "DATABASE_URL" -t employees -t timesheets > critical_$(date +%Y%m%d).sql
```
````

### Vercel Blob Export

Documents stored in Vercel Blob are not automatically backed up.
Download critical documents monthly via dashboard or API.

## Recovery Procedures

### Full Database Restore

1. Create new Vercel Postgres database
2. Import backup: `psql "NEW_DATABASE_URL" < backup.sql`
3. Update DATABASE_URL in Vercel environment variables
4. Redeploy

### Point-in-Time Recovery (Pro plan)

1. Go to Vercel Dashboard → Storage → Database
2. Click "Restore"
3. Select date/time
4. Confirm restore

## Testing Backups

Monthly backup verification:

1. Export production database
2. Import to local/test environment
3. Verify data integrity
4. Test key operations

## Retention Policy

Per REQ-022, retain all data for minimum 3 years:

- Timesheets and entries
- Compliance check logs
- Documents (consent forms, work permits)
- Payroll records

````

**Acceptance Criteria:**
- [ ] Backup procedure documented
- [ ] Recovery procedure documented
- [ ] Backup tested (export and verify)
- [ ] Team knows where to find procedures

---

### 11. Document Rollback Procedure

**Why**: Must be able to quickly revert if deployment causes issues.

#### 11.1 Update Deployment Guide

**File to update:** `docs/DEPLOYMENT.md`

**Add rollback section (already exists, verify accuracy):**

```markdown
## Rollback Procedure

### Quick Rollback (Vercel Dashboard)
1. Go to Vercel Dashboard → Project → Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"
4. Confirm promotion

### CLI Rollback
```bash
vercel rollback
````

### Database Rollback

If database changes were made:

1. Identify breaking migration
2. Restore from backup (see BACKUP.md)
3. Or manually reverse migration

### When to Rollback

- Critical functionality broken
- Security vulnerability discovered
- Performance severely degraded
- Data corruption occurring

### Post-Rollback Steps

1. Notify team of rollback
2. Investigate root cause
3. Fix issue in development
4. Deploy fix with enhanced testing

```

**Acceptance Criteria:**
- [ ] Rollback procedure documented
- [ ] Quick rollback tested (promote previous deployment)
- [ ] Team knows rollback process

---

### 12. Security Verification

**Why**: Final security check before real users access the system.

#### 12.1 Security Checklist

**Production Security Verification:**

**HTTPS & Transport:**
- [ ] All URLs use HTTPS (automatic on Vercel)
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header present

**Authentication:**
- [ ] JWT tokens expire appropriately
- [ ] Password reset tokens expire
- [ ] Account lockout working
- [ ] No default/test credentials in production

**API Security:**
- [ ] CORS restricted to production domain
- [ ] Rate limiting active
- [ ] CSRF protection active
- [ ] No sensitive data in error responses

**Environment:**
- [ ] No secrets exposed in client-side code
- [ ] Environment variables not logged
- [ ] Debug endpoints disabled

**Headers (verify via browser dev tools):**
- [ ] Content-Security-Policy present
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] Strict-Transport-Security present

**Acceptance Criteria:**
- [ ] All security checks pass
- [ ] No critical vulnerabilities identified

---

### 13. Soft Launch with Limited Users

**Why**: Validate system with real users before full rollout.

#### 13.1 Define Soft Launch Group

**Recommended initial users:**
- 1 supervisor (primary system admin)
- 2-3 employees (mix of ages if possible)

#### 13.2 Onboard Soft Launch Users

**Steps:**
1. Create employee accounts in production
2. Upload required documents
3. Send credentials (via system email)
4. Provide brief training/walkthrough
5. Establish feedback channel (email, Slack, etc.)

#### 13.3 Monitor Soft Launch Period

**Daily checks during soft launch (1-2 weeks):**
- [ ] Review Vercel function logs for errors
- [ ] Check Postmark for email delivery issues
- [ ] Review any user-reported issues
- [ ] Monitor database performance
- [ ] Check cron job execution logs

**User feedback to collect:**
- [ ] Is login process smooth?
- [ ] Can they create timesheets easily?
- [ ] Are compliance messages understandable?
- [ ] Any confusing UI elements?
- [ ] Any features missing?

**Acceptance Criteria:**
- [ ] Soft launch users successfully using system
- [ ] No critical bugs discovered
- [ ] User feedback collected and reviewed
- [ ] Issues addressed before full launch

---

### 14. Full Launch

**Why**: Open system to all employees after soft launch validation.

#### 14.1 Pre-Launch Checklist

- [ ] Soft launch feedback addressed
- [ ] All critical bugs fixed
- [ ] Performance acceptable
- [ ] Backup procedures tested
- [ ] Team trained on support procedures

#### 14.2 Onboard Remaining Users

**Steps:**
1. Create remaining employee accounts
2. Upload required documents for minors
3. Send credentials emails
4. Schedule training sessions if needed
5. Announce system availability

#### 14.3 Post-Launch Monitoring

**First week after launch:**
- Daily review of error logs
- Daily review of support requests
- Performance monitoring
- User feedback collection

**Ongoing:**
- Weekly review of cron job logs
- Weekly backup verification
- Monthly security review
- Quarterly compliance audit report review

**Acceptance Criteria:**
- [ ] All employees onboarded
- [ ] System operating normally
- [ ] No critical issues
- [ ] Monitoring in place

---

## Files to Create

| File | Purpose |
|------|---------|
| `docs/BACKUP.md` | Backup and recovery procedures |
| `packages/backend/src/db/seed-production.ts` | Production task code seeding |
| `packages/backend/src/db/create-admin.ts` | Create initial supervisor |
| `docs/LAUNCH_CHECKLIST.md` | Launch verification checklist |

## Files to Update

| File | Changes |
|------|---------|
| `docs/DEPLOYMENT.md` | Verify rollback procedure accuracy |
| `.env.example` | Add any missing production variables |

---

## Acceptance Criteria Summary

Phase 13 is complete when:

- [ ] Production environment variables configured
- [ ] Production database created and migrated
- [ ] Task codes seeded with verified rates
- [ ] Initial supervisor account created and verified
- [ ] Application deployed to Vercel production
- [ ] All smoke tests passing
- [ ] Email delivery working (Postmark)
- [ ] Document upload working (Vercel Blob)
- [ ] Cron jobs executing successfully
- [ ] Backup procedure documented and tested
- [ ] Rollback procedure documented and tested
- [ ] Security verification complete
- [ ] Soft launch completed successfully
- [ ] User feedback addressed
- [ ] Full launch completed
- [ ] Monitoring in place

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss | Verify backups before launch, document recovery |
| Security breach | Complete security checklist, monitor logs |
| Performance issues | Load tested in Phase 12, monitor metrics |
| User adoption issues | Soft launch with training, feedback channel |
| Email delivery failures | Test Postmark thoroughly, verify domain |
| Cron job failures | Test manually, monitor logs |

---

## Success Metrics

After 30 days in production:

- [ ] Zero security incidents
- [ ] <5 support tickets per week
- [ ] All timesheets submitted on time
- [ ] Email delivery rate >95%
- [ ] Compliance check <5 seconds (per REQ-011)
- [ ] System uptime >99%

---

## Next Steps

1. Complete pre-deployment checklist
2. Configure production environment variables
3. Set up production database
4. Run `/execute-phase 13` to begin implementation

---

## Emergency Contacts

**During launch, have contact information for:**
- Vercel support (for hosting issues)
- Postmark support (for email issues)
- Organization IT contact
- Primary supervisor

---

## Post-Launch Tasks

After successful launch:

1. Archive development/staging environments if not needed
2. Set up ongoing monitoring alerts
3. Schedule first compliance audit report review
4. Plan first backup restoration drill (month 1)
5. Document lessons learned
6. Celebrate successful launch!
```
