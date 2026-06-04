# Handoff License Server — Documentation

## Table of Contents

1. [How It Works](#how-it-works)
2. [Data Model](#data-model)
3. [Issuing a License](#issuing-a-license)
4. [API Reference](#api-reference)
5. [Self-Hosting Guide](#self-hosting-guide)

---

## How It Works

The license server is a vendor-hosted Next.js app (Prisma + PostgreSQL) that issues, tracks, and revokes licenses for self-hosted products (e.g., Handoff). Customers never access it directly — only the vendor operates it.

### Architecture

```
Vendor admin
     │
     ▼
License Portal (this repo)          Customer's server
┌──────────────────────────┐       ┌─────────────────────────────┐
│  Admin UI                │       │  Handoff / product binary   │
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

When `PROXY_UPSTREAM_URL` is set, `/api/proxy/[...path]` reverse-proxies to the upstream. Requests are blocked with `402` if no active valid license exists (10-second cache). Configure bypass prefixes with `PROXY_BYPASS_PREFIXES` (default: `api/jobs/`).

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
    "name": "Handoff",
    "slug": "handoff",
    "keyId": "v1",
    "issuerName": "yourcompany-license-server"
  }'
```

Response includes `publicKeyB64` — copy this into your product binary as `app.license.public-keys.v1` (or equivalent). The private key never leaves the server.

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

Response includes `licenseText` — the full token string to send to the customer. Customer drops it at `/etc/handoff/handoff.lic` (or uploads via admin UI).

### Step 4 — Deliver to Customer

Send the `licenseText` value to the customer. They either:
- Place the file at `/etc/handoff/handoff.lic`, or
- Upload it via Handoff admin → Settings → License.

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

All `/api/admin/**` routes require cookie `lsrv_session` (HS256 JWT, 8h TTL).

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
| 422 | `invalid_signature` | Ed25519 sig mismatch |
| 422 | `unknown_product` | `slug` not in DB |
| 404 | `license_not_found` | `license_id` not in DB |

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
# KEK_BASE64: 32-byte AES-256 key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

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

KEK_BASE64=<32-byte base64 from step 1>
JWT_SECRET=<64-byte base64 from step 1>

ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD_HASH=<bcrypt hash from step 1>

NEXT_PUBLIC_BASE_URL=https://license.yourcompany.com

# Optional: proxy to a Handoff backend
# PROXY_UPSTREAM_URL=http://handoff-backend:8080
# PROXY_BYPASS_PREFIXES=api/jobs/
```

> **Security:** `KEK_BASE64` encrypts all product private keys at rest. Losing it means you cannot sign new licenses. Back it up securely.

### 3. Deploy with Docker Compose

```bash
docker compose up -d
```

Portal starts on port `3001`. The entrypoint runs `prisma db push` automatically on each start (schema-creates tables if missing, safe to re-run).

### 4. Put behind a reverse proxy

Example Caddy config:

```
license.yourcompany.com {
    reverse_proxy localhost:3001
}
```

### 5. First login

Navigate to `https://license.yourcompany.com/login`. Use the `ADMIN_EMAIL` and password you hashed in step 1.

### 6. Register your product

Go to **Products → New**. Copy the `publicKeyB64` from the response into your product binary (Handoff: `app.license.public-keys.v1` in `application.properties`).

### Updating

```bash
docker compose pull
docker compose up -d
```

The entrypoint re-runs `prisma db push` on startup, applying any schema changes automatically.

### Backups

Back up the PostgreSQL volume (`pgdata`). The only secrets that cannot be regenerated are `KEK_BASE64` (needed to decrypt private keys) and `ADMIN_PASSWORD_HASH`. Store both in a secrets manager.
