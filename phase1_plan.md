# Phase 1 Execution Plan: Project Scaffolding & Development Environment

## Overview

**Goal**: Set up the foundational project structure and local development environment.

**Phase Deliverable**: Running local dev environment with "Hello World" frontend calling backend API, deployed to Vercel preview.

**Prerequisites**: None (this is the first phase)

**Estimated Files to Create**: ~25-30 files

---

## Task Breakdown

### Task 1.1: Initialize Monorepo Structure

**Description**: Create the root project structure with separate frontend and backend packages.

**Files to Create**:

```
/
├── package.json                    # Root package.json with workspaces
├── .gitignore                      # Git ignore for Node.js/TypeScript project
├── .nvmrc                          # Node version specification
├── README.md                       # Project overview (minimal)
├── packages/
│   ├── backend/
│   │   └── package.json            # Backend package configuration
│   └── frontend/
│       └── package.json            # Frontend package configuration
└── shared/
    └── types/
        └── package.json            # Shared TypeScript types package
```

**Commands to Run**:

```bash
# Initialize root package.json
npm init -y

# Create directory structure
mkdir -p packages/backend packages/frontend shared/types

# Initialize workspaces
```

**Acceptance Criteria**:

- [ ] Root `package.json` defines npm workspaces pointing to `packages/*` and `shared/*`
- [ ] Running `npm install` from root installs dependencies for all packages
- [ ] `.nvmrc` specifies Node.js LTS version (20.x)

---

### Task 1.2: Configure TypeScript for All Packages

**Description**: Set up TypeScript configuration with shared base config and package-specific extensions.

**Files to Create**:

```
/
├── tsconfig.base.json              # Shared TypeScript settings
├── packages/
│   ├── backend/
│   │   └── tsconfig.json           # Backend TypeScript config (extends base)
│   └── frontend/
│       └── tsconfig.json           # Frontend TypeScript config (extends base)
└── shared/
    └── types/
        ├── tsconfig.json           # Shared types config
        └── src/
            └── index.ts            # Type exports entry point
```

**Configuration Details**:

`tsconfig.base.json`:

- `strict: true` - Full type checking for compliance rule safety
- `esModuleInterop: true` - CommonJS/ESM compatibility
- `skipLibCheck: true` - Faster compilation
- `forceConsistentCasingInFileNames: true` - Cross-platform compatibility

`packages/backend/tsconfig.json`:

- `module: "NodeNext"` - Node.js ESM support
- `moduleResolution: "NodeNext"`
- `outDir: "./dist"`
- References `shared/types`

`packages/frontend/tsconfig.json`:

- Configured via Vite's React template defaults
- References `shared/types`

**Acceptance Criteria**:

- [ ] `tsc --noEmit` passes in all packages
- [ ] Backend can import types from `@renewal/types`
- [ ] Frontend can import types from `@renewal/types`

---

### Task 1.3: Set Up Express Backend Server

**Description**: Create minimal Express server with health check endpoint.

**Files to Create**:

```
packages/backend/
├── src/
│   ├── index.ts                    # Application entry point
│   ├── app.ts                      # Express app configuration
│   └── routes/
│       └── health.ts               # Health check route
├── package.json                    # (update with dependencies)
└── .env.example                    # Environment variable template
```

**Dependencies to Install**:

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "cors": "^2.8.x",
    "helmet": "^7.x"
  },
  "devDependencies": {
    "@types/express": "^4.17.x",
    "@types/cors": "^2.8.x",
    "tsx": "^4.x"
  }
}
```

**API Endpoints**:
| Method | Path | Response |
|--------|------|----------|
| GET | `/api/health` | `{ "status": "ok", "timestamp": "ISO8601" }` |

**Acceptance Criteria**:

- [ ] `npm run dev` starts server on port 3001
- [ ] `curl http://localhost:3001/api/health` returns JSON with status "ok"
- [ ] CORS configured to allow frontend origin
- [ ] Helmet security headers enabled

---

### Task 1.4: Set Up React Frontend with Vite

**Description**: Initialize React application using Vite with TypeScript template.

**Files to Create**:

```
packages/frontend/
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Root component
│   ├── App.css                     # Basic styles
│   └── vite-env.d.ts               # Vite type declarations
├── index.html                      # HTML entry point
├── vite.config.ts                  # Vite configuration
├── package.json                    # (created by Vite, customized)
└── .env.example                    # Environment variable template
```

**Dependencies** (via Vite template):

```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.x",
    "vite": "^5.x",
    "typescript": "^5.x"
  }
}
```

**Vite Configuration**:

- Proxy `/api` requests to backend during development
- Configure environment variable prefix `VITE_`

**Acceptance Criteria**:

- [ ] `npm run dev` starts Vite dev server on port 5173
- [ ] Frontend displays "Hello World" heading
- [ ] Frontend successfully calls `/api/health` and displays response
- [ ] Hot module replacement (HMR) working

---

### Task 1.5: Configure Vitest for Testing

**Description**: Set up Vitest for unit and integration testing in both packages.

