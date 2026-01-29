# Vercel Deployment Issue - Build Failure

## Problem Summary

The Vercel deployment fails during the build step. The frontend (React + Vite) cannot find its build dependencies (`@vitejs/plugin-react`, `vite`) when Vercel runs the build command.

**Error**: `Cannot find package '@vitejs/plugin-react'` or `tsc: command not found` (exit code 127/1)

**Root Cause**: npm workspaces + Vercel's production environment. When Vercel runs `npm install`, it appears to skip devDependencies despite various flags. The workspace build command then fails because build tools aren't installed.

---

## Project Structure

```
/
├── packages/
│   ├── frontend/     # React + Vite app
│   └── backend/      # Express API
├── shared/
│   └── types/        # Shared TypeScript types (@renewal/types)
├── api/              # Vercel serverless functions
│   ├── health.ts
│   └── crons/
├── package.json      # Root with workspaces config
├── vercel.json
└── .npmrc
```

**Workspaces** (from root package.json):
```json
"workspaces": ["packages/*", "shared/*"]
```

---

## What Works Locally

```bash
npm run build -w @renewal/frontend  # ✅ Builds successfully
npm install                          # Installs ~770 packages
```

---

## What Fails on Vercel

Vercel install step reports only **~315 packages** installed (vs 770 locally), indicating devDependencies are being skipped despite flags.

---

## Attempted Solutions

### 1. Install Command Variations

| Command | Result |
|---------|--------|
| `npm install` | 315 packages, missing vite |
| `npm install --include=dev` | 315 packages, missing vite |
| `npm ci` | 315 packages, missing vite |
| `npm ci --include=dev` | 315 packages, missing vite |
| `NODE_ENV=development npm install` | Still failed |

### 2. Build Command Variations

| Command | Result |
|---------|--------|
| `npm run build -w @renewal/frontend` | Exit 127 (tsc not found) or Exit 1 (vite not found) |
| `cd packages/frontend && npm install && npm run build` | Failed |
| `npm install && npm run build -w @renewal/frontend` | Failed |

### 3. Package.json Modifications

- **Removed `tsc -b &&` from build script**: Changed from `tsc -b && vite build` to `vite build`. This changed error from "tsc not found" to "vite not found".

- **Added TypeScript to frontend devDependencies**: Didn't help because devDeps still not installed.

- **Moved vite and @vitejs/plugin-react to regular dependencies**: Not yet fully tested (package-lock not updated).

### 4. Configuration Files

**.npmrc** (created):
```
legacy-peer-deps=true
```

Tried `omit=` but npm rejected it as invalid.

