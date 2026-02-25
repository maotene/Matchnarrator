# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NarratorMatchCenter** - A full-stack monorepo for real-time football match narration. Narrators register live match events, manage team rosters, and track player positions on an interactive field canvas.

## Commands

All commands run from the repo root using `pnpm`.

### Development
```bash
pnpm dev          # Run both backend (port 3001) and frontend (port 3000)
pnpm dev:api      # Backend only
pnpm dev:web      # Frontend only
```

### Building
```bash
pnpm build        # Build everything
pnpm build:api    # Backend only
pnpm build:web    # Frontend only
```

### Testing
```bash
pnpm test         # All tests
pnpm test:api     # Backend unit tests
pnpm test:web     # Frontend component tests

# Run a single backend test file:
cd apps/api && pnpm test -- <filename>
cd apps/api && pnpm test:e2e    # E2E tests
cd apps/api && pnpm test:cov    # Coverage report
```

### Linting & Formatting
```bash
pnpm lint                          # Lint all
cd apps/api && pnpm format         # Prettier (backend)
```

### Database
```bash
pnpm docker:up        # Start PostgreSQL container (required before running locally)
pnpm docker:down      # Stop container
pnpm prisma:migrate   # Run migrations
pnpm prisma:seed      # Seed test data
pnpm prisma:studio    # Open Prisma Studio GUI
cd apps/api && pnpm prisma:generate  # Regenerate Prisma client after schema changes
```

## First-Time Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm docker:up
```

pnpm v10 blocks native build scripts by default. After install, rebuild the native addon manually:
```bash
cd node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt && npm rebuild && cd -
```

Sync the schema and seed (uses `db push` since no migrations folder exists yet):
```bash
cd apps/api
node_modules/.bin/prisma db push
node_modules/.bin/ts-node prisma/seed.ts
```

> Note: `pnpm prisma:migrate` runs `prisma migrate dev` which requires an interactive TTY.
> Use `prisma db push` for dev or create migrations with `prisma migrate dev --name <name>` in a terminal.

Seed creates two test users:
- `admin@example.com` / `Admin123!` (SUPERADMIN)
- `narrador@example.com` / `Narrador123!` (NARRADOR)

## Architecture

### Monorepo Structure
- `apps/api/` — NestJS 10 backend, REST API on port 3001
- `apps/web/` — Next.js 14 (App Router) frontend on port 3000
- `packages/shared/` — Shared TypeScript types, enums, constants imported as `@matchnarrator/shared`

### Backend (`apps/api/src/`)
NestJS modular architecture. Modules:
- **auth** — JWT authentication (Passport), guards, strategies, role decorators
- **users** — User CRUD
- **competitions / seasons / teams / players** — Catalog management (SUPERADMIN only)
- **matches** — Match session lifecycle (SETUP → LIVE → HALFTIME → FINISHED)
- **roster** — Player lineups with field coordinates (x/y positions)
- **events** — In-game event recording (13 event types)
- **export** — JSON export of full match data
- **prisma** — Prisma service (database client wrapper)

Database schema is at `apps/api/prisma/schema.prisma`. After editing it, run `prisma:migrate` and `prisma:generate`.

### Frontend (`apps/web/src/`)
- **App Router pages**: `(auth)/login`, `(dashboard)/dashboard`, `(dashboard)/match/[id]`
- **State**: Zustand stores at `lib/stores/auth-store.ts` and `lib/stores/match-store.ts`
- **UI**: Radix UI primitives + Tailwind CSS (shadcn/ui pattern), components in `components/ui/`
- **Key components**:
  - `components/field/field-canvas.tsx` — Interactive soccer field using `react-konva` (drag & drop player positioning)
  - `components/timer/timer-component.tsx` — Real-time match timer with period management
  - `components/timeline/event-timeline.tsx` — Live event feed with filters

### Shared Package (`packages/shared/src/`)
- `types/index.ts` — All shared enums and interfaces (UserRole, MatchStatus, MatchPeriod, EventType, etc.)
- `constants/index.ts` — Hotkey bindings (G=Goal, F=Foul, Y=Yellow Card, R=Red Card, etc.), field dimensions (800×600), timer constants

### Roles & Access
- **SUPERADMIN**: Catalog management (competitions, teams, players, seasons)
- **NARRADOR**: Match creation, roster setup, live event recording

### Auth Flow
JWT tokens stored client-side in the Zustand auth store. The API is at `http://localhost:3001/api`. All protected routes use NestJS JWT guards with role checks via `@Roles()` decorator.