**Files to Create**:

```
/
├── vitest.workspace.ts             # Vitest workspace configuration
├── packages/
│   ├── backend/
│   │   ├── vitest.config.ts        # Backend test configuration
│   │   └── src/
│   │       └── __tests__/
│   │           └── health.test.ts  # Health endpoint test
│   └── frontend/
│       ├── vitest.config.ts        # Frontend test configuration
│       ├── src/
│       │   └── __tests__/
│       │       └── App.test.tsx    # App component test
│       └── setupTests.ts           # Test setup (React Testing Library)
```

**Dependencies to Add**:

```json
// Root package.json devDependencies
{
  "vitest": "^1.x",
  "@vitest/coverage-v8": "^1.x"
}

// packages/frontend devDependencies
{
  "@testing-library/react": "^14.x",
  "@testing-library/jest-dom": "^6.x",
  "jsdom": "^24.x"
}

// packages/backend devDependencies
{
  "supertest": "^6.x",
  "@types/supertest": "^6.x"
}
```

**Test Scripts**:

```json
// Root package.json scripts
{
  "test": "vitest",
  "test:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

**Acceptance Criteria**:

- [ ] `npm test` runs tests in both packages
- [ ] Backend health endpoint has passing test
- [ ] Frontend App component has passing test
- [ ] Tests can import shared types

---

### Task 1.6: Set Up Playwright for E2E Testing

**Description**: Configure Playwright for end-to-end testing with a basic smoke test.

**Files to Create**:

```
/
├── playwright.config.ts            # Playwright configuration
├── e2e/
│   └── smoke.spec.ts               # Basic smoke test
└── .github/                        # (for CI later)
```

**Dependencies to Add** (root):

```json
{
  "devDependencies": {
    "@playwright/test": "^1.x"
  }
}
```

**Playwright Configuration**:

- Test against local dev servers (frontend + backend)
- Configure webServer to start both services
- Test Chrome, Firefox (skip Safari for now - CI compatibility)

**E2E Smoke Test**:

```typescript
// e2e/smoke.spec.ts
test('homepage loads and shows health status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading')).toContainText('Hello');
  // Verify API connectivity is displayed
});
```

**Acceptance Criteria**:

- [ ] `npm run test:e2e` starts servers and runs Playwright tests
- [ ] Smoke test verifies frontend loads
- [ ] Smoke test verifies frontend can communicate with backend

---

### Task 1.7: Configure ESLint and Prettier

**Description**: Set up code quality tools for consistent style across packages.

**Files to Create**:

```
/
├── eslint.config.js                # ESLint flat config (v9)
├── .prettierrc                     # Prettier configuration
├── .prettierignore                 # Files to ignore
```

**Dependencies to Add** (root):

```json
{
  "devDependencies": {
    "eslint": "^9.x",
    "@eslint/js": "^9.x",
    "typescript-eslint": "^7.x",
    "eslint-plugin-react": "^7.x",
    "eslint-plugin-react-hooks": "^4.x",
    "prettier": "^3.x",
    "eslint-config-prettier": "^9.x"
  }
}
```

**ESLint Rules Focus**:

- TypeScript strict rules
- React hooks rules
- No unused variables (important for compliance code)
- Consistent import ordering

**Scripts**:

```json
{
  "lint": "eslint packages/",
  "lint:fix": "eslint packages/ --fix",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

**Acceptance Criteria**:

- [ ] `npm run lint` passes with no errors
- [ ] `npm run format:check` passes
- [ ] VS Code ESLint extension works (if used)

---

### Task 1.8: Create Vercel Project Configuration

**Description**: Configure Vercel for deployment with appropriate settings.

**Files to Create**:

```
/
├── vercel.json                     # Vercel project configuration
```

**Vercel Configuration**:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "packages/frontend/dist",
  "framework": "vite",
  "rewrites": [{ "source": "/api/:path*", "destination": "/api/:path*" }],
  "functions": {
    "packages/backend/src/**/*.ts": {
      "runtime": "@vercel/node@3"
    }
  }
}
```

**Environment Variables Needed**:
| Variable | Description | Where Set |
|----------|-------------|-----------|
| `DATABASE_URL` | PostgreSQL connection string | Vercel dashboard |
| `NODE_ENV` | Environment (development/production) | Vercel dashboard |

**Acceptance Criteria**:

- [ ] Vercel project created and connected to GitHub repo
- [ ] Push to any branch creates preview deployment
- [ ] Push to `main` deploys to production
- [ ] Backend API accessible at `/api/*` routes

---

### Task 1.9: Set Up Local PostgreSQL Database

**Description**: Configure local database for development.

**Files to Create/Modify**:

```
packages/backend/
├── .env.example                    # (update with DATABASE_URL)
├── .env.local                      # (gitignored, actual values)
```

**Setup Options**:

**Option A: Local PostgreSQL via Homebrew**

```bash
brew install postgresql@16
brew services start postgresql@16
createdb renewal_dev
```

**Option B: Vercel Postgres Dev Branch**

- Create Vercel Postgres database in dashboard
- Use development branch for local connection

**Environment Variable**:

```
DATABASE_URL="postgresql://user:password@localhost:5432/renewal_dev"
```

**Acceptance Criteria**:

- [ ] `psql $DATABASE_URL` connects successfully
- [ ] Backend can connect to database (connection test endpoint)
- [ ] `.env.local` is in `.gitignore`

---

### Task 1.10: Configure Environment Variables

**Description**: Set up environment variable handling for all environments.

**Files to Create/Modify**:

```
/
├── .env.example                    # Root example (documentation)
├── packages/backend/
│   ├── .env.example                # Backend env template
│   ├── .env.local                  # (gitignored)
│   └── src/
│       └── config/
│           └── env.ts              # Type-safe env loader
├── packages/frontend/
│   ├── .env.example                # Frontend env template
│   └── .env.local                  # (gitignored)
```

**Backend Environment Variables**:

```
# packages/backend/.env.example
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/renewal_dev
FRONTEND_URL=http://localhost:5173
```

**Frontend Environment Variables**:

```
# packages/frontend/.env.example
VITE_API_URL=http://localhost:3001
```

**Type-Safe Env Loader** (`packages/backend/src/config/env.ts`):

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

**Dependencies to Add** (backend):

```json
{
  "dependencies": {
    "zod": "^3.x"
  }
}
```

**Acceptance Criteria**:

- [ ] Backend validates required env vars on startup
- [ ] Missing env vars produce clear error messages
- [ ] All `.env.local` files are gitignored
- [ ] `.env.example` files document all required variables

---

## Shared Types Package Setup

**Files to Create**:

```
shared/types/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # Re-exports all types
    └── api.ts                      # API response types
```

**Package Configuration** (`shared/types/package.json`):

```json
{
  "name": "@renewal/types",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

**Initial Types** (`shared/types/src/api.ts`):

```typescript
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
```

---

## Testing Requirements

### Unit Tests to Write

| Test File                                       | Test Cases                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/backend/src/__tests__/health.test.ts` | - Returns 200 status<br>- Response has correct shape<br>- Timestamp is valid ISO8601 |
| `packages/frontend/src/__tests__/App.test.tsx`  | - Renders without crashing<br>- Displays heading                                     |
| `shared/types/src/__tests__/api.test.ts`        | - Type exports are accessible (compile-time check)                                   |

### E2E Tests to Write

| Test File           | Test Cases                                                           |
| ------------------- | -------------------------------------------------------------------- |
| `e2e/smoke.spec.ts` | - Homepage loads<br>- Health status displayed<br>- No console errors |

---

## Scripts Summary

Root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "build": "npm run build -w backend && npm run build -w frontend",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint packages/",
    "format": "prettier --write .",
    "typecheck": "tsc -b"
  }
}
```

---

## Verification Checklist

Before completing Phase 1, verify:

- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts both frontend and backend
- [ ] Frontend displays "Hello World" at http://localhost:5173
- [ ] Backend responds at http://localhost:3001/api/health
- [ ] Frontend successfully calls backend and displays health status
- [ ] `npm run test:run` passes all tests
- [ ] `npm run test:e2e` passes smoke test
- [ ] `npm run lint` passes
- [ ] `npm run format:check` passes
- [ ] `npm run typecheck` passes
- [ ] Git repository initialized with sensible .gitignore
- [ ] Push to GitHub triggers Vercel preview deployment
- [ ] Preview deployment accessible and functional
- [ ] Local PostgreSQL connection works (or Vercel Postgres dev)

---

## Requirements Traceability

This phase establishes infrastructure for the following requirements:

| Requirement               | How Addressed                                                           |
| ------------------------- | ----------------------------------------------------------------------- |
| REQ-024 (Authentication)  | Foundation: Express server, TypeScript config for secure implementation |
| REQ-022 (Data Retention)  | Foundation: PostgreSQL setup for 3-year retention                       |
| REQ-029 (System Timezone) | Foundation: Environment variable system ready for timezone config       |

---

## Dependencies on Other Phases

**None** - This is Phase 1.

---

## Outputs for Next Phase

Phase 2 (Database Schema & ORM Setup) will use:

- PostgreSQL connection configured in this phase
- TypeScript configuration for type-safe ORM
- Testing infrastructure for database unit tests
- Shared types package for entity types

---

## Notes

1. **Vercel Functions vs Express**: The backend is structured as a standard Express app. For Vercel deployment, the entry point will be adapted to work as a serverless function. This allows the same code to run locally as a traditional server and on Vercel as serverless.

2. **Node Version**: Using Node.js 20.x LTS for stability and long-term support.

3. **No Docker**: Per technology decisions, local development uses native Mac tools. The Vercel deployment environment (Linux) validates cross-platform compatibility.

4. **Minimal Initial Code**: This phase intentionally creates minimal code. The focus is on infrastructure, not features. The "Hello World" app proves the stack works end-to-end.
