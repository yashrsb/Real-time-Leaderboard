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
- `src/services/` - Business logic layer
- `src/repositories/` - Data access layer
- `src/db/` - Prisma and Redis client setup
- `src/middleware/` - Error handling, authentication, logging
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

### Required Environment Variables

| Variable         | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `NODE_ENV`       | Runtime environment (`development`, `test`, `production`)    |
| `PORT`           | Server port (default: `3000`)                                |
| `HOST`           | Server host (default: `0.0.0.0`)                             |
| `DATABASE_URL`   | PostgreSQL connection string                                 |
| `REDIS_URL`      | Redis connection string                                      |
| `JWT_SECRET`     | Secret key for signing JWT access tokens (min 32 characters) |
| `JWT_EXPIRES_IN` | JWT expiration duration (default: `15m`)                     |

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

### Authentication

#### POST /api/v1/auth/register

Create a new user account.

**Request:**

```json
{
  "username": "player_one",
  "email": "player@example.com",
  "password": "secure-password"
}
```

**Response (201 Created):**

```json
{
  "user": {
    "id": "uuid",
    "username": "player_one",
    "email": "player@example.com",
    "createdAt": "2026-08-11T10:00:00.000Z"
  }
}
```

#### POST /api/v1/auth/login

Authenticate and receive an access token.

**Request:**

```json
{
  "email": "player@example.com",
  "password": "secure-password"
}
```

**Response (200 OK):**

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "user": {
    "id": "uuid",
    "username": "player_one",
    "email": "player@example.com"
  }
}
```

#### GET /api/v1/auth/me

Get the current authenticated user. Requires `Authorization: Bearer <token>`.

**Response (200 OK):**

```json
{
  "user": {
    "id": "uuid",
    "username": "player_one",
    "email": "player@example.com",
    "createdAt": "2026-08-11T10:00:00.000Z",
    "updatedAt": "2026-08-11T10:00:00.000Z"
  }
}
```

### Health

#### GET /api/v1/health

Returns application health status including dependency checks.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-08-11T12:00:00.000Z",
  "dependencies": {
    "postgres": "ok",
    "redis": "ok"
  }
}
```

### Games

#### POST /api/v1/games

Create a new game. Requires authentication.

**Request:**

```http
POST /api/v1/games
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

```json
{
  "name": "Space Runner",
  "slug": "space-runner",
  "description": "Fast-paced arcade game"
}
```

**Response (201 Created):**

```json
{
  "game": {
    "id": "uuid",
    "name": "Space Runner",
    "slug": "space-runner",
    "description": "Fast-paced arcade game",
    "createdAt": "2026-08-11T10:00:00.000Z",
    "updatedAt": "2026-08-11T10:00:00.000Z"
  }
}
```

#### GET /api/v1/games

List all available games. Public endpoint.

**Response (200 OK):**

```json
{
  "games": [
    {
      "id": "uuid",
      "name": "Space Runner",
      "slug": "space-runner",
      "description": "Fast-paced arcade game",
      "createdAt": "2026-08-11T10:00:00.000Z",
      "updatedAt": "2026-08-11T10:00:00.000Z"
    }
  ]
}
```

#### GET /api/v1/games/:gameId

Retrieve a single game by ID. Public endpoint.

**Response (200 OK):**

```json
{
  "game": {
    "id": "uuid",
    "name": "Space Runner",
    "slug": "space-runner",
    "description": "Fast-paced arcade game",
    "createdAt": "2026-08-11T10:00:00.000Z",
    "updatedAt": "2026-08-11T10:00:00.000Z"
  }
}
```

**Error Responses:**

```json
{
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "Game not found."
  }
}
```

```json
{
  "error": {
    "code": "GAME_SLUG_ALREADY_EXISTS",
    "message": "A game with this slug already exists."
  }
}
```

### Score Submission

#### POST /api/v1/games/:gameId/scores

Submit a score for a game. Requires authentication.

**Request:**

```http
POST /api/v1/games/:gameId/scores
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: application/json
```

```json
{
  "score": 1500
}
```

**Response (201 Created):**

```json
{
  "score": {
    "id": "uuid",
    "gameId": "uuid",
    "userId": "uuid",
    "score": 1500,
    "createdAt": "2026-08-11T15:00:00.000Z"
  }
}
```

**Architecture:**

```text
Score Submission
       │
       ├──────────────► PostgreSQL
       │                 Immutable score history
       │
       └──────────────► Redis
                         Current best score
                         Sorted Set leaderboard
