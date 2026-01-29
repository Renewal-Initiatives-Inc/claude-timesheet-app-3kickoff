# Production Launch Checklist

## Overview

This checklist guides you through deploying the Renewal Initiatives Timesheet Application to production. Complete each section in order.

---

## Pre-Deployment Verification

### Code Quality

- [ ] All TypeScript type checks pass (`npm run typecheck`)
- [ ] All unit tests pass (`npm run test:run`)
- [ ] All E2E tests pass locally (`npm run test:e2e`)
- [ ] No ESLint errors (`npm run lint`)
- [ ] Code formatted (`npm run format:check`)

### Repository

- [ ] All changes committed to main branch
- [ ] No merge conflicts
- [ ] Version number updated (if applicable)
- [ ] CHANGELOG updated (if applicable)

---

## Infrastructure Setup

### Vercel Project

- [ ] Vercel project created and connected to GitHub
- [ ] Build settings configured correctly
  - Framework: Vite
  - Build Command: `npm run build`
  - Output Directory: `packages/frontend/dist`
  - Install Command: `npm install`

### Database (Vercel Postgres)

- [ ] Production database created in Vercel Storage
- [ ] DATABASE_URL copied from Vercel dashboard
- [ ] Connection uses pooler endpoint (`-pooler.vercel-storage.com`)
- [ ] Migrations run successfully (`npm run db:migrate`)
- [ ] All tables created (verify via Vercel dashboard)

### Blob Storage (Vercel Blob)

- [ ] Vercel Blob storage created
- [ ] BLOB_READ_WRITE_TOKEN configured
- [ ] Storage quota sufficient for expected documents

---

## Environment Variables

Configure all variables in Vercel Dashboard → Project Settings → Environment Variables.

### Required Variables

| Variable | Set? | Notes |
|----------|------|-------|
| `DATABASE_URL` | [ ] | From Vercel Postgres |
| `JWT_SECRET` | [ ] | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | [ ] | Recommended: `7d` |
| `POSTMARK_API_KEY` | [ ] | From Postmark dashboard |
| `EMAIL_FROM` | [ ] | e.g., `noreply@renewal.org` |
| `FRONTEND_URL` | [ ] | e.g., `https://app.vercel.app` |
| `APP_URL` | [ ] | Same as FRONTEND_URL |
| `NODE_ENV` | [ ] | Set to `production` |
| `CRON_SECRET` | [ ] | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Optional Variables

| Variable | Set? | Default | Notes |
|----------|------|---------|-------|
| `PASSWORD_RESET_EXPIRES_HOURS` | [ ] | 24 | Password reset token lifetime |
| `MAX_LOGIN_ATTEMPTS` | [ ] | 5 | Before account lockout |
| `LOCKOUT_DURATION_MINUTES` | [ ] | 30 | Lockout period |
| `LOG_LEVEL` | [ ] | info | debug, info, warn, error |

### Verification

- [ ] All required variables set for Production environment
- [ ] No development secrets used (generate new ones!)
- [ ] JWT_SECRET is 64+ characters
- [ ] CRON_SECRET is 32+ characters

---

## Data Seeding

### Task Codes

- [ ] Task codes verified with organization (see phase13_plan.md for list)
- [ ] Rates confirmed accurate
  - Agricultural: $8.00/hr
  - Non-Agricultural: $15.00/hr
- [ ] Production seed run:
  ```bash
  npm run db:seed:production -- --confirm
  ```
- [ ] Task codes visible in application

### Initial Supervisor

- [ ] Supervisor name and email obtained from organization
- [ ] Admin account created:
  ```bash
  npm run db:create-admin -- \
    --name "Supervisor Name" \
    --email "supervisor@renewal.org" \
    --password "TempPassword123!"
  ```
- [ ] Supervisor can log in
- [ ] Supervisor password changed after first login

---

## Deployment

### Deploy to Production

- [ ] Push to main branch: `git push origin main`
- [ ] Or use Vercel CLI: `vercel --prod`
- [ ] Build completes successfully (check Vercel dashboard)
- [ ] No build errors in logs

### Verify Deployment

- [ ] Production URL accessible
- [ ] Health check returns 200: `GET /api/health`
- [ ] Login page loads
- [ ] No JavaScript console errors

---

## Functional Testing

### Authentication

- [ ] Supervisor login works
- [ ] Logout works
- [ ] Invalid credentials rejected
- [ ] Account lockout after 5 failed attempts
- [ ] Password reset request sends email
- [ ] Password reset completes successfully

### Employee Management

- [ ] Create adult employee
- [ ] Create minor employee (age 14-17)
- [ ] Upload parental consent document
- [ ] Upload work permit document (for 14+)
- [ ] Employee receives credentials email
- [ ] Employee can log in

### Timesheet Flow

- [ ] Create timesheet for current week
- [ ] Add time entries
- [ ] Task dropdown filtered by age
- [ ] School day tracking works
- [ ] Compliance warnings display correctly
- [ ] Submit compliant timesheet → success
- [ ] Submit non-compliant timesheet → error with guidance

