# Keyforge — Documentation

## Table of Contents

1. [How It Works](#how-it-works)
2. [Data Model](#data-model)
3. [Issuing a License](#issuing-a-license)
4. [API Reference](#api-reference)
5. [Self-Hosting Guide](#self-hosting-guide)
6. [Integration Guide](#integration-guide)

---

## How It Works

The license server is a vendor-hosted Next.js app (Prisma + PostgreSQL) that issues, tracks, and revokes licenses for self-hosted products. Customers never access it directly — only the vendor operates it.

### Architecture

```
Vendor admin
     │
     ▼
License Portal (this repo)          Customer's server
┌──────────────────────────┐       ┌─────────────────────────────┐
│  Admin UI                │       │  product binary             │
│  /admin/products         │       │                             │
│  /admin/customers        │  lic  │  boot: verify sig locally   │
│  /admin/licenses   ──────┼──────►│  hourly: POST /api/v1/validate│
│                          │       │  hourly: POST /api/v1/heartbeat│
│  POST /api/v1/validate ◄─┼───────┤                             │
│  POST /api/v1/heartbeat◄─┼───────┤                             │
└──────────────────────────┘       └─────────────────────────────┘
```

### Signing & Verification

**Key type:** Ed25519 (asymmetric). Each product has its own keypair.

**Private key storage:** PKCS#8 DER, encrypted at rest with AES-256-GCM using the `KEK_BASE64` environment variable. Stored in `Product.privateKeyEnc`. Never leaves the server unencrypted.

**Public key:** SPKI DER, base64-encoded. Stored in `Product.publicKeyB64`. Copied into the product binary at build time so it can verify licenses offline.

**License token format:**

```
base64url(canonicalJson(payload)) . base64url(Ed25519Signature)
```

Payload is canonical JSON (keys sorted, no whitespace). Signature covers the raw payload bytes.

### Enforcement States

| State | Meaning |
|-------|---------|
| `VALID` | License active, mutations allowed |
| `EXPIRED` | `expiresAt` passed |
| `REVOKED` | Manually revoked by vendor |
| `INVALID` | Bad signature or unknown product |

The product binary checks state on boot (offline, from the token) and via hourly poll (online, from `/api/v1/validate`). Grace semantics (DEGRADED → EXPIRED) are implemented in the product binary using `grace_period_days` from the token.

### Heartbeat Protocol

On every heartbeat the product instance:
1. Sends `license_id`, `instance_id`, `version`, `usage`, `sequence`, `nonce`, `now`, and an Ed25519 `signature` over all fields (using an instance-generated keypair).
2. On first heartbeat also sends `instance_public_key` (SPKI DER, base64) — the server binds it permanently.
3. Server verifies signature, enforces strictly-increasing sequence (replay protection), updates `Instance` record, and returns a signed response including current enforcement state.

### Single-Instance Binding

Each license is bound to exactly one instance. On the first heartbeat the server atomically sets `License.instanceId` to the `instance_id` from the request. All subsequent heartbeats from a **different** `instance_id` are rejected with `409 license_already_bound`.

If a customer replaces their server, a vendor admin must call `POST /api/admin/licenses/[id]/rebind` to clear the binding before the new instance can register.

### Proxy Gate (optional)

When `PROXY_UPSTREAM_URL` is set, `/api/proxy/[...path]` reverse-proxies to the upstream. Requests are blocked with `402` if no active valid license exists (10-second cache). Configure bypass prefixes with `PROXY_BYPASS_PREFIXES` (comma-separated path prefixes that skip the gate; unset = no bypasses).

---

## Data Model

```
Product
  id, name, slug, keyId
  publicKeyB64     ← embed in product binary
  privateKeyEnc    ← AES-GCM encrypted, stays on server
  issuerName
  └── licenses[]

Customer
  id, name, email, notes
  └── licenses[]

License
  id, tier, features[], limits{}
  notBefore, expiresAt, gracePeriodDays
  status: active | revoked | superseded
  instanceId       ← null until first heartbeat
  licenseText      ← full token string
  payloadJson      ← signed claims (audit copy)
  signature
  └── instances[]
  └── auditEvents[]

Instance
  instanceUuid     ← self-reported by product
  publicKey        ← bound on first heartbeat
  latestSequence   ← replay protection
  lastSeenAt, lastVersion, lastUsage

AuditEvent
  type: ISSUE | REVOKE | VALIDATE | HEARTBEAT | INSTANCE_BIND | INSTANCE_REBIND | ADMIN_LOGIN | PRODUCT_CREATE
  payload (JSON)
```

---

## Issuing a License

### Step 1 — Register a Product

Navigate to **Products → New** in the admin UI, or call the API:

```bash
curl -s -X POST https://license.yourcompany.com/api/admin/products \
  -H "Cookie: lsrv_session=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyApp",
    "slug": "myapp",
    "keyId": "v1",
    "issuerName": "yourcompany-license-server"
  }'
```

Response includes `publicKeyB64` — copy this into your product binary at build time. The private key never leaves the server.

### Step 2 — Create a Customer

```bash
curl -s -X POST https://license.yourcompany.com/api/admin/customers \
  -H "Cookie: lsrv_session=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "email": "admin@acme.com"
  }'
```

Note the returned `id` — you need it in Step 3.

### Step 3 — Issue a License

```bash
curl -s -X POST https://license.yourcompany.com/api/admin/licenses \
  -H "Cookie: lsrv_session=<token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "<product-uuid>",
    "customerId": "<customer-uuid>",
    "tier": "pro",
    "features": ["intake", "itglue"],
    "limits": {
      "max_clients": 50,
      "max_intake_per_month": 1000,
      "max_msp_users": 5
    },
    "notBefore": "2026-01-01T00:00:00Z",
    "expiresAt": "2027-01-01T00:00:00Z",
    "gracePeriodDays": 21
  }'
```

Response includes `licenseText` — the full token string to send to the customer. Customer drops it at a path your product reads on boot (or uploads via admin UI).

### Step 4 — Deliver to Customer

Send the `licenseText` value to the customer. They either:
- Place the file at a path your product binary reads on boot (e.g. `/etc/myapp/myapp.lic`), or
- Upload it via your product's admin UI.

### Revoking a License

```bash
curl -s -X POST https://license.yourcompany.com/api/admin/licenses/<id>/revoke \
  -H "Cookie: lsrv_session=<token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer churned"}'
```

Next heartbeat or validate call from the product returns `REVOKED`. The product binary transitions to read-only mode.

---

## API Reference

### Authentication

All `/api/admin/**` routes require cookie `lsrv_session` (HS256 JWT, 2h TTL, JTI-verified server-side).

Public routes (no auth): `/api/v1/validate`, `/api/v1/heartbeat`.

---

### Auth

#### `POST /api/auth/login`

```json
{ "email": "admin@yourcompany.com", "password": "..." }
```

Sets `lsrv_session` cookie on success.

---

#### `POST /api/auth/logout`

Clears `lsrv_session` cookie.

---

### Products

#### `GET /api/admin/products`

Returns all products. `privateKeyEnc` is never returned.

#### `POST /api/admin/products`

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Display name |
| `slug` | yes | Unique identifier embedded in token `product_id` |
| `keyId` | no | Key version string (default `"v1"`) |
| `issuerName` | no | `issuer` field in token (default `"<slug>-license-server"`) |

Response includes `publicKeyB64` — embed in product binary.

---

### Customers

#### `GET /api/admin/customers`

Returns all customers.

#### `POST /api/admin/customers`

| Field | Required |
|-------|----------|
| `name` | yes |
| `email` | no |
| `notes` | no |

---

### Licenses

#### `GET /api/admin/licenses`

Returns all licenses (excludes `licenseText` and `payloadJson` for brevity).

#### `POST /api/admin/licenses`

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `productId` | yes | — | Product UUID |
| `customerId` | yes | — | Customer UUID |
| `tier` | yes | — | e.g. `"pro"`, `"starter"` |
| `expiresAt` | yes | — | ISO8601 UTC |
| `features` | no | `[]` | Feature flags |
| `limits` | no | `{}` | Map of limit name → number |
| `notBefore` | no | now | ISO8601 UTC |
| `gracePeriodDays` | no | `21` | Days after expiry before hard block |
| `heartbeatUrl` | no | `$NEXT_PUBLIC_BASE_URL/api/v1/heartbeat` | Embedded in token |

Response includes `licenseText` (the token to deliver to customer).

#### `GET /api/admin/licenses/[id]`

Full license detail including `licenseText`, `payloadJson`, instances, and audit events.

#### `POST /api/admin/licenses/[id]/revoke`

```json
{ "reason": "..." }
```

`reason` is required. Sets `status = revoked`.

#### `POST /api/admin/licenses/[id]/rebind`

Clears the instance binding (`instanceId → null`) and deletes all `Instance` records for the license. Use when a customer's server is replaced and the old `instance_id` is gone. The next heartbeat from any instance will re-bind.

No request body required. Returns:

```json
{ "ok": true, "previous_instance_id": "..." }
```

---

### Public Enforcement Endpoints

#### `POST /api/v1/validate`

Called by product on boot and hourly poll. No auth required — license text is the credential.

**Request:**
```json
{ "license_text": "<base64url.base64url>" }
```

**Response:**
```json
{
  "state": "VALID",
  "license_id": "...",
  "tier": "pro",
  "features": ["intake"],
  "limits": { "max_clients": 50 },
  "expires_at": "2027-01-01T00:00:00Z",
  "grace_period_days": 21,
  "heartbeat_url": "https://license.yourcompany.com/api/v1/heartbeat",
  "new_license": null
}
```

`state` values: `VALID` | `EXPIRED` | `REVOKED` | `INVALID`

**Error responses:**

| Status | `error` | Meaning |
|--------|---------|---------|
| 400 | `license_text required` | Missing body field |
| 422 | `malformed_license` | Can't parse token |
| 422 | `invalid_license` | Unknown product slug or bad Ed25519 signature (deliberately indistinguishable) |
| 404 | `license_not_found` | `license_id` not in DB (signature was valid) |

---

#### `POST /api/v1/heartbeat`

Called by running product instances. No auth — instance signs payload with its own Ed25519 key.

**Request:**
```json
{
  "license_id": "...",
  "instance_id": "...",
  "version": "1.2.3",
  "usage": { "active_clients": 3 },
  "now": "2026-06-04T10:00:00Z",
  "nonce": "<random string>",
  "sequence": 42,
  "signature": "<base64url Ed25519 over all other fields>",
  "instance_public_key": "<base64 SPKI DER — first heartbeat only>"
}
```

**Response (signed):**
```json
{
  "status": "ok",
  "server_time": "2026-06-04T10:00:01Z",
  "new_license": null,
  "enforcement": {
    "state": "VALID",
    "tier": "pro",
    "features": [...],
    "limits": {...},
    "expires_at": "...",
    "grace_period_days": 21,
    "heartbeat_url": "..."
  },
  "signature": "<base64url Ed25519 over response body>"
}
```

**Error codes:**

| Status | `error` |
|--------|---------|
| 400 | `missing_fields` |
| 400 | `invalid_license_id` (`license_id` not a valid UUID) |
| 400 | `invalid_instance_id` (`instance_id` not a valid UUID) |
| 400 | `invalid_sequence` (`sequence` not a non-negative integer) |
| 400 | `instance_public_key_required_on_first_heartbeat` |
| 400 | `replay_rejected` (sequence not increasing) |
| 401 | `invalid_signature` |
| 404 | `license_not_found` |
| 409 | `license_already_bound` (different instance_id already owns this license) |

---

### Proxy (optional)

#### `ALL /api/proxy/[...path]`

Reverse-proxy to `PROXY_UPSTREAM_URL`. Returns `402 { "error": "NO_LICENSE" | "EXPIRED" | "REVOKED" }` if no valid license. Bypasses defined by `PROXY_BYPASS_PREFIXES`.

---

## Self-Hosting Guide

### Prerequisites

- Docker + Docker Compose (or a PostgreSQL 14+ instance)
- A domain with TLS termination (nginx, Caddy, Cloudflare Tunnel, etc.)

### 1. Generate secrets

```bash
# JWT_SECRET: 64-byte signing secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# ADMIN_PASSWORD_HASH: bcrypt hash of your admin password
node -e "const b=require('bcryptjs'); b.hash('YOUR_PASSWORD', 12).then(console.log)"
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in all values:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong password>
POSTGRES_DB=license_server

JWT_SECRET=<64-byte base64 from step 1>

ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD_HASH=<bcrypt hash from step 1>

NEXT_PUBLIC_BASE_URL=https://license.yourcompany.com

# Required in production — set to the header your reverse proxy exclusively controls.
# "cf-connecting-ip" for Cloudflare, "x-real-ip" for nginx/Caddy.
TRUSTED_PROXY_HEADER=x-real-ip
```

> **bcrypt hash escaping:** Docker Compose interpolates `$` in `.env` files. Bcrypt hashes contain `$` characters — escape each one as `$$`. Example: `$2a$12$abc...` becomes `$$2a$$12$$abc...` in `.env`.

> `KEK_BASE64` is **not** set in `.env` — it lives in OpenBao. You will generate and store it in step 3.

### 3. Bootstrap OpenBao and store the KEK

Start OpenBao first, then initialize it. **Save the unseal key and root token** — they cannot be recovered.

```bash
# Start OpenBao only
docker compose up -d openbao

# Initialize (1 share, 1 threshold — suitable for single-operator deployments)
docker compose exec openbao bao operator init -key-shares=1 -key-threshold=1

# Unseal (repeat after every server reboot)
docker compose exec openbao bao operator unseal <unseal_key>

# Log in with root token
docker compose exec openbao bao login <root_token>

# Enable KV v2 secrets engine
docker compose exec openbao bao secrets enable -path=secret kv-v2

# Enable AppRole auth
docker compose exec openbao bao auth enable approle

# Create read-only policy for keyforge
docker compose exec openbao bao policy write keyforge - <<'EOF'
path "secret/data/keyforge/kek" { capabilities = ["read"] }
EOF

# Create the AppRole (short-lived tokens — 5 min TTL, used only at container startup)
docker compose exec openbao bao write auth/approle/role/keyforge \
  token_policies="keyforge" token_ttl=5m token_max_ttl=10m

# Generate and store a fresh KEK (32 random bytes)
KEK=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
docker compose exec openbao bao kv put secret/keyforge/kek kek_base64="$KEK"

# Get AppRole credentials → add to .env
docker compose exec openbao bao read auth/approle/role/keyforge/role-id
docker compose exec openbao bao write -f auth/approle/role/keyforge/secret-id
```

Add `VAULT_ROLE_ID` and `VAULT_SECRET_ID` from the output above to your `.env`:

```env
VAULT_ROLE_ID=<role_id from above>
VAULT_SECRET_ID=<secret_id from above>
```

> **After every server reboot:** OpenBao starts sealed. Unseal it before starting the other services:
> ```bash
> docker compose up -d openbao
> docker compose exec openbao bao operator unseal <unseal_key>
> docker compose up -d
> ```

### 4. Deploy with Docker Compose

```bash
docker compose up -d
```

Portal starts on port `3001`. On startup the entrypoint:
1. Authenticates to OpenBao via AppRole
2. Fetches `KEK_BASE64` from `secret/keyforge/kek`
3. Runs `prisma migrate deploy`
4. Starts the Next.js server

### 4. Put behind a reverse proxy

Example Caddy config:

```
license.yourcompany.com {
    reverse_proxy localhost:3001
}
```

> **`TRUSTED_PROXY_HEADER`:** Set this to `x-real-ip` (nginx/Caddy) or `cf-connecting-ip` (Cloudflare) so the rate limiter can key on real client IPs. Without it, all clients share one rate-limit bucket.

The container includes a built-in health check using `node` (no `curl` dependency). Orchestrators (Docker Swarm, ECS, Kubernetes liveness probes) can rely on it directly.

### 5. First login

Navigate to `https://license.yourcompany.com/login`. Use the `ADMIN_EMAIL` and password you hashed in step 1.

### 6. Register your product

Go to **Products → New**. Copy the `publicKeyB64` from the response into your product binary at build time.

### Updating

```bash
docker compose pull
docker compose up -d
```

The entrypoint runs `prisma migrate deploy` on startup, applying any pending migrations.

> **Pre-deploy checklist for this release:**
>
> 1. **`prisma migrate deploy` must run before the new container serves traffic.** Migration `0002_add_session_table` adds the `Session` table required for JTI-based session revocation. If the table is missing, `verifySession()` fails on every request → fail-closed admin lockout.
> 2. **Set `TRUSTED_PROXY_HEADER` in your production env** (`x-real-ip` or `cf-connecting-ip`). Without it, all rate-limit buckets collapse to a single `unknown` key — per-IP rate limiting is disabled on the login and heartbeat endpoints.
> 3. **Existing admin sessions will force a re-login.** Old JWTs carry no `jti` claim; `verifySession()` rejects them. Any logged-in admin will be kicked and must log in again after the upgrade.

> **One-time step for deployments that ran v0.1.x (before migrations were introduced):**
> Those deployments created schema via `prisma db push` and have no `_prisma_migrations` history.
> Before upgrading, baseline the initial migration so Prisma does not try to recreate existing tables:
>
> ```bash
> docker compose exec portal-ui npx prisma migrate resolve \
>   --applied 0001_initial \
>   --schema=./prisma/schema.prisma
> ```
>
> Run this once, then `docker compose up -d`. Future upgrades need no manual step.

### Backups

- **PostgreSQL volume** (`pgdata`): back up regularly — contains all license, customer, and product data.
- **OpenBao volume** (`openbaodata`): back up regularly — contains the encrypted KEK. If lost, you cannot decrypt product private keys.
- **OpenBao unseal key**: store offline, separately from the server (printed during `bao operator init`).
- **`ADMIN_PASSWORD_HASH`**: regeneratable via `bcryptjs`; keep a record of the plaintext password in a password manager.

---

## Integration Guide

This section covers everything a developer needs to integrate a product binary with this license server — keypair management, token verification, the heartbeat signing protocol, and the client-side state machine.

---

### Overview

```
Product binary (customer's server)
┌──────────────────────────────────────────────┐
│  Boot                                        │
│    1. Read license file → verifyLicenseText  │
│       (offline, no network)                  │
│    2. POST /api/v1/validate → get state      │
│                                              │
│  Hourly                                      │
│    3. POST /api/v1/heartbeat → signed ping   │
│       → response includes enforcement block  │
│                                              │
│  On state change                             │
│    4. Update local LicenseState              │
│       VALID → allow mutations                │
│       DEGRADED / EXPIRED → read-only         │
│       REVOKED / INVALID → read-only          │
└──────────────────────────────────────────────┘
```

---

### Step 1 — Embed the Product Public Key

When you create a product via `POST /api/admin/products`, the response includes `publicKeyB64` — a base64-encoded SubjectPublicKeyInfo (SPKI) DER representation of the Ed25519 public key.

Embed this value in your product binary at build time. It is used to:
- Verify the license token signature offline at boot.
- Verify heartbeat response signatures from the server.

```
# Example: any config file
LICENSE_PUBLIC_KEY_V1=<publicKeyB64 from product creation>
```

The private key never leaves the license server.

---

### Step 2 — Verify the License Token at Boot (Offline)

**Token format:**

```
<base64url(canonicalJson(payload))>.<base64url(Ed25519Signature)>
```

Both segments use standard base64url encoding with no `=` padding.

**Verification algorithm:**

```
1. Split on the LAST '.' character
2. payloadBytes = base64url_decode(left segment)
3. sig           = base64url_decode(right segment)
4. pubKey        = spki_der_decode(base64_decode(publicKeyB64))
5. valid         = ed25519_verify(pubKey, payloadBytes, sig)
6. if not valid → INVALID state, block mutations
7. payload       = json_parse(payloadBytes)
8. if payload.expires_at < now → EXPIRED
9. if payload.not_before > now → INVALID (not yet valid)
10. → VALID (until server poll updates state)
```

**Payload fields:**

| Field | Type | Description |
|-------|------|-------------|
| `schema_version` | string | `"1"` |
| `issuer` | string | Issuer name from product |
| `key_id` | string | Key version, e.g. `"v1"` |
| `license_id` | string (UUID) | License identifier |
| `product_id` | string | Product slug |
| `customer_id` | string (UUID) | Customer identifier |
| `customer_name` | string | Customer display name |
| `tier` | string | e.g. `"pro"`, `"starter"` |
| `features` | string[] | Enabled feature flags |
| `limits` | object | Map of limit name → number |
| `issued_at` | string (RFC3339) | Issue timestamp |
| `not_before` | string (RFC3339) | Valid from |
| `expires_at` | string (RFC3339) | Expiry timestamp |
| `heartbeat_url` | string | URL to POST heartbeats to |
| `grace_period_days` | number | Days after expiry before hard block |

---

### Step 3 — Poll `/api/v1/validate` Hourly

```http
POST /api/v1/validate
Content-Type: application/json

{ "license_text": "<full token string>" }
```

Response:

```json
{
  "state": "VALID",
  "license_id": "...",
  "tier": "pro",
  "features": ["intake"],
  "limits": { "max_clients": 50 },
  "expires_at": "2027-01-01T00:00:00Z",
  "grace_period_days": 21,
  "heartbeat_url": "https://license.yourcompany.com/api/v1/heartbeat",
  "new_license": null
}
```

`state` is one of `VALID`, `EXPIRED`, `REVOKED`, `INVALID`. Apply it to your local state machine (see Step 6).

---

### Step 4 — Generate an Instance Keypair

Each running product instance needs its own Ed25519 keypair. Generate it once at first startup and persist it (e.g., in a local DB or file). This keypair authenticates all heartbeats for the lifetime of the instance.

```typescript
// Node.js
import { generateKeyPairSync } from 'crypto'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const privateKeyDer = privateKey.export({ type: 'pkcs8', format: 'der' }) as Buffer
const publicKeyDer  = publicKey.export({ type: 'spki',  format: 'der' }) as Buffer

// Persist both. publicKeyB64 is sent on the first heartbeat.
const instancePrivateKey = privateKeyDer        // keep secret, never send
const instancePublicKeyB64 = publicKeyDer.toString('base64')  // sent once on first heartbeat
```

---

### Step 5 — Sign and Send Heartbeats

**Heartbeat request body:**

```json
{
  "license_id":          "<UUID>",
  "instance_id":         "<UUID — stable per instance>",
  "version":             "1.2.3",
  "usage":               { "active_clients": 3 },
  "now":                 "2026-06-04T10:00:00Z",
  "nonce":               "<random string, 8–128 chars>",
  "sequence":            42,
  "signature":           "<base64url Ed25519 sig>",
  "instance_public_key": "<base64 SPKI DER — first heartbeat only>"
}
```

#### Canonical JSON signing algorithm

The signature covers all fields **except** `signature` and `instance_public_key`. The exact algorithm:

1. Build an object containing only the fields to sign:
   ```
   { license_id, instance_id, version, usage, now, nonce, sequence }
   ```
   Omit `signature`. Omit `instance_public_key` even on the first heartbeat.

2. Apply canonical JSON:
   - Recursively sort all object keys alphabetically (applies to nested objects too).
   - Arrays: preserve element order, do not sort.
   - No whitespace (no spaces or newlines).
   - Encode as UTF-8 bytes.

3. Sign the canonical JSON bytes with the instance's Ed25519 private key.

4. Base64url-encode the signature (no `=` padding).

**Example (TypeScript/Node.js):**

```typescript
import { sign } from 'crypto'

function canonicalJson(obj: unknown): Buffer {
  return Buffer.from(JSON.stringify(sortDeep(obj)), 'utf-8')
}

function sortDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortDeep)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.keys(obj as Record<string, unknown>)
        .sort()
        .map(k => [k, sortDeep((obj as Record<string, unknown>)[k])])
    )
  }
  return obj
}

function signHeartbeat(fields: object, privateKeyDer: Buffer): string {
  const payload = canonicalJson(fields)
  const sig = sign(null, payload, {
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8',
  })
  return sig.toString('base64url').replace(/=+$/, '')
}

// Build the request
const sequence = getNextSequence()  // must be strictly increasing
const nonce    = randomBytes(16).toString('hex')

const toSign = { license_id, instance_id, version, usage, now, nonce, sequence }
const signature = signHeartbeat(toSign, instancePrivateKeyDer)

const body = {
  ...toSign,
  signature,
  // only include on first heartbeat:
  ...(isFirstHeartbeat ? { instance_public_key: instancePublicKeyB64 } : {}),
}
```

#### Sequence number

- Start at `0` on the very first heartbeat.
- Increment by at least `1` on every subsequent heartbeat.
- Persist the last-sent sequence — do not reset it on restart. The server rejects any sequence ≤ the last accepted value (`replay_rejected`).

#### Nonce

- Generate a random string (16–32 hex chars is fine) per heartbeat.
- The server deduplicates nonces per `license_id` for 10 minutes. Use a fresh nonce every heartbeat.

#### Verifying the response signature

The server signs its response body with the product's Ed25519 private key. Verify it using the embedded `publicKeyB64`:

```typescript
import { verify } from 'crypto'
import { createPublicKey } from 'crypto'

function verifyResponse(body: object, signatureB64url: string, productPublicKeyB64: string): boolean {
  const pubDer = Buffer.from(productPublicKeyB64, 'base64')
  const pubKey = createPublicKey({ key: pubDer, format: 'der', type: 'spki' })
  const payload = canonicalJson(body)   // same canonicalJson as above
  const sig = Buffer.from(signatureB64url, 'base64url')
  return verify(null, payload, pubKey, sig)
}

// Usage:
const { signature: responseSig, ...responseBody } = await res.json()
if (!verifyResponse(responseBody, responseSig, productPublicKeyB64)) {
  // Response is not from the real license server — treat as unreachable
}
const { enforcement } = responseBody
```

---

### Step 6 — Client-Side State Machine

Maintain a `LicenseState` with the following values and transitions:

```
States: VALID | DEGRADED | EXPIRED | REVOKED | INVALID | UNLICENSED

Boot:
  No license file/DB   → UNLICENSED
  Bad sig / bad format → INVALID
  not_before > now     → INVALID
  expires_at < now     → EXPIRED (may still enter grace)
  Otherwise            → VALID

On successful poll (/validate or /heartbeat enforcement block):
  server returns VALID    → VALID, reset stale timer
  server returns EXPIRED  → EXPIRED
  server returns REVOKED  → REVOKED
  server returns INVALID  → INVALID

On failed poll (network error, timeout, 5xx):
  < 24 hours since last success  → stay in current state (no change)
  ≥ 24 hours since last success  → DEGRADED
  ≥ grace_period_days days since last success → EXPIRED

Enforcement:
  VALID     → full access (all mutations allowed)
  DEGRADED  → read-only (mutations blocked, warn user)
  EXPIRED   → read-only
  REVOKED   → read-only
  INVALID   → read-only
  UNLICENSED→ read-only (or block entirely — your choice)
```

Persist `lastSuccessfulPollAt` and `gracePeriodDays` to survive restarts. On restart with no network, calculate staleness from the persisted timestamp.

---

### Step 7 — Rebinding After Server Replacement

Each license is bound to one `instance_id` on its first heartbeat. If the customer replaces their server (new `instance_id`), they must ask the vendor to rebind:

```bash
# Vendor calls:
curl -X POST https://license.yourcompany.com/api/admin/licenses/<id>/rebind \
  -H "Cookie: lsrv_session=<token>"
```

After rebind, the next heartbeat from any instance_id will re-bind the license.

---

### Minimal Client Checklist

- [ ] Ed25519 keypair generated and persisted at first startup
- [ ] License token verified offline at every boot
- [ ] Sequence number persisted (survives restarts)
- [ ] Canonical JSON implemented exactly (recursive key sort, no array sort, no whitespace, UTF-8)
- [ ] `signature` and `instance_public_key` excluded from signed payload
- [ ] `instance_public_key` sent on first heartbeat only
- [ ] Nonce is fresh each heartbeat (16+ random bytes recommended)
- [ ] Heartbeat response signature verified against embedded product public key
- [ ] State machine with DEGRADED transition at 24h stale
- [ ] EXPIRED transition at `grace_period_days` stale
- [ ] Mutations blocked on any state ≠ VALID