```

PostgreSQL stores every score submission as immutable history. Redis maintains each user's highest score per game using a Sorted Set for fast leaderboard queries.

**Redis Key Format:**

```text
leaderboard:game:{gameId}
```

**Redis Member Format:**

```text
user:{userId}
```

### Leaderboard

#### GET /api/v1/leaderboards/:gameId

Retrieve the paginated leaderboard for a game. Public endpoint.

**Query Parameters:**

| Parameter | Type    | Default | Constraints    |
| --------- | ------- | ------- | -------------- |
| `page`    | integer | `1`     | `>= 1`         |
| `limit`   | integer | `20`    | `>= 1, <= 100` |

**Request:**

```http
GET /api/v1/leaderboards/<GAME_ID>?page=1&limit=20
```

**Response (200 OK):**

```json
{
  "gameId": "uuid",
  "entries": [
    {
      "rank": 1,
      "userId": "uuid",
      "username": "player_two",
      "score": 2200
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPlayers": 42,
    "totalPages": 3
  }
}
```

**Empty leaderboard (200 OK):**

```json
{
  "gameId": "uuid",
  "entries": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPlayers": 0,
    "totalPages": 0
  }
}
```

**Error Responses:**

```json
{
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "Game not found."
  }
}
```

```json
{
  "error": {
    "code": "LEADERBOARD_UNAVAILABLE",
    "message": "Leaderboard is temporarily unavailable."
  }
}
```

**Architecture:**

```text
Leaderboard Request
        │
        ├─────────────────► Redis Sorted Set
        │                    ZREVRANGE → ranked entries
        │                    ZCARD → total player count
        │
        └─────────────────► PostgreSQL
                             findByIds → usernames/user metadata
```

Redis provides all ranking, ordering, pagination, and total player count. PostgreSQL is only used to resolve user metadata (username) for the ranked entries returned by Redis. Score history remains in PostgreSQL and is never used for leaderboard ordering.

#### GET /api/v1/leaderboards/:gameId/me

Retrieve the authenticated user's ranking in a game, including nearby players. Requires `Authorization: Bearer <token>`.

**Response (200 OK):**

```json
{
  "gameId": "uuid",
  "userId": "uuid",
  "score": 1500,
  "rank": 3,
  "totalPlayers": 42,
  "nearbyPlayers": [
    {
      "rank": 1,
      "userId": "uuid",
      "username": "player_two",
      "score": 2200,
      "isCurrentUser": false
    },
    {
      "rank": 2,
      "userId": "uuid",
      "username": "player_three",
      "score": 1800,
      "isCurrentUser": false
    },
    {
      "rank": 3,
      "userId": "uuid",
      "username": "player_one",
      "score": 1500,
      "isCurrentUser": true
    }
  ]
}
```

**Architecture:**

```text
/me Request
        │
        ├─────────────────► Redis Sorted Set
        │                    ZREVRANK → user rank
        │                    ZSCORE → current best score
        │                    ZCARD → total players
        │                    ZREVRANGE → nearby players
        │
        └─────────────────► PostgreSQL
                             findByIds → usernames/user metadata
```

Redis provides real-time ranking, best score, total player count, and nearby players. PostgreSQL is only used to resolve user metadata (username) for the ranked entries. Score history remains in PostgreSQL and is never used for ranking.

**Error Responses:**

```json
{
  "error": {
    "code": "USER_NOT_RANKED",
    "message": "User has not submitted a score for this game."
  }
}
```

```json
{
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "Game not found."
  }
}
```

```json
{
  "error": {
    "code": "LEADERBOARD_UNAVAILABLE",
    "message": "Leaderboard is temporarily unavailable."
  }
}
```

#### GET /api/v1/leaderboards/global

Retrieve the paginated global leaderboard across all games. Public endpoint.

**Query Parameters:**

| Parameter | Type    | Default | Validation     |
| --------- | ------- | ------- | -------------- |
| `page`    | integer | `1`     | `>= 1`         |
| `limit`   | integer | `20`    | `>= 1, <= 100` |

**Request:**

```http
GET /api/v1/leaderboards/global?page=1&limit=20
```

**Response (200 OK):**

```json
{
  "entries": [
    {
      "rank": 1,
      "userId": "user2",
      "username": "player2",
      "score": 9000
    },
    {
      "rank": 2,
      "userId": "user1",
      "username": "player1",
      "score": 8000
    }
  ],
  "totalPlayers": 42,
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalPlayers": 42,
    "totalPages": 3
  }
}
```

#### GET /api/v1/leaderboards/global/me

Retrieve the authenticated user's global ranking across all games. Requires `Authorization: Bearer <token>`.

**Response (200 OK):**

```json
{
  "userId": "user123",
  "rank": 17,
  "score": 14300,
  "totalPlayers": 100
}
```

**Response (404 Not Found):**

```json
{
  "error": {
    "code": "USER_NOT_RANKED",
    "message": "User has not submitted a score for any game."
  }
}
```

### Global Leaderboard Semantics

The global leaderboard represents:

```text
Global score = SUM(best score per game)
```

Redis key: `leaderboard:global`
Redis member: `user:{userId}`

Example:

```text
Chess:
user1 → 1500
user2 → 1000

