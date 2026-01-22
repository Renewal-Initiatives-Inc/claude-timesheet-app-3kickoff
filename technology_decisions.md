# Technology Decisions - Renewal Initiatives Timesheet Application

## Purpose

This document records all technology stack decisions for the Renewal Initiatives Timesheet Application. Each decision includes the options considered, rationale, and tradeoffs accepted.

## Decision-Making Philosophy

- **Compliance first**: Technology choices prioritize reliability and auditability over cutting-edge features
- **Maintainability over novelty**: Prefer boring, well-documented technology that a small team can maintain
- **Cost-conscious**: Nonprofit budget constraints inform all decisions
- **Understanding over "best practices"**: Each choice should be understood, not just followed

## Confirmed Project Constraints

- **Organization**: Massachusetts 501(c)(3) nonprofit
- **Users**: Youth workers (ages 12-17), adult supervisors (estimated small team <20 total)
- **Compliance requirements**: Child labor laws (federal + MA), COPPA for under-13, 3-year data retention
- **Budget**: Nonprofit/limited budget
- **Team**: Small team, likely maintained by limited technical resources
- **Data sensitivity**: Minor employee data, consent forms, work permits

---

## Decision Log

### Decision 1: Backend Language & Framework

**Decision**: Node.js + Express + TypeScript

**Date**: 2026-01-21

**Options Considered**:

- Node.js + Express + TypeScript - Minimal framework, single language for full stack
- Node.js + NestJS + TypeScript - More structured, steeper learning curve
- Python + FastAPI - Different language than frontend, context-switching overhead

**Rationale**:

- Single language (TypeScript) across frontend and backend reduces cognitive load for small team
- TypeScript's type system helps catch compliance rule errors at compile time
- Express is well-documented with massive community support
- Right-sized for ~20 users with complex business logic

**Key Tradeoffs Accepted**:

- Express requires adding libraries for validation, auth, etc. (vs batteries-included frameworks)
- More manual setup than opinionated frameworks

**Dependencies**: Frontend framework should use TypeScript for consistency

---

### Decision 2: Database

**Decision**: PostgreSQL

**Date**: 2026-01-21

**Options Considered**:

- PostgreSQL - Full-featured relational database, excellent TypeScript integration
- SQLite - File-based, zero config, but weak concurrent write handling
- MySQL - Popular but no advantages over PostgreSQL for this use case

**Rationale**:

- Strong data integrity for compliance audit trails
- JSONB support for flexible fields (compliance check details)
- Excellent date/time handling for age calculations and time window rules
- Type-safe queries via Prisma or Drizzle ORM
- 3-year retention requirements well-supported

**Key Tradeoffs Accepted**:

- Requires managed hosting (vs file-based SQLite)
- Slightly more operational complexity

**Dependencies**: Will need managed PostgreSQL hosting (addressed in Hosting decision)

---

### Decision 3: Frontend Framework

**Decision**: React with TypeScript

**Date**: 2026-01-21

**Options Considered**:

- React with TypeScript - Most popular, massive ecosystem, excellent TS support
- Next.js - More batteries-included but combines frontend/backend concerns
- Vue.js - Approachable but smaller ecosystem

**Rationale**:

- Largest community means most tutorials and Stack Overflow answers
- Excellent TypeScript integration - can share types with backend
- Rich component library ecosystem (forms, tables) fits timesheet UI needs
- Keeps frontend separate from backend for easier compliance rule testing

**Key Tradeoffs Accepted**:

- Need to choose additional libraries (routing, state management)
- More flexibility means more decisions

**Dependencies**: Will use a UI component library for forms and tables

---

### Decision 4: Local Development Environment

**Decision**: Native Mac development (no Docker)

**Date**: 2026-01-21

**Options Considered**:

- Docker containers - Consistent environments, but adds learning overhead
- Native Mac development - Simpler setup, direct installation of tools

**Rationale**:

- Solo/small team doesn't need environment consistency Docker provides
- Node.js + PostgreSQL install easily on Mac without conflicts
- Reduces cognitive load - one less tool to learn
- Can add Docker later if team grows or deployment requires it

**Key Tradeoffs Accepted**:

- Small risk of Mac vs Linux differences (mitigated by CI/CD testing on Linux)
- Need to install PostgreSQL locally or use managed database for dev

**Environment Notes**:

- Development OS: macOS
- Node.js via nvm (Node Version Manager)
- PostgreSQL via Homebrew or managed service free tier
- Production will be Linux - CI/CD pipeline will test on Linux before deploy

---

### Decision 5: Hosting Platform & Deployment Environments

**Decision**: Vercel (full stack) with Dev + Prod environments

**Date**: 2026-01-21

**Options Considered**:

