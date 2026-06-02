import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'crypto'

// ── KEK helpers ──────────────────────────────────────────────────────────────

function getKek(): Buffer {
  const kek = process.env.KEK_BASE64
  if (!kek) throw new Error('KEK_BASE64 env var not set')
  const buf = Buffer.from(kek, 'base64')
  if (buf.length !== 32) throw new Error('KEK_BASE64 must be exactly 32 bytes (256-bit)')
  return buf
}

// Encrypt arbitrary bytes with AES-256-GCM.
// Output format: base64(iv[12] + tag[16] + ciphertext)
export function encryptWithKek(plaintext: Buffer): string {
  const kek = getKek()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', kek, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptWithKek(encryptedB64: string): Buffer {
  const kek = getKek()
  const buf = Buffer.from(encryptedB64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ciphertext = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', kek, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

// ── Ed25519 keypair ──────────────────────────────────────────────────────────

export interface GeneratedKeypair {
  publicKeyB64: string   // SubjectPublicKeyInfo DER, base64 — embed in product binary
  privateKeyEnc: string  // AES-256-GCM encrypted PKCS#8 DER
}

export function generateProductKeypair(): GeneratedKeypair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const privDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer
  const pubDer = publicKey.export({ type: 'spki', format: 'der' }) as Buffer
  return {
    publicKeyB64: pubDer.toString('base64'),
    privateKeyEnc: encryptWithKek(privDer),
  }
}

// ── License signing ──────────────────────────────────────────────────────────

// Canonical JSON: sorted keys, no whitespace, UTF-8
export function canonicalJson(obj: object): Buffer {
  return Buffer.from(JSON.stringify(sortDeep(obj)), 'utf-8')
}

function sortDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortDeep)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortDeep((obj as Record<string, unknown>)[k])])
    )
  }
  return obj
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url').replace(/=+$/, '')
}

export function signLicense(payloadBytes: Buffer, privateKeyEnc: string): string {
  const privDer = decryptWithKek(privateKeyEnc)
  const privateKey = createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' })
  const sig = cryptoSign(null, payloadBytes, privateKey)
  return b64url(sig)
}

// Returns the full .lic text: base64url(payload).base64url(sig)
export function buildLicenseText(payload: object, privateKeyEnc: string): string {
  const payloadBytes = canonicalJson(payload)
  const payloadB64 = b64url(payloadBytes)
  const sigB64 = signLicense(payloadBytes, privateKeyEnc)
  return `${payloadB64}.${sigB64}`
}

// ── Heartbeat signature verification ────────────────────────────────────────

export function verifyInstanceSignature(
  payloadBytes: Buffer,
  sigB64url: string,
  instancePublicKeyB64: string
): boolean {
  try {
    const pubDer = Buffer.from(instancePublicKeyB64, 'base64')
    const publicKey = createPublicKey({ key: pubDer, format: 'der', type: 'spki' })
    // restore base64url padding
    const pad = (4 - (sigB64url.length % 4)) % 4
    const sig = Buffer.from(sigB64url + '='.repeat(pad), 'base64url')
    return cryptoVerify(null, payloadBytes, publicKey, sig)
  } catch {
    return false
  }
}

// Sign the heartbeat response with the product's private key
export function signHeartbeatResponse(responseBody: object, privateKeyEnc: string): string {
  const bytes = canonicalJson(responseBody)
  return signLicense(bytes, privateKeyEnc)
}