### Supervisor Review

- [ ] Pending timesheets appear in queue
- [ ] Review timesheet (read-only)
- [ ] Approve timesheet
- [ ] Reject timesheet with notes
- [ ] Employee sees rejection notes

### Payroll

- [ ] Calculate payroll for approved timesheet
- [ ] Payroll record created
- [ ] Export CSV downloads correctly
- [ ] CSV contains correct data

### Alerts & Reports

- [ ] Dashboard shows pending counts
- [ ] Compliance audit report generates
- [ ] Timesheet history report generates
- [ ] Report filters work correctly

---

## Email Verification (Postmark)

### Configuration

- [ ] Postmark production server created
- [ ] API key added to environment variables
- [ ] Sender domain verified (or using shared domain)

### Test Emails

- [ ] Password reset email delivered
- [ ] New employee credentials email delivered
- [ ] Emails not going to spam
- [ ] Postmark activity feed shows sent emails

---

## Cron Job Verification

### Manual Test

```bash
curl -X GET "https://your-app.vercel.app/api/crons/check-alerts" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

- [ ] Returns 200 with success response
- [ ] Unauthorized requests return 401
- [ ] Cron visible in Vercel project settings
- [ ] Schedule correct (daily at 1 PM UTC / 8 AM ET)

---

## Security Verification

### HTTPS & Headers

- [ ] All URLs use HTTPS
- [ ] HTTP redirects to HTTPS
- [ ] Security headers present (use browser dev tools):
  - [ ] Content-Security-Policy
  - [ ] X-Content-Type-Options: nosniff
  - [ ] X-Frame-Options: DENY
  - [ ] Strict-Transport-Security

### Authentication Security

- [ ] JWT tokens expire (verify with long session)
- [ ] Password reset tokens expire
- [ ] Account lockout working
- [ ] No default/test credentials exist

### API Security

- [ ] CORS restricted to production domain
- [ ] Rate limiting active (check headers)
- [ ] CSRF protection active
- [ ] No sensitive data in error responses

### Environment Security

- [ ] No secrets in client-side code (check Network tab)
- [ ] No debug endpoints accessible
- [ ] Environment variables not logged

---

## Backup Verification

- [ ] Read BACKUP.md procedures
- [ ] Test database export:
  ```bash
  pg_dump "$DATABASE_URL" > test_backup.sql
  ```
- [ ] Verify backup file is valid
- [ ] Know how to restore (see BACKUP.md)
- [ ] Know rollback procedure (see DEPLOYMENT.md)

---

## Soft Launch

### Define Launch Group

- [ ] Identify 1 supervisor
- [ ] Identify 2-3 test employees (mix of ages if possible)

### Onboard Users

- [ ] Create employee accounts
- [ ] Upload required documents for minors
- [ ] Provide brief training/walkthrough
- [ ] Establish feedback channel (email, Slack, etc.)

### Monitor (1-2 weeks)

- [ ] Daily: Check Vercel function logs for errors
- [ ] Daily: Check Postmark for delivery issues
- [ ] Daily: Review user-reported issues
- [ ] Daily: Monitor database performance
- [ ] Weekly: Check cron job execution logs

### Collect Feedback

- [ ] Login process smooth?
- [ ] Timesheet creation easy?
- [ ] Compliance messages understandable?
- [ ] Any confusing UI elements?
- [ ] Any missing features?

### Address Issues

- [ ] Critical bugs fixed
- [ ] Feedback reviewed and prioritized
- [ ] Ready for full launch

---

## Full Launch

### Pre-Launch

- [ ] Soft launch feedback addressed
- [ ] All critical bugs fixed
- [ ] Performance acceptable
- [ ] Backup procedures tested
- [ ] Team trained on support procedures

### Onboard All Users

- [ ] Create remaining employee accounts
- [ ] Upload documents for all minors
- [ ] Send credentials emails
- [ ] Schedule training if needed
- [ ] Announce system availability

### Post-Launch Monitoring

#### First Week

- [ ] Daily error log review
- [ ] Daily support request review
- [ ] Performance monitoring
- [ ] User feedback collection

#### Ongoing

- [ ] Weekly cron job log review
- [ ] Weekly backup verification
- [ ] Monthly security review
- [ ] Quarterly compliance audit review

---

## Emergency Procedures

### Contacts Ready

- [ ] Vercel support contact
- [ ] Postmark support contact
- [ ] Organization IT contact
- [ ] Primary supervisor contact

### Documents Accessible

- [ ] BACKUP.md location known
- [ ] DEPLOYMENT.md rollback section known
- [ ] API.md available for debugging

---

## Post-Launch Tasks

After successful launch:

- [ ] Archive development environments if not needed
- [ ] Set up ongoing monitoring alerts
- [ ] Schedule first compliance audit report review
- [ ] Plan first backup restoration drill (month 1)
- [ ] Document lessons learned
- [ ] Celebrate successful launch!

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| Organization Admin | | | |
| Primary Supervisor | | | |

---

## Notes

_Add any deployment-specific notes here:_

```
Date:
Notes:
```
