# Renewal Timesheet

Compliance-first timesheet system for managing youth worker (ages 12-17) time tracking with automated child labor law enforcement — built for [Renewal Initiatives](https://renewalinitiatives.org), a Massachusetts 501(c)(3) nonprofit operating a 56-acre regenerative farm.

## What It Does

- **Enforces 37 compliance rules** across 5 age bands at the point of time entry, blocking non-compliant submissions with clear guidance
- **Tracks task-coded time** for accurate pay calculations at varying rates (agricultural vs. non-agricultural work)
- **Streamlines supervisor review** with a read-only approval workflow and audit trail
- **Integrates with the financial system** for fund allocation, GL staging records, and payroll flow
- **Maintains a 3-year audit trail** for regulatory defense

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express, TypeScript |
| Frontend | React 18, Vite, React Router v7 |
| Database | PostgreSQL (Neon) via Drizzle ORM |
| Auth | Zitadel OIDC (JWT + PKCE) |
| Testing | Vitest (unit), Playwright (E2E) |
| Hosting | Vercel |
| Email | Postmark |
| File Storage | Vercel Blob |

## Project Structure

```
packages/
  backend/       Express API server (routes, services, middleware, DB)
  frontend/      React SPA (pages, components, hooks, auth)
shared/
  types/         Shared TypeScript types (@renewal/types)
e2e/             Playwright end-to-end tests
docs/            API docs, deployment guide, troubleshooting
```

## Getting Started

```bash
# Prerequisites: Node 20+, pnpm
pnpm install

# Set up environment
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env

# Run database migrations
pnpm --filter backend db:push

# Start development
pnpm dev
```

## Built With

Built by a non-developer + [Claude Code](https://claude.ai/claude-code) as a demonstration of AI-assisted application development.

## License

[MIT](LICENSE)