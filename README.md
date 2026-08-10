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
├── prisma/
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

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

## API

### Current Phase (Phase 1)

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

**Phase 1 — Project Foundation**

- Project scaffolding with TypeScript, Fastify, Prisma, Redis
- Health endpoint with dependency checks
- Docker Compose for PostgreSQL and Redis
- Centralized configuration with Zod validation
- Error handling, request logging, and graceful shutdown
- ESLint, Prettier, and Vitest configured

## Future Phases

- **Phase 2** — PostgreSQL schema and data models (User, Game, Score)
- **Phase 3** — Authentication (register, login, JWT)
- **Phase 4** — Game CRUD endpoints
- **Phase 5** — Score submission and history
- **Phase 6** — Redis leaderboard (Sorted Sets)
- **Phase 7** — Leaderboard API endpoints
- **Phase 8** — Server-Sent Events (SSE) for real-time updates
- **Phase 9** — Reports and analytics