- Railway - Simple deployment but user experience concerns
- Render - Similar to Railway, free tier sleeps after inactivity
- Vercel (full stack) - Frontend hosting, serverless functions, managed Postgres, Blob storage
- DigitalOcean App Platform - Established but less polished DX

**Rationale**:

- User preference based on prior experience
- Single platform for all services reduces operational complexity
- Vercel Functions work well for Express API endpoints
- Vercel Postgres (Neon) provides managed PostgreSQL with connection pooling
- Vercel Blob handles document uploads (consent forms, work permits)
- Generous free tiers fit nonprofit budget
- Built-in CI/CD: push to GitHub → auto-deploy

**Key Tradeoffs Accepted**:

- Serverless model slightly different than traditional Express server
- Vendor lock-in to Vercel ecosystem
- Need to structure backend as API routes/functions

**Environment Notes**:

- Two environments: Dev (preview deployments) + Prod (main branch)
- Vercel runs on Linux - catches Mac/Linux differences on deploy
- Automatic HTTPS included

**Services Used**:
| Component | Service | Free Tier |
|-----------|---------|-----------|
| Frontend | Vercel Hosting | Generous |
| Backend | Vercel Functions | 100 GB-hrs/month |
| Database | Vercel Postgres | 0.5 GB |
| File Storage | Vercel Blob | 1 GB |

**Estimated Cost**: $0-20/month (likely $0-5 at ~20 user scale)

---

### Decision 6: Email Service

**Decision**: Postmark

**Date**: 2026-01-21

**Options Considered**:

- Resend - Modern API but user had negative experience
- SendGrid - Mature but complex dashboard
- Postmark - Reliable transactional email, simple API
- AWS SES - Overkill complexity for this scale

**Rationale**:

- User preference based on prior experience
- Limited email needs (credentials, password reset, permit alerts)
- Postmark is reliable for transactional email
- Simple, focused service without unnecessary features
- Free tier: 100 emails/month for first month, then $15/month for 10,000 emails

**Key Tradeoffs Accepted**:

- Less generous free tier than some alternatives
- At ~20 users with occasional alerts, volume is minimal

**Email Use Cases**:

- New employee credentials
- Password reset links
- Work permit expiration alerts (30 days before)
- Age 14 transition alerts (30 days before)

---

### Decision 7: Authentication Strategy

**Decision**: Built-in authentication (bcrypt + JWT + PostgreSQL sessions)

**Date**: 2026-01-21

**Options Considered**:

- Built-in authentication - Full control, no third-party data sharing
- Auth.js (NextAuth) - Designed for Next.js, adaptation needed
- Clerk/Auth0 - Third-party services, COPPA concerns with minor data

**Rationale**:

- COPPA compliance: Minor data (ages 12+) stays in your PostgreSQL, no third-party storage
- Simple requirements: email/password, reset, lockout - no social logins needed
- Full control over account blocking (missing permits, revoked consent)
- Mature libraries: bcrypt, jsonwebtoken, express-session

**Key Tradeoffs Accepted**:

- More code to write and maintain
- Responsible for security implementation (following established patterns)
- Must implement password reset flow manually

**Implementation Approach**:

- `bcrypt` for password hashing
- `jsonwebtoken` for API authentication tokens
- Sessions stored in PostgreSQL (auditable, survives restarts)
- Failed login counter → lock after 5 attempts
- Password reset via Postmark with time-limited token

---

### Decision 8: Testing Framework

**Decision**: Vitest (unit/integration) + Playwright (end-to-end)

**Date**: 2026-01-21

**Options Considered**:

- Jest - Established but slower, more configuration
- Vitest - Modern, fast, native TypeScript support, compatible with Jest API
- Playwright - Cross-browser E2E testing, excellent developer experience
- Cypress - E2E alternative, but Playwright has better TypeScript support

**Rationale**:

- Vitest is fast and has excellent TypeScript support out of the box
- Same test syntax works for backend (compliance rules) and frontend (React components)
- Playwright enables testing full user flows (critical for compliance verification)
- Both tools work well on Mac (dev) and Linux (CI/CD on Vercel)

**Key Tradeoffs Accepted**:

- Vitest is newer than Jest (but API-compatible and well-adopted)
- Two test tools to learn (unit vs E2E have different patterns anyway)

**Testing Strategy**:
| Test Type | Tool | Purpose |
|-----------|------|---------|
| Unit tests | Vitest | Compliance rule functions, age calculations, payroll math |
| Integration tests | Vitest | API endpoints, database operations |
| Component tests | Vitest + React Testing Library | React components in isolation |
| End-to-end tests | Playwright | Full user flows (login → timesheet → submit → approve) |

**Environment Validation**:

- Tests run on Mac during development
- Vercel CI runs tests on Linux before deploy
- Playwright tests run in real browsers (Chrome, Firefox, Safari)

---