Trivia:
user1 → 700
user2 → 2000

Global:
user1 → 2200
user2 → 3000
```

### Why Blind ZINCRBY Is Incorrect

Do not execute:

```redis
ZINCRBY leaderboard:global <submittedScore> user:{userId}
```

for every score submission. This would sum all submitted scores instead of tracking best scores.

Example:

```text
user1 submits 1000 → global = 1000
user1 submits 800  → global should remain 1000
                   → but blind ZINCRBY would produce 1800
```

### Correct Delta Model

When a new game best is achieved:

```text
delta = newGameBest - oldGameBest
```

Then:

```redis
ZINCRBY leaderboard:global delta user:{userId}
```

If the submitted score is lower than or equal to the current game best, no Redis update occurs.

### Atomicity

Game leaderboard updates and global leaderboard updates are performed atomically inside a single Redis Lua script. This prevents race conditions during concurrent score submissions.

### Architecture

```text
                         SCORE SUBMISSION
                                │
                                ▼
                         PostgreSQL
                       immutable history
                                │
                                ▼
                         Redis / Lua
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
                 ▼                             ▼
       leaderboard:game:{id}          leaderboard:global
                 │                             │
                 │                             │
          best score/game             SUM(best score/game)
                 │                             │
                 ▼                             ▼
          Game leaderboard             Global leaderboard
```

### Score History

#### GET /api/v1/games/:gameId/scores/history

Retrieve the immutable score submission history for a game. Requires `Authorization: Bearer <token>`.

**Query Parameters:**

| Parameter | Type    | Default | Validation           |
| --------- | ------- | ------- | -------------------- |
| `page`    | integer | `1`     | `>= 1`               |
| `limit`   | integer | `20`    | `>= 1, <= 100`       |
| `from`    | date    | -       | ISO date (inclusive) |
| `to`      | date    | -       | ISO date (inclusive) |

**Request:**

```http
GET /api/v1/games/<GAME_ID>/scores/history?page=1&limit=20&from=2026-08-01&to=2026-08-10
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200 OK):**

```json
{
  "gameId": "uuid",
  "items": [
    {
      "score": 1500,
      "createdAt": "2026-08-10T10:05:00.000Z"
    },
    {
      "score": 1200,
      "createdAt": "2026-08-10T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 42,
    "totalPages": 3
  }
}
```

**Empty history (200 OK):**

```json
{
  "gameId": "uuid",
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

**Architecture:**

```text
Score Submission
        │
        ├──────────────► PostgreSQL
        │                 Immutable score history
        │
        └──────────────► Redis
                          Current best score
                          Sorted Set leaderboard

History Request
        │
        ▼
    PostgreSQL
        │
        ├── WHERE gameId = ?
        ├── ORDER BY createdAt DESC, id DESC
        ├── LIMIT ? OFFSET ?
        └── COUNT(*) WHERE same filters
```

**PostgreSQL vs Redis:**

PostgreSQL stores every score submission as immutable history. Redis maintains only each user's highest score per game for fast leaderboard queries.

Example:

```text
Submissions: 1000 → 1500 → 1200

PostgreSQL:
  1000
  1500
  1200

Redis (best score):
  user1 → 1500
```

Therefore:

- **Leaderboard endpoint** returns `1500`
- **History endpoint** returns `1200, 1500, 1000`

This separation ensures historical accuracy while maintaining real-time ranking performance.

**Date Semantics:**

- `from` is inclusive: `from=2026-08-01` means `>= 2026-08-01 00:00:00`
- `to` is inclusive: `to=2026-08-10` includes the entire day of August 10
- Internally uses a half-open interval: `createdAt >= from AND createdAt < to + 1 day`
- This avoids precision problems at midnight boundaries

**Error Responses:**

```json
{
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "Game not found."
  }
}
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request."
  }
}
```

### Future Phases

- `GET  /api/v1/leaderboards/:gameId/stream`
- `GET  /api/v1/reports/top-players`

## Current Phase

**Phase 10 — Score History** (Complete)

- `GET /api/v1/games/:gameId/scores/history` — Authenticated immutable score history from PostgreSQL
- Supports pagination (`page`, `limit`) and date filtering (`from`, `to`)
- PostgreSQL provides filtering, ordering, and pagination; Redis is not used for historical data
- Newest submissions returned first with deterministic tie-breaking via `id DESC`
- Count query uses the same filters as the history query for accurate pagination metadata

## Future Phases

- **Phase 11** — Server-Sent Events (SSE) for real-time leaderboard updates
- **Phase 12** — Reports and analytics
