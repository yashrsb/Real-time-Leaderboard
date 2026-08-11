# Real-time Leaderboard

## Overview

A production-ready backend for a real-time leaderboard system built with Node.js, TypeScript, Fastify, PostgreSQL, Prisma, and Redis.

## Planned Features

- User registration and authentication
- Game management
- Score submission and history
- Real-time leaderboards via Server-Sent Events (SSE)
- Analytics reports

## Tech Stack

| Category       | Technology     |
| -------------- | -------------- |
| Runtime        | Node.js        |
| Language       | TypeScript     |
| Framework      | Fastify        |
| Database       | PostgreSQL     |
| ORM            | Prisma         |
| Cache          | Redis          |
| Validation     | Zod            |
| Logging        | Pino           |
| Testing        | Vitest         |
| Linting        | ESLint         |
| Formatting     | Prettier       |
| Infrastructure | Docker Compose |

## Architecture

Clean modular monolith with clear separation of concerns:

- `src/app.ts` - Fastify application setup and plugin registration
- `src/server.ts` - Server bootstrap, config loading, and graceful shutdown
- `src/config/` - Environment configuration and validation
- `src/controllers/` - Thin request handlers
- `src/routes/` - API route definitions
- `src/services/` - Business logic (future)
- `src/repositories/` - Data access layer (future)
- `src/db/` - Prisma and Redis client setup
- `src/middleware/` - Error handling, logging, validation (future)
- `src/types/` - TypeScript type definitions
- `src/utils/` - Shared utilities

## Project Structure

```
realtime-leaderboard/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── db/
│   ├── middleware/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── types/
│   ├── utils/
│   ├── app.ts
│   └── server.ts
├── tests/
│   ├── unit/
│   └── integration/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docs/
│   └── database-design.md
├── docker/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── eslint.config.mjs
├── package.json
├── tsconfig.json
├── README.md
└── ...
```

## Database

### Providers

- **PostgreSQL**: Neon (serverless PostgreSQL)
- **Redis**: Upstash Redis

### Entity Relationship

```text
User
 └── Score
      └── Game
```

### Tables

| Table    | Purpose                                                   |
| -------- | --------------------------------------------------------- |
| `users`  | Stores authenticated users with unique username and email |
| `games`  | Stores game definitions with unique slug for URLs         |
| `scores` | Immutable score history linking users to games            |

### Key Design Decisions

- **UUID primary keys** for all entities
- **Immutable scores**: Every submission creates a new `Score` row; history is never overwritten
- **Restrict delete behavior**: Users and Games cannot be deleted while referenced by scores, preserving historical integrity
- **Indexes**: Optimized for future leaderboard and reporting queries

### Migration Commands

```bash
npm run prisma:migrate -- --name init_leaderboard_schema
npm run prisma:seed
```

### Seed Data

Development seed includes:

- 3 users: `player_one`, `player_two`, `player_three`
- 3 games: `chess`, `trivia`, `space-runner`
- 9 historical score records

## Prerequisites

- Node.js >= 20
- Docker and Docker Compose
- npm

## Environment Setup

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Adjust values as needed (defaults are provided for local development).

## Running PostgreSQL and Redis

Start the infrastructure using Docker Compose:

```bash
docker compose up -d
```

Verify services are running:

```bash
docker compose ps
```

## Installing Dependencies

```bash
npm install
```

Generate Prisma client:

```bash
npm run prisma:generate
```

## Running the Application

Development mode (with auto-reload):

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm run start
```

The server will be available at `http://localhost:3000`.

## Running Tests

Unit tests:

```bash
npm test
```

Integration tests (requires PostgreSQL):

```bash
npm run test:integration
```

Watch mode:

```bash
npm run test:watch
```

## API

### Current Phase (Phase 2)

```text
GET /api/v1/health
```

#### GET /api/v1/health

Returns application health status including dependency checks.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-08-10T12:00:00.000Z",
  "dependencies": {
    "postgres": "ok",
    "redis": "ok"
  }
}
```

### Future Phases

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET  /api/v1/auth/me`
- `POST /api/v1/games`
- `GET  /api/v1/games`
- `GET  /api/v1/games/:gameId`
- `POST /api/v1/games/:gameId/scores`
- `GET  /api/v1/games/:gameId/scores/history`
- `GET  /api/v1/leaderboards/global`
- `GET  /api/v1/leaderboards/:gameId`
- `GET  /api/v1/leaderboards/:gameId/me`
- `GET  /api/v1/leaderboards/:gameId/stream`
- `GET  /api/v1/reports/top-players`

## Current Phase

**Phase 2 — Database Design** (Complete)

- PostgreSQL schema with User, Game, and Score models
- Immutable score history
- Prisma migrations and seed data
- Database constraint and index strategy
- Integration tests for data model
- Verified against Neon PostgreSQL and Upstash Redis

## Future Phases

- **Phase 3** — Authentication (register, login, JWT)
- **Phase 4** — Game CRUD endpoints
- **Phase 5** — Score submission and history
- **Phase 6** — Redis leaderboard (Sorted Sets)
- **Phase 7** — Leaderboard API endpoints
- **Phase 8** — Server-Sent Events (SSE) for real-time updates
- **Phase 9** — Reports and analytics
