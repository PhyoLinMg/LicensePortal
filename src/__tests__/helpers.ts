import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'
import { generateKeyPairSync, createPrivateKey, sign as cryptoSign } from 'crypto'
import { db } from '@/lib/db'
import { canonicalJson } from '@/lib/crypto'
import { generateProductKeypair } from '@/lib/crypto'

const COOKIE = 'lsrv_session'
const TEST_PASSWORD = 'test-password'

export { TEST_PASSWORD }

// ── Admin auth ──────────────────────────────────────────────────────────────

export async function createAdminToken(): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret)
}

type NRInit = ConstructorParameters<typeof NextRequest>[1]

export async function adminRequest(
  url: string,
  options: RequestInit = {},
): Promise<NextRequest> {
  const token = await createAdminToken()
  const req = new NextRequest(url, options as NRInit)
  req.cookies.set(COOKIE, token)
  return req
}

export function unauthRequest(
  url: string,
  options: RequestInit = {},
): NextRequest {
  return new NextRequest(url, options as NRInit)
}

// ── Database cleanup ────────────────────────────────────────────────────────

export async function truncateAll(): Promise<void> {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE "AuditEvent", "Instance", "License", "Customer", "Product" CASCADE`,
  )
}

// ── Test data factories ─────────────────────────────────────────────────────

export async function createProduct(overrides: { name?: string; slug?: string } = {}) {
  const keypair = generateProductKeypair()
  return db.product.create({
    data: {
      name: overrides.name ?? 'Test Product',
      slug: overrides.slug ?? `prod-${Date.now()}`,
      keyId: 'v1',
      publicKeyB64: keypair.publicKeyB64,
      privateKeyEnc: keypair.privateKeyEnc,
      issuerName: 'test-issuer',
    },
  })
}

export async function createCustomer(overrides: { name?: string; email?: string } = {}) {
  return db.customer.create({
    data: {
      name: overrides.name ?? 'Test Customer',
      email: overrides.email ?? 'customer@test.com',
    },
  })
}

export async function createLicense(deps: { productId: string; customerId: string }, overrides: Record<string, unknown> = {}) {
  return db.license.create({
    data: {
      customerId: deps.customerId,
      productId: deps.productId,
      keyId: 'v1',
      tier: 'pro',
      features: [],
      limits: {},
      notBefore: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      gracePeriodDays: 21,
      status: 'active',
      payloadJson: {},
      signature: 'test-sig',
      licenseText: 'test-payload.test-sig',
      ...overrides,
    },
  })
}

// ── Instance keypair + heartbeat signing ────────────────────────────────────

export interface InstanceKeypair {
  publicKeyB64: string
  signPayload: (payload: object) => string
}

export function generateInstanceKeypair(): InstanceKeypair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer

  function signPayload(payload: object): string {
    const bytes = canonicalJson(payload)
    const privDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer
    const key = createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' })
    return cryptoSign(null, bytes, key).toString('base64url')
  }

  return { publicKeyB64: pubDer.toString('base64'), signPayload }
}