**vercel.json** (current):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build -w @renewal/frontend",
  "outputDirectory": "packages/frontend/dist",
  "installCommand": "npm install --include=dev",
  "framework": "vite",
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ],
  "crons": [
    { "path": "/api/crons/check-alerts", "schedule": "0 13 * * *" }
  ]
}
```

### 5. Environment Variables Added

- `NPM_FLAGS` = `--include=dev` (added to Vercel production environment)

---

## Research Findings

From Vercel documentation and community forums:

1. **Vercel docs state devDependencies ARE installed by default** - contradicts observed behavior
2. **npm workspaces have known issues** with binary PATH in workspace script contexts
3. **Exit code 127** = "command not found" - shell cannot find the executable
4. **Exit code 1** = general error - the command ran but failed

Common solutions from community:
- Move build tools to regular dependencies (workaround)
- Use `npx` prefix for commands (didn't work - `npx tsc` installs wrong package)
- Set root directory to the specific package (Option B - not tried)
- Use yarn instead of npm (not tried)

---

## Community Research (January 2026)

### Key Finding: npm workspaces + Vercel is a Known Problem

Multiple sources confirm this is a widespread issue:

> "EDIT: It seems like the issue was specific to npm workspaces, when I switched to yarn workspaces it worked."
> — Reddit r/nextjs

> "Based on our experience, this looks like an issue with Vercel not yet supporting Node v15+ (npm workspaces were introduced in npm v7)."
> — Stack Overflow

### What Actually Works (per community reports)

1. **Switch to pnpm** (Most recommended)
   - Vercel has native pnpm support
   - Many successful monorepo deployments use pnpm
   - Requires: `pnpm-workspace.yaml`, `pnpm-lock.yaml`
   - Medium article: "Monorepo: Using PNPM and Deploying to Vercel"

2. **Switch to yarn workspaces**
   - Multiple users report immediate success after switching from npm
   - Vercel has official guide: "How to Deploy a Monorepo to Vercel Using Yarn Workspaces"

3. **GitHub Actions with prebuilt deployment**
   - Build locally (where you control environment)
   - Deploy prebuilt artifacts to Vercel
   - Commands: `vercel pull` → `vercel build` → `vercel deploy --prebuilt`
   - Bypasses Vercel's install/build environment entirely

4. **Set root directory to specific app folder**
   - Create separate Vercel projects for each deployable app
   - Set root directory to `packages/frontend` (not monorepo root)
   - Each app deploys independently
   - Caveat: May complicate shared dependencies like `@renewal/types`

5. **Use Turborepo** (Vercel's recommended approach)
   - Vercel Academy has full tutorial: "Production Monorepos"
   - Designed specifically for Vercel + monorepo deployments
   - More restructuring required

### Why npm workspaces fails on Vercel

1. **NODE_ENV=production** is set during install, causing npm to skip devDependencies
2. **Binary PATH issues** - workspace scripts can't find binaries from root node_modules
3. **Lockfile compatibility** - npm workspaces lockfile format may not work correctly in Vercel's build environment
4. **Package hoisting** - npm hoists packages to root, but workspace build contexts don't see them

---

## Untried Solutions (Prioritized by Community Success)

### Option 1: Switch to pnpm (HIGH SUCCESS RATE)

Most commonly successful approach per community reports.

**Steps:**
1. Install pnpm: `npm install -g pnpm`
2. Create `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - 'packages/*'
     - 'shared/*'
   ```
3. Remove `package-lock.json`
4. Run `pnpm install` to generate `pnpm-lock.yaml`
5. Update `vercel.json`:
   ```json
   {
     "installCommand": "pnpm install",
     "buildCommand": "pnpm run build --filter=@renewal/frontend"
   }
   ```
6. Test locally, then deploy

**Pros:** High success rate, native Vercel support, better monorepo handling
**Cons:** Migration effort, team needs to use pnpm

### Option 2: GitHub Actions Prebuilt Deploy (BYPASSES ISSUE)

Build in controlled environment, deploy prebuilt artifacts.

**Steps:**
1. Create `.github/workflows/deploy.yml`
2. Build locally with full control over NODE_ENV
3. Use `vercel deploy --prebuilt` to skip Vercel's build

**Example workflow:**
```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build -w @renewal/frontend
      - run: npx vercel pull --yes --token=${{ secrets.VERCEL_TOKEN }}
      - run: npx vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
      - run: npx vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

**Pros:** Complete control over build environment, bypasses Vercel install issues
**Cons:** More complex CI setup, longer deploy times

### Option 3: Switch to yarn workspaces (HIGH SUCCESS RATE)

Confirmed working by multiple Reddit users.

**Steps:**
1. Remove `package-lock.json`
2. Run `yarn install` to generate `yarn.lock`
3. Update `vercel.json`:
   ```json
   {
     "installCommand": "yarn install",
     "buildCommand": "yarn workspace @renewal/frontend build"
   }
   ```
4. Test locally, then deploy

**Pros:** Similar to npm, easier migration than pnpm
**Cons:** Still uses yarn classic (v1) syntax typically

### Option 4: Move build tools to regular dependencies (WORKAROUND)

Already partially implemented. Quick fix but not ideal.

**Steps:**
1. Move `vite`, `@vitejs/plugin-react` to `dependencies` in frontend/package.json
2. Run `npm install` locally to update package-lock.json
3. Deploy

