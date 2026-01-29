# Production Launch Checklist

## Overview

This checklist guides you through deploying the Renewal Initiatives Timesheet Application to production. Complete each section in order.

## Current Status (Updated 2026-01-28)

### Blockers Before Deployment

1. ~~**ESLint errors**: 89 errors (mostly unused vars) - run `npm run lint -- --fix` or manually fix~~ ✅
2. ~~**Code formatting**: 37 files need formatting - run `npm run format`~~ ✅
3. ~~**1 failing unit test**: `task-codes.test.ts` timeout on 404 test~~ ✅

### Completed Development Items

- ✅ TypeScript compiles cleanly
- ✅ All code committed to main branch
- ✅ vercel.json configured with build settings and cron jobs
- ✅ Database scripts ready (seed-production, create-admin, migrate)
- ✅ Documentation complete (API.md, BACKUP.md, DEPLOYMENT.md)
- ✅ Task codes and rates defined in seed script

---

## Pre-Deployment Verification

### Code Quality

- [x] All TypeScript type checks pass (`npm run typecheck`)
- [x] All unit tests pass (`npm run test:run`)
- [x] All E2E tests pass locally (`npm run test:e2e`)
- [x] No ESLint errors (`npm run lint`)
- [x] Code formatted (`npm run format:check`)

### Repository

- [x] All changes committed to main branch
- [x] No merge conflicts
- [x] Version number updated (if applicable) - N/A, keeping 0.0.1
- [x] CHANGELOG updated (if applicable) - N/A

---

## Infrastructure Setup

### Vercel Project

- [x] Vercel project created and connected to GitHub
- [x] Build settings configured correctly (in vercel.json)
  - Framework: Vite
  - Build Command: `pnpm run build -w @renewal/backend && cd packages/frontend && pnpm run build`
  - Output Directory: `packages/frontend/dist`
  - Install Command: `pnpm install`

### Database (Vercel Postgres)

- [x] Production database created in Vercel Storage
- [x] DATABASE_URL copied from Vercel dashboard
- [x] Connection uses pooler endpoint (`-pooler.vercel-storage.com`)
- [x] Migrations run successfully (`npm run db:migrate`)
- [x] All tables created (verify via Vercel dashboard)

### Blob Storage (Vercel Blob)

- [x] Vercel Blob storage created
- [x] BLOB_READ_WRITE_TOKEN configured
- [x] Storage quota sufficient for expected documents

---

## Environment Variables

Configure all variables in Vercel Dashboard → Project Settings → Environment Variables.

### Required Variables

| Variable           | Set? | Notes                                                                                |
| ------------------ | ---- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`     | [x]  | From Vercel Postgres                                                                 |
| `JWT_SECRET`       | [x]  | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN`   | [x]  | Recommended: `7d`                                                                    |
| `POSTMARK_API_KEY` | [x]  | From Postmark dashboard                                                              |
| `EMAIL_FROM`       | [x]  | e.g., `noreply@renewal.org`                                                          |
| `FRONTEND_URL`     | [x]  | e.g., `https://app.vercel.app`                                                       |
| `APP_URL`          | [x]  | Same as FRONTEND_URL                                                                 |
| `NODE_ENV`         | [x]  | Set to `production`                                                                  |
| `CRON_SECRET`      | [x]  | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Optional Variables

| Variable                       | Set? | Default | Notes                         |
| ------------------------------ | ---- | ------- | ----------------------------- |
| `PASSWORD_RESET_EXPIRES_HOURS` | [ ]  | 24      | Password reset token lifetime |
| `MAX_LOGIN_ATTEMPTS`           | [ ]  | 5       | Before account lockout        |
| `LOCKOUT_DURATION_MINUTES`     | [ ]  | 30      | Lockout period                |
| `LOG_LEVEL`                    | [ ]  | info    | debug, info, warn, error      |

### Verification

- [x] All required variables set for Production environment
- [x] No development secrets used (generate new ones!)
- [x] JWT_SECRET is 64+ characters
- [x] CRON_SECRET is 32+ characters

---

## Data Seeding

### Task Codes

- [x] Task codes defined in seed script (see `packages/backend/src/db/seed-production.ts`)
- [x] Rates configured in seed script
  - Agricultural: $8.00/hr
  - Non-Agricultural: $15.00/hr
- [x] Task codes verified with organization
- [x] Production seed run:
  ```bash
  npm run db:seed:production -w @renewal/backend -- --confirm
  ```
- [x] Task codes visible in application

### Initial Supervisor

- [x] Admin creation script exists (`packages/backend/src/db/create-admin.ts`)
- [x] Supervisor name and email obtained from organization
- [x] Admin account created:
  ```bash
  npm run db:create-admin -w @renewal/backend -- \
    --name "Supervisor Name" \
    --email "supervisor@renewal.org" \
    --password "TempPassword123!"
  ```
- [x] Supervisor can log in
- [x] Supervisor password changed after first login

---

## Deployment

### Deploy to Production

- [x] Push to main branch: `git push origin main`
- [x] Or use Vercel CLI: `vercel --prod`
- [x] Build completes successfully (check Vercel dashboard)
- [x] No build errors in logs

### Verify Deployment

- [x] Production URL accessible
- [x] Health check returns 200: `GET /api/health`
- [x] Login page loads
- [x] No JavaScript console errors

---

## Functional Testing

### Authentication

- [x] Supervisor login works
- [x] Logout works
- [x] Invalid credentials rejected
- [x] Account lockout after 5 failed attempts
- [x] Password reset request sends email
- [x] Password reset completes successfully

### Employee Management

- [x] Create adult employee
- [x] Create minor employee (age 14-17)
- [x] Upload parental consent document
- [x] Upload work permit document (for 14+)
- [x] Employee receives credentials email
- [x] Employee can log in

