# Deployment Guide - Renewal Initiatives Timesheet

## Overview

This application is designed for deployment on Vercel with:

- **Frontend**: React SPA served as static files
- **Backend**: Express API as Vercel serverless functions
- **Database**: PostgreSQL (Vercel Postgres, Neon, or other provider)

---

## Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com
2. **PostgreSQL Database**: Vercel Postgres, Neon, Supabase, or similar
3. **Node.js 18+**: For local development and builds

---

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Authentication
JWT_SECRET=your-secure-random-string-min-32-chars

# Frontend URL (for CORS)
FRONTEND_URL=https://your-app.vercel.app

# Environment
NODE_ENV=production
```

### Optional Variables

```bash
# Logging
LOG_LEVEL=info  # debug, info, warn, error

# Cron Job Security
CRON_SECRET=your-secure-cron-secret-min-16-chars

# Email (if using notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-smtp-password
```

---

## Deployment Steps

### 1. Database Setup

1. Create a PostgreSQL database (Vercel Postgres recommended)
2. Note the connection string (DATABASE_URL)
3. Run migrations:
   ```bash
   npm run db:migrate
   ```
4. (Optional) Seed initial data:
   ```bash
   npm run db:seed
   ```

### 2. Vercel Project Setup

1. Connect your GitHub repository to Vercel
2. Configure build settings:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: `packages/frontend/dist`
   - **Install Command**: `npm ci`

3. Add environment variables in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add all required variables for Production/Preview/Development

### 3. Vercel Configuration

Create `vercel.json` in project root:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "packages/frontend/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "dist"
      }
    },
    {
      "src": "api/**/*.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/packages/frontend/dist/$1"
    }
  ],
  "crons": [
    {
      "path": "/api/crons/check-alerts",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### 4. Deploy

```bash
# Deploy to production
vercel --prod

# Or push to main branch for automatic deployment
git push origin main
```

---

## Post-Deployment Checklist

### Security Verification

- [ ] HTTPS enforced (automatic on Vercel)
- [ ] Environment variables not exposed in client
- [ ] JWT_SECRET is unique and secure (32+ chars)
- [ ] CORS restricted to FRONTEND_URL
- [ ] Rate limiting active on auth endpoints
- [ ] CSRF protection enabled

### Functionality Testing

- [ ] Login works with test credentials
- [ ] Timesheets can be created/edited
- [ ] Compliance checks pass/fail correctly
- [ ] Supervisor review workflow functions
- [ ] Payroll export generates correctly

### Monitoring Setup

- [ ] Vercel Analytics enabled
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Uptime monitoring (optional)

---

## Cron Jobs

The application uses Vercel Cron for scheduled tasks:

| Job                       | Schedule       | Description                 |
| ------------------------- | -------------- | --------------------------- |
| `/api/crons/check-alerts` | Daily 6 AM UTC | Check for compliance alerts |

### Securing Cron Jobs

1. Set `CRON_SECRET` environment variable (16+ chars)
2. Vercel automatically includes authorization header
3. Logs unauthorized attempts

---

## Database Migrations

### Running Migrations

```bash
# Generate migration from schema changes
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (development only)
npm run db:push
```

### Production Migration Strategy

1. Create migration in development
2. Test migration on staging/preview
3. Deploy to production (migrations run automatically)

---

## Troubleshooting

### Common Issues

**Build Fails: TypeScript Errors**

```bash
# Run type check locally first
npm run typecheck
```

**Database Connection Issues**

- Verify DATABASE_URL format
- Check connection pool limits (serverless needs small pools)
- Ensure SSL is enabled for production

**CORS Errors**

- Verify FRONTEND_URL matches exactly (including protocol)
- Check for trailing slashes

**Rate Limiting Issues**

- Rate limits reset on deployment
- Check X-RateLimit-\* headers for status

### Logs

View logs in Vercel dashboard:

1. Go to Project → Deployments → Select deployment
2. Click "Functions" tab for API logs
3. Use "Runtime Logs" for real-time debugging

---

## Performance Optimization

### Frontend

- Lazy loading enabled for routes
- Vendor chunk splitting configured
- Static assets cached by Vercel CDN

### Backend

- Database indexes on frequently queried columns
- Compliance checks optimized to < 5 seconds
- Connection pooling for serverless

### Monitoring

- Vercel Analytics for Web Vitals
- Server-side logging with Pino

---

## Rollback Procedure

1. Go to Vercel Dashboard → Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"

Or via CLI:

```bash
vercel rollback
```

---

## Support

For issues:

1. Check Vercel deployment logs
2. Review this guide's troubleshooting section
3. File issue on GitHub repository
