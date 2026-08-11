# Database Design

## Providers

- **PostgreSQL**: Neon (serverless PostgreSQL)
- **Redis**: Upstash Redis (future high-speed leaderboard layer)

## Why PostgreSQL?

PostgreSQL is the persistent source of truth for all core entities:

- **Users** — authentication identities and profile data
- **Games** — game definitions and metadata
- **Scores** — immutable historical score events
- **Reporting** — time-range analytics and top-player queries

PostgreSQL provides ACID guarantees, robust relational integrity, and powerful query capabilities that are essential for historical data and reporting.

## Why Redis Separately?

Redis will eventually act as the high-performance leaderboard/ranking layer while PostgreSQL retains durable history. This separation allows:

- PostgreSQL to handle complex reporting and historical analysis
- Redis to serve low-latency leaderboard reads
- Independent scaling of read-heavy leaderboard traffic

## Entity Relationship

```text
User
 └── Score
      └── Game
```

## Models

### User

```text
id           UUID (PK)
username     VARCHAR(50) UNIQUE NOT NULL
email        VARCHAR(255) UNIQUE NOT NULL
passwordHash VARCHAR(255) NOT NULL
createdAt    TIMESTAMP NOT NULL DEFAULT now()
updatedAt    TIMESTAMP NOT NULL DEFAULT now()
```

**Purpose:** Stores authenticated users. `passwordHash` stores only the bcrypt hash; plaintext passwords are never persisted.

### Game

```text
id          UUID (PK)
name        VARCHAR(100) NOT NULL
slug        VARCHAR(50) UNIQUE NOT NULL
description TEXT NULL
createdAt   TIMESTAMP NOT NULL DEFAULT now()
updatedAt   TIMESTAMP NOT NULL DEFAULT now()
```

**Purpose:** Defines a game. `slug` is a URL-safe identifier used in API routes (e.g., `/games/chess`).

### Score

```text
id        UUID (PK)
userId    UUID NOT NULL → User.id
gameId    UUID NOT NULL → Game.id
score     INTEGER NOT NULL
createdAt TIMESTAMP NOT NULL DEFAULT now()
```

**Purpose:** An immutable record of a score event. Every submission creates a new row; existing rows are never updated or deleted.

## Why Immutable Scores?

Scores represent historical events, not mutable state. Treating them as immutable provides:

- **Complete audit trail** — every submission is preserved
- **Time-travel queries** — leaderboard state at any point in time
- **No accidental data loss** — updates cannot destroy history
- **Simpler concurrency** — no race conditions on "current score"

The application layer will create new `Score` records for every submission. There is no `currentScore` on `User` or `bestScore` on `Game`.

## Why Not Store the Leaderboard in PostgreSQL?

PostgreSQL remains the source of truth for durable history. Redis Sorted Sets will later provide efficient ranking and top-N queries. This separation allows:

- PostgreSQL to handle complex reporting and historical analysis
- Redis to serve low-latency leaderboard reads
- Independent scaling of read-heavy leaderboard traffic

## Indexing Strategy

| Index                                | Columns                     | Supported Query                                          |
| ------------------------------------ | --------------------------- | -------------------------------------------------------- |
| `scores_userId_idx`                  | `userId`                    | Get all scores for a user                                |
| `scores_gameId_idx`                  | `gameId`                    | Get all scores for a game                                |
| `scores_gameId_createdAt_idx`        | `gameId, createdAt`         | Get scores for a game within a time period               |
| `scores_userId_gameId_createdAt_idx` | `userId, gameId, createdAt` | Get a user's scores for a specific game, ordered by time |

## Constraints

- `User.username` — UNIQUE, NOT NULL
- `User.email` — UNIQUE, NOT NULL
- `Game.slug` — UNIQUE, NOT NULL
- `Score.userId` — FOREIGN KEY to `User.id`, `ON DELETE RESTRICT`
- `Score.gameId` — FOREIGN KEY to `Game.id`, `ON DELETE RESTRICT`

## Delete Behavior

`ON DELETE RESTRICT` is used for both `Score.userId` and `Score.gameId`. This prevents accidental deletion of users or games that have associated score history, preserving data integrity. Application-level soft-delete or anonymization can be implemented in later phases if needed.

## Migration

Initial migration: `init_leaderboard_schema`

Creates:

- `users` table with unique indexes on `username` and `email`
- `games` table with unique index on `slug`
- `scores` table with foreign keys and indexes