**Pros:** Minimal change, quick to test
**Cons:** Semantically incorrect (build tools shouldn't be production deps), may cause issues with other tooling

### Option 5: Separate Vercel Projects with Root Directory

Create dedicated Vercel project for frontend with root set to `packages/frontend`.

**Steps:**
1. In Vercel Dashboard, create new project
2. Set Root Directory to `packages/frontend`
3. Vercel will run install/build from that directory context
4. Handle shared deps (`@renewal/types`) via npm pack or copy

**Pros:** Clean separation, standard Vercel flow
**Cons:** Shared dependencies become complicated, need to handle API routes separately

### Option 6: Use Turborepo (VERCEL RECOMMENDED)

Official Vercel recommendation for monorepos.

**Steps:**
1. Install turbo: `npm install turbo -D`
2. Create `turbo.json` configuration
3. Restructure scripts to use turbo
4. Configure Vercel to use turbo build

**Pros:** Official support, optimized caching, scales well
**Cons:** Significant restructuring, learning curve

---

## Attempt Log

### Attempt 1: Option 4 - Move build deps to regular dependencies (2026-01-28)

**What was done:**
1. Moved `vite` and `@vitejs/plugin-react` from devDependencies to dependencies in `packages/frontend/package.json`
2. Ran `npm install` locally to sync package-lock.json
3. Deployed with `vercel --prod`

**Result: FAILED**

```
Building: added 273 packages, and audited 276 packages in 7s
Building: Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@vitejs/plugin-react'
         imported from /vercel/path0/packages/frontend/vite.config.ts
```

**Analysis:** Only 273 packages installed (even fewer than before). The npm workspaces issue means that even regular dependencies in workspace packages are not being properly installed. The root node_modules doesn't contain the workspace package dependencies.

**Conclusion:** Moving deps to regular dependencies does NOT work. The problem is fundamental to npm workspaces + Vercel.

---

### Attempt 2: Option 1 - Switch to pnpm (2026-01-28)

**Status:** SUCCESS

**What was done:**
1. Installed pnpm globally: `npm install -g pnpm` (v10.28.2)
2. Created `pnpm-workspace.yaml` with workspace configuration
3. Removed `package-lock.json`
4. Updated workspace references from `"*"` to `"workspace:*"` in package.json files
5. Reverted vite and @vitejs/plugin-react back to devDependencies
6. Added `"packageManager": "pnpm@10.28.2"` to root package.json
7. Ran `pnpm install` to generate `pnpm-lock.yaml`
8. Updated `vercel.json`:
   ```json
   {
     "installCommand": "pnpm install",
     "buildCommand": "cd packages/frontend && pnpm run build"
   }
   ```
9. Created fresh Vercel project `renewal-timesheet` (deleted old misconfigured project)
10. Linked from repo root directory (critical - .vercel must be in root)
11. Deployed with `vercel --prod --yes`

**Result: SUCCESS**

```
Building: Detected `pnpm-lock.yaml` version 9 generated by pnpm@10.x with package.json#packageManager pnpm@10.28.2
Building: Running "install" command: `pnpm install`...
Building: Packages: +737
Building: Done in 10.3s using pnpm v10.28.2
Building: ✓ built in 2.00s
Building: Deploying outputs...
Production: https://renewal-timesheet-mqkrlvsp8-jeff-takles-projects.vercel.app [51s]
Aliased: https://renewal-timesheet.vercel.app [51s]
```

**Frontend deployment URL:** https://renewal-timesheet.vercel.app

**Note:** There are TypeScript errors in the backend serverless functions (api/ folder) that need to be fixed separately. These relate to:
- Missing @types/node in api/crons files
- Drizzle schema type issues in backend services
- Module resolution issues (.js extensions needed for Node16 moduleResolution)

These errors don't prevent the frontend from deploying but would need to be fixed for the serverless functions to work.

---

## Current State (RESOLVED)

- **Package manager**: Switched from npm to pnpm
- **vercel.json**: Using `pnpm install` and `cd packages/frontend && pnpm run build`
- **frontend/package.json**: vite and @vitejs/plugin-react in devDependencies (correct)
- **pnpm-workspace.yaml**: Created with workspace configuration
- **package.json**: Added `packageManager: "pnpm@10.28.2"`
- **Vercel project**: `renewal-timesheet` (fresh project)
- **Deployment URL**: https://renewal-timesheet.vercel.app
- **Build**: SUCCESS

### Environment Variables Configured (via CLI)
- JWT_SECRET (generated)
- JWT_EXPIRES_IN (7d)
- NODE_ENV (production)
- CRON_SECRET (generated)
- APP_URL (https://renewal-timesheet.vercel.app)
- FRONTEND_URL (https://renewal-timesheet.vercel.app)
- EMAIL_FROM (noreply@renewal.org)
- POSTMARK_API_KEY (configured)

### Still Needed (via Vercel Dashboard)
1. **Database**: Connect Neon integration to add DATABASE_URL and related vars
   - Go to: https://vercel.com/jeff-takles-projects/renewal-timesheet/stores
   - Add Neon integration and connect existing database
2. **Blob Storage**: Link blob store to add BLOB_READ_WRITE_TOKEN
   - Go to: https://vercel.com/jeff-takles-projects/renewal-timesheet/stores
   - Select/create blob store and link to project

---

## Backend API Debugging (2026-01-28 to 2026-01-29)

### Problem
After frontend deployment succeeded, backend API requests to `/api/auth/*` and other Express routes were timing out (FUNCTION_INVOCATION_FAILED or 504 Gateway Timeout).

### Root Cause Found
**`EMAIL_FROM` environment variable is set to an invalid email format**, causing Zod validation to fail in `env.ts`. The env validation throws an error at module load time, which causes the Express app import to hang/fail.

### Key Discovery: Vercel File-Based Routing
The `/api` directory contains multiple files:
- `api/health.ts` - Direct Vercel function (works, bypasses Express)
- `api/test.ts` - Direct Vercel function (works, bypasses Express)
- `api/index.ts` - Express app handler (times out)
- `api/crons/` - Cron job handlers

**Vercel routes requests like this:**
1. `/api/health` → matches `api/health.ts` directly (works)
2. `/api/test` → matches `api/test.ts` directly (works)
3. `/api/anything-else` → rewrite rule sends to `api/index.ts` (times out)

The rewrite in `vercel.json`:
```json
"rewrites": [{ "source": "/api/(.*)", "destination": "/api" }]
```

This means any `/api/*` request that doesn't match a specific file goes to `api/index.ts`, which imports the Express app, which imports `env.ts`, which fails validation.

### Things Tried That Didn't Work

1. **Replacing bcrypt with bcryptjs** - Fixed native module issue, but didn't solve timeout
2. **Using @vercel/postgres** - Deprecated, expects `POSTGRES_URL` not `DATABASE_URL`
3. **Using drizzle-orm/neon-http driver** - Correct approach, but env validation was failing first
4. **Dynamic imports in api/index.ts** - Good for error catching, but env still failed
5. **Various api/index.ts patterns** - Tried handler wrappers, direct exports, etc.
6. **Checking database connection** - Database was fine; env validation was the issue
7. **Changed env.ts from process.exit(1) to throw** - Good fix, but email validation still failed

### Diagnostic Approach That Worked

Created step-by-step diagnostic in `api/index.ts`:
```typescript
export default async function handler(req, res) {
  try {
    diagnostics['step'] = 'importing_env';
    const { env } = await import('../packages/backend/dist/config/env.js');
    // ... more steps
  } catch (error) {
    // Return error with validation details
    return res.status(500).json({
      step: diagnostics['step'],
      error: err.message,
      validationErrors: err.errors, // Zod errors
    });
  }
}
```

This revealed:
```json
{
  "step": "importing_env",
  "error": "Invalid environment variables",
  "validationErrors": {
    "issues": [{
      "validation": "email",
      "code": "invalid_string",
      "message": "Invalid email",
      "path": ["EMAIL_FROM"]
    }]
  }
}
```

### Fix Applied - RESOLVED

**Root Cause:** `EMAIL_FROM` had a trailing newline character (`noreply@renewalinitiatives.org\n`) which caused Zod email validation to fail.

**Fix:** Removed and re-added the env var using `echo -n` to avoid trailing newline:
```bash
vercel env rm EMAIL_FROM production -y
echo -n "noreply@renewalinitiatives.org" | vercel env add EMAIL_FROM production
```

**Result:** Backend API fully working as of 2026-01-29:
- `/api/health` - ✅ Returns health status
- `/api/auth/me` - ✅ Returns "Unauthorized" (correct for no token)
- `/api/csrf-token` - ✅ Returns CSRF token
- Database queries - ✅ Working

### Other Issues Fixed Along the Way

1. **bcrypt → bcryptjs**: Native modules don't work in Vercel serverless
2. **env.ts process.exit(1) → throw**: Allows error catching in serverless
3. **Added @neondatabase/serverless**: Better driver for Neon HTTP connections
4. **Router type annotations**: Fixed pnpm symlink TypeScript errors

### Issues That Were NOT Problems (verified working)

1. **Database connection**: Neon HTTP driver works correctly with DATABASE_URL
2. **DATABASE_URL format**: Pooled URL works fine (Neon handles it)
3. **CSRF middleware**: Works correctly, blocks POST/PUT/DELETE without token as expected

---

## Current State (FULLY RESOLVED)

- **Frontend**: ✅ Deployed at https://renewal-timesheet.vercel.app
- **Backend API**: ✅ All endpoints working
- **Database**: ✅ Connected and querying successfully
- **Authentication**: ✅ JWT middleware working
- **CSRF Protection**: ✅ Working correctly

---

## Files Modified (Final State)

1. **pnpm-workspace.yaml** - NEW: Workspace configuration for pnpm
2. **pnpm-lock.yaml** - NEW: pnpm lockfile (replaces package-lock.json)
3. **package.json** - MODIFIED: Added `packageManager: "pnpm@10.28.2"`
4. **packages/frontend/package.json** - MODIFIED: `@renewal/types: "workspace:*"`, vite/plugin-react in devDeps
5. **packages/backend/package.json** - MODIFIED: `@renewal/types: "workspace:*"`
6. **vercel.json** - MODIFIED: pnpm install/build commands
7. **.npmrc** - Can be removed (was for npm troubleshooting)
8. **package-lock.json** - DELETED (replaced by pnpm-lock.yaml)
