# Claude Code Project Context

## Project Overview

Renewal Initiatives Timesheet Application - A compliance-focused timesheet system for managing youth worker (ages 12-17) time tracking with child labor law enforcement.

## Key Documents

- `requirements.md` - Business requirements and compliance rules
- `design.md` - System architecture and data model
- `technology_decisions.md` - Technology stack rationale
- `implementation_plan.md` - Build phases and tasks
- `CONVENTIONS.md` - Naming conventions (read before generating code)

## Naming Conventions

Read CONVENTIONS.md before generating:

- UI components (.tsx files)
- API routes
- Test files

Key requirements:

- All interactive elements need data-testid
- Modals use onClose/onSubmit callbacks
- Error state uses error/fieldErrors variables

## Tech Stack

- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Drizzle ORM
- Frontend: React + TypeScript
- Testing: Vitest (unit) + Playwright (E2E)
- Hosting: Vercel

## Workflow Commands

- `/plan-phase N` - Plan implementation for phase N
- `/execute-phase N` - Execute the approved plan
- `/commit-phase N` - Commit, merge, and clean up phase N
