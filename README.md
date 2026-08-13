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

| Parameter | Type    | Default | Constraints       |
| --------- | ------- | ------- | ----------------- |
| `page`    | integer | `1`     | `>= 1`            |
| `limit`   | integer | `20`    | `>= 1, <= 100`    |

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

### Future Phases

- `GET  /api/v1/games/:gameId/scores/history`
- `GET  /api/v1/leaderboards/global`
- `GET  /api/v1/leaderboards/:gameId/stream`
- `GET  /api/v1/reports/top-players`

## Current Phase

**Phase 8 — User Ranking** (Complete)

- `GET /api/v1/leaderboards/:gameId/me` — Authenticated user ranking with nearby players
- Redis `ZREVRANK` provides zero-based rank, converted to one-based API rank
- Redis `ZSCORE` provides current best score
- Redis `ZCARD` provides total ranked players
- Redis `ZREVRANGE` provides nearby players around the authenticated user
- PostgreSQL resolves usernames via batched `findByIds` to avoid N+1 queries
- Boundary conditions handled for top and bottom of leaderboard

## Future Phases

- **Phase 9** — Server-Sent Events (SSE) for real-time leaderboard updates
- **Phase 10** — Reports and analytics