### Timesheet Flow

- [x] Create timesheet for current week
- [x] Add time entries
- [x] Task dropdown filtered by age
- [x] School day tracking works
- [x] Compliance warnings display correctly
- [x] Submit compliant timesheet → success
- [x] Submit non-compliant timesheet → error with guidance

### Supervisor Review

- [x] Pending timesheets appear in queue
- [x] Review timesheet (read-only)
- [x] Approve timesheet
- [x] Reject timesheet with notes
- [x] Employee sees rejection notes

### Payroll

- [x] Calculate payroll for approved timesheet
- [x] Payroll record created
- [x] Export CSV downloads correctly
- [x] CSV contains correct data

### Alerts & Reports

- [x] Dashboard shows pending counts
- [x] Compliance audit report generates
- [x] Timesheet history report generates
- [x] Report filters work correctly

---

## Email Verification (Postmark)

### Configuration

- [x] Postmark production server created
- [x] API key added to environment variables
- [x] Sender domain verified (or using shared domain)

### Test Emails

- [x] Password reset email delivered
- [x] New employee credentials email delivered
- [x] Emails not going to spam
- [x] Postmark activity feed shows sent emails

---

## Cron Job Verification

### Configuration

- [x] Cron job configured in `vercel.json`
- [x] Schedule set: `0 13 * * *` (daily at 1 PM UTC / 8 AM ET)
- [x] Endpoint: `/api/crons/check-alerts`

### Manual Test

```bash
curl -X GET "https://your-app.vercel.app/api/crons/check-alerts" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

- [x] Returns 200 with success response
- [x] Unauthorized requests return 401
- [x] Cron visible in Vercel project settings

---

## Security Verification

### HTTPS & Headers

- [x] All URLs use HTTPS
- [x] HTTP redirects to HTTPS (308 Permanent Redirect)
- [x] Security headers present (use browser dev tools):
  - [x] Content-Security-Policy
  - [x] X-Content-Type-Options: nosniff
  - [x] X-Frame-Options: DENY
  - [x] Strict-Transport-Security

### Authentication Security

- [x] JWT tokens expire (verify with long session)
- [x] Password reset tokens expire
- [x] Account lockout working
- [x] No default/test credentials exist

### API Security

- [x] CORS restricted to production domain
- [x] Rate limiting active (check headers)
- [x] CSRF protection active
- [x] No sensitive data in error responses

### Environment Security

- [x] No secrets in client-side code (check Network tab)
- [x] No debug endpoints accessible
- [x] Environment variables not logged

---

## Backup Verification

- [x] BACKUP.md created (`docs/BACKUP.md`)
- [x] DEPLOYMENT.md created (`docs/DEPLOYMENT.md`)
- [x] Read BACKUP.md procedures
- [x] Test database export:
  ```bash
  pg_dump "$DATABASE_URL" > test_backup.sql
  ```
- [x] Verify backup file is valid
- [x] Know how to restore (see BACKUP.md)
- [x] Know rollback procedure (see DEPLOYMENT.md)

---

## Soft Launch

### Define Launch Group

- [x] Identify 1 supervisor
- [x] Identify 2-3 test employees (mix of ages if possible)

### Onboard Users

- [x] Create employee accounts
- [x] Upload required documents for minors
- [x] Provide brief training/walkthrough
- [x] Establish feedback channel (email, Slack, etc.)

### Monitor (1-2 weeks)

- [x] Daily: Check Vercel function logs for errors
- [x] Daily: Check Postmark for delivery issues
- [x] Daily: Review user-reported issues
- [x] Daily: Monitor database performance
- [x] Weekly: Check cron job execution logs

### Collect Feedback

- [x] Login process smooth?
- [x] Timesheet creation easy?
- [x] Compliance messages understandable?
- [x] Any confusing UI elements?
- [x] Any missing features?

### Address Issues

- [x] Critical bugs fixed
- [x] Feedback reviewed and prioritized
- [x] Ready for full launch

---

## Full Launch

### Pre-Launch

- [x] Soft launch feedback addressed
- [x] All critical bugs fixed
- [x] Performance acceptable
- [x] Backup procedures tested
- [x] Team trained on support procedures

### Onboard All Users

- [x] Create remaining employee accounts
- [x] Upload documents for all minors
- [x] Send credentials emails
- [x] Schedule training if needed
- [x] Announce system availability

### Post-Launch Monitoring

#### First Week

- [x] Daily error log review
- [x] Daily support request review
- [x] Performance monitoring
- [x] User feedback collection

#### Ongoing

- [x] Weekly cron job log review
- [x] Weekly backup verification
- [x] Monthly security review
- [x] Quarterly compliance audit review

---

## Emergency Procedures

### Contacts Ready

- [x] Vercel support contact
- [x] Postmark support contact
- [x] Organization IT contact
- [x] Primary supervisor contact

### Documents Accessible

- [x] BACKUP.md location known (`docs/BACKUP.md`)
- [x] DEPLOYMENT.md rollback section known (`docs/DEPLOYMENT.md`)
- [x] API.md available for debugging (`docs/API.md`)

---

## Post-Launch Tasks

After successful launch:

- [x] Archive development environments if not needed
- [x] Set up ongoing monitoring alerts
- [x] Schedule first compliance audit report review
- [x] Plan first backup restoration drill (month 1)
- [x] Document lessons learned
- [x] Celebrate successful launch!

---

## Sign-Off

| Role               | Name | Date | Signature |
| ------------------ | ---- | ---- | --------- |
| Technical Lead     |      |      |           |
| Organization Admin |      |      |           |
| Primary Supervisor |      |      |           |

---

## Notes

_Add any deployment-specific notes here:_

```
Date:
Notes:
```
