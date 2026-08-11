# Authentication

## Overview

Phase 3 adds secure user authentication to the Real-time Leaderboard backend using JWT access tokens and Argon2id password hashing.

## Architecture

```
Register
   ↓
Zod validation
   ↓
AuthService.register()
   ↓
Argon2id hashPassword()
   ↓
UserRepository.create()
   ↓
PostgreSQL

Login
   ↓
Zod validation
   ↓
AuthService.login()
   ↓
verifyPassword()
   ↓
generateToken() (JWT HS256)
   ↓
Return access token

Authenticated Request
   ↓
Authorization: Bearer <token>
   ↓
authenticate middleware
   ↓
verifyToken() (JWT HS256)
   ↓
request.user = { id: sub }
   ↓
Controller / Service
```

## Password Hashing

Argon2id is used for password hashing.

Configuration:

- memoryCost: 2^16 (64 MB)
- timeCost: 3
- parallelism: 1

Argon2id was selected over bcrypt because it is the winner of the Password Hashing Competition and provides stronger resistance to both side-channel and GPU-based attacks.

## JWT Strategy

- Algorithm: HS256
- Expiration: Configurable via `JWT_EXPIRES_IN` (default: `15m`)
- Secret: Required via `JWT_SECRET` environment variable (minimum 32 characters)
- Payload: Minimal — only `sub` (user ID)

Refresh tokens are not implemented in this phase. Only short-lived access tokens are issued.

## Endpoints

| Method | Path                    | Auth | Description                    |
| ------ | ----------------------- | ---- | ------------------------------ |
| POST   | `/api/v1/auth/register` | No   | Create a new user account      |
| POST   | `/api/v1/auth/login`    | No   | Authenticate and receive JWT   |
| GET    | `/api/v1/auth/me`       | Yes  | Get current authenticated user |

## Request Flow

### Registration

1. Client sends `POST /api/v1/auth/register` with `username`, `email`, `password`
2. Controller validates payload with Zod
3. Service normalizes email (trim, lowercase) and username (trim)
4. Service checks for existing email and username
5. Password is hashed with Argon2id
6. User is created in PostgreSQL
7. Safe user representation is returned (no `passwordHash`)

Registration does **not** issue a JWT. Clients must separately call `/login` to obtain a token.

### Login

1. Client sends `POST /api/v1/auth/login` with `email`, `password`
2. Controller validates payload with Zod
3. Service normalizes email
4. Service looks up user by email
5. Service verifies password against stored Argon2id hash
6. Service generates JWT with `sub` = user ID
7. Token and safe user representation are returned

### Authenticated Request

1. Client sends request with `Authorization: Bearer <token>` header
2. `authenticate` middleware extracts and verifies JWT
3. Middleware validates payload and attaches `request.user.id`
4. Controller/service uses the user identity

## Error Handling

| Code                    | HTTP Status | Description                       |
| ----------------------- | ----------- | --------------------------------- |
| `VALIDATION_ERROR`      | 400         | Invalid request payload           |
| `USER_ALREADY_EXISTS`   | 409         | Duplicate email or username       |
| `INVALID_CREDENTIALS`   | 401         | Invalid email or password         |
| `UNAUTHORIZED`          | 401         | Missing or invalid authentication |
| `INTERNAL_SERVER_ERROR` | 500         | Unexpected server error           |

### User Enumeration Protection

Login failures return a generic `INVALID_CREDENTIALS` error regardless of whether the email exists or the password is wrong. This prevents attackers from enumerating valid accounts.

## Security Considerations

- Passwords are never logged or returned in API responses
- Password hashes are never exposed
- JWT secrets are loaded from environment variables only
- JWT algorithm is explicitly configured (HS256) during verification
- Tokens expire after `JWT_EXPIRES_IN` (default 15 minutes)
- Database unique constraints on `username` and `email` remain active
- Race-condition-safe duplicate handling via database constraints AND application-level Prisma P2002 catch
- `/auth/me` returns 401 if the JWT is valid but the user no longer exists

## Configuration

```env
JWT_SECRET=replace-with-a-long-random-secret-in-development
JWT_EXPIRES_IN=15m
```

Do not commit a real `JWT_SECRET` to version control.

## Test Environment

Integration tests require a running PostgreSQL instance. The project includes Docker Compose for local infrastructure:

```bash
docker compose up -d
npm run test:integration
```

Integration tests use timestamp-based unique suffixes for test data and clean up created users in `afterAll`. Tests should not be run against a production database.

For local development without Docker, set `DATABASE_URL` to your local PostgreSQL instance and run:

```bash
npm run test:unit
npm run test:integration
```
