# Contributing

## Development Setup

**Prerequisites:** Node.js 20+, Docker + Docker Compose.

```bash
git clone https://github.com/PhyoLinMg/LicensePortal.git
cd LicensePortal
npm install
```

Copy and fill the environment file:

```bash
cp .env.example .env
# Set KEK_BASE64, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH
```

Start Postgres and run migrations:

```bash
docker compose up -d postgres
npx prisma migrate deploy
```

Start the dev server:

```bash
npm run dev   # http://localhost:3001
```

## Running Tests

Tests require a running Postgres instance (the `docker compose up -d postgres` above is sufficient).

```bash
npm test               # run all tests once
npm run test:watch     # watch mode
```

Integration tests create and tear down their own isolated data — no manual DB reset needed between runs.

## Making Changes

- **Schema changes:** create a migration with `npm run db:migrate -- --name <description>`, commit the generated file in `prisma/migrations/`.
- **New public endpoints:** add Zod input validation (see existing heartbeat/validate routes), add rate limiting via `src/lib/ratelimit.ts`, and write integration tests in `src/__tests__/integration/`.
- **Crypto changes:** unit tests live in `src/lib/__tests__/crypto.test.ts` — add cases for any new signing/verification paths.

## Pull Request Guidelines

1. `npm test` must pass with no failures.
2. `npx tsc --noEmit` must pass (no type errors).
3. New public API surface needs at least one integration test covering the happy path and one covering an auth/validation error.
4. Do not commit `.env` or any file containing secrets.
5. One focused PR per change — don't bundle unrelated fixes.

## Security Issues

Do not open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md).
