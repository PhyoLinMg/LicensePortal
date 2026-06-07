import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { execSync } from 'child_process'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { resolve } from 'path'

let container: StartedPostgreSqlContainer

export default async function () {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('license_server_test')
    .start()

  const connectionString = container.getConnectionUri()
  process.env.DATABASE_URL = connectionString

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: 'pipe',
    cwd: resolve(__dirname),
  })

  process.env.KEK_BASE64 = randomBytes(32).toString('base64')
  process.env.JWT_SECRET = randomBytes(64).toString('base64')
  process.env.ADMIN_EMAIL = 'test@example.com'
  // Rounds=10: minimum accepted by login/route.ts (which requires >= 10).
  // If that minimum rises, this must match or tests will 500 with "Server misconfigured".
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('test-password', 10)
  process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3001'

  return async () => {
    await container.stop()
  }
}
