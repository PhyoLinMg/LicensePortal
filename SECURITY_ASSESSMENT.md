# Security Assessment — handoff-license-server

**Assessment date:** 2026-06-08  
**Last updated:** 2026-06-08 (F-02–F-12 remediated; container rebuilt and redeployed)  
**Assessed by:** Black-box + source verification (pass-2)  
**Scope:** `handoff-license-server` container and API only (`localhost:3001`). Handoff backend out of scope.  
**Container:** `handoff-license-server-portal-ui-1` — Node.js 20, Next.js 15, Prisma/PostgreSQL.  
**Methodology:** Black-box probe first, source verification for confirmation. All active tests authorized.

---

## 1. Executive Summary

### Deployment Status

**Container rebuilt and redeployed 2026-06-08.** All protections from commit `19c4c6c` and subsequent remediation work are now running. Migration `0002_add_session_table` applied on startup.

| Protection | Status |
|-----------|--------|
| Rate limiting on `/login` (10/15min) | ✅ Active |
| Rate limiting on `/validate` (30/min) | ✅ Active |
| Rate limiting on `/heartbeat` (5/min per licenseId+IP) | ✅ Active |
| Nonce replay protection on heartbeat | ✅ Active |
| Timing-safe email + bcrypt comparison on login | ✅ Active |
| Security headers (HSTS, X-Frame-Options, etc.) | ✅ Active |
| Nonce-based CSP (`script-src`, `style-src 'self'`) | ✅ Active |
| Bcrypt format/rounds validation | ✅ Active |
| Zod input validation on login + admin endpoints | ✅ Active |
| JTI session revocation (`Session` table) | ✅ Active |
| Proxy header allowlist | ✅ Active |
| Container health check (node -e) | ✅ Active |

### Post-Rebuild Residual Issues

After deploying the current HEAD, the following issues **remain**:

| Risk | Severity | Status |
|------|----------|--------|
| Rate limit bypassable via X-Forwarded-For spoofing | High | ✅ Fixed |
| Heartbeat DoS via license_id rate exhaustion | Medium | ✅ Fixed |
| No server-side session revocation (missing JTI) | High | ✅ Fixed |
| Product slug enumeration oracle | Medium | ✅ Fixed |
| Stored XSS in customer fields (API-level) | Medium | ✅ Fixed |
| Audit log destruction via prune endpoint | Medium | ✅ Fixed |
| CSP — nonce-based, no `unsafe-inline` | Low | ✅ Fixed |
| OpenAPI spec is public (intentional) | Low | ✅ Documented |
| Proxy forwards all client headers | Low | ✅ Fixed |
| Broken container health check | Low | ✅ Fixed |
| KEK architecture risk | Architectural | Open |

### Overall Posture

**Currently deployed: LOW-MODERATE RISK**  
All critical and high findings remediated and deployed. Remaining open items are operational (rotate password, move KEK to secrets manager) or architectural. Cryptographic core is sound.

Remaining open:
- 🔴 **MUST DO before any internet-facing deployment: rotate admin password.** Current hash in `.env` = plaintext `password`. An attacker who can reach port 3001 compromises the portal in under 1 second. See F-13.
- **F-14** (Architectural): `KEK_BASE64` should move to a secrets manager / HSM
- **TRUSTED_PROXY_HEADER** not set in current deployment — rate limits bucket all clients together (acceptable for internal/dev use; set before internet-facing deployment)

---

## 2. Attack Surface Inventory

### Endpoints

| Path | Methods | Auth | State | Notes |
|------|---------|------|-------|-------|
| `/api/auth/login` | POST | No | Rate-limited 10/15min per IP¹ | |
| `/api/auth/logout` | POST | No (cookie cleared) | OK | Deletes JTI from DB |
| `/api/v1/validate` | POST | No (license = credential) | Rate-limited 30/min per IP¹ | |
| `/api/v1/heartbeat` | POST | No (Ed25519 sig) | Rate-limited 5/min per licenseId+IP¹ | Nonce replay protected |
| `/api/admin/licenses` | GET, POST | Yes — JTI session² | OK | |
| `/api/admin/licenses/[id]` | GET | Yes | OK | Returns full licenseText |
| `/api/admin/licenses/[id]/revoke` | POST | Yes | OK | |
| `/api/admin/licenses/[id]/rebind` | POST | Yes | OK | |
| `/api/admin/customers` | GET, POST | Yes | OK | Input validated (Zod) |
| `/api/admin/products` | GET, POST | Yes | OK | Input validated (Zod) |
| `/api/admin/audit/prune` | POST | Yes | OK | 90-day floor; prune events logged |
| `/api/proxy/[...path]` | ALL | **No (PUBLIC_PATH)** | No upstream configured | Header allowlist: content-type, accept, accept-encoding, accept-language, user-agent |
| `/api/openapi.json` | GET | **No (PUBLIC_PATH)** | Public (intentional) | Documents public enforcement API for product integrators |

¹ IP isolation active only when `TRUSTED_PROXY_HEADER` is set. Without it, all clients share one bucket.  
² Middleware checks JWT signature only (for UI redirects). Route handlers call `requireAdminAuth()` which performs the full JTI + DB lookup. A revoked token passes the middleware but is rejected 401 by the route handler.

### Trust Boundary Diagram

```
                    Internet
                       │
              ┌────────▼────────────────────────────┐
              │  localhost:3001 (Next.js 15)         │
              │  middleware: JWT sig check (redirect) │
              └────────┬────────────────────────────┘
                       │
       ┌───────────────┼──────────────────┐
       │               │                  │
 ┌─────▼──────┐  ┌─────▼──────────┐  ┌───▼────────────┐
 │ /api/v1/   │  │ /api/admin/    │  │ /api/proxy/    │
 │ (public)   │  │ requireAdmin() │  │ (PUBLIC, no    │
 │ rate-ltd   │  │ JTI+DB check   │  │  auth gate)    │
 │ per IP¹    │  └─────┬──────────┘  └───────┬────────┘
 └────────────┘        │                   PROXY_UPSTREAM_URL
                  ┌────▼────┐              (not configured)
                  │Postgres │
                  │internal │
                  └─────────┘
```
¹ IP isolation requires `TRUSTED_PROXY_HEADER` set. See F-02.

---

## 3. Findings

Findings marked **[DEPLOYED]** are exploitable right now in the running container. Findings marked **[PERSISTS]** are exploitable now AND survive a rebuild. Findings marked **[POST-REBUILD ONLY]** are not currently exploitable — they emerge after deploying pending code.

---

### F-01 — No Rate Limiting on Admin Login [DEPLOYED — CRITICAL]

**Severity:** Critical  
**Confidence:** Confirmed  
**CWE:** CWE-307 Improper Restriction of Excessive Authentication Attempts  
**OWASP API:** API4:2023 Unrestricted Resource Consumption

**Evidence — container behavior:**

```bash
# 15 sequential POST requests, no throttling, all return 401 (never 429):
for i in $(seq 1 15); do
  curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@handoff.local","password":"wrongpassword"}'
done
# Output: {"error":"Invalid credentials"} x15 — no 429

# Verify: compiled route bundle has no rate limit import:
docker exec handoff-license-server-portal-ui-1 \
  grep -c "allow\|rate_limit\|429" /app/.next/server/app/api/auth/login/route.js
# Output: 0
```

**Root cause:**

The running container was built **before** commit `19c4c6c` which added the rate limiter. The deployed `POST /api/auth/login` handler in the compiled bundle:

```javascript
async function handler(req) {
  // No rate limit check
  const { email, password } = await req.json()
  const adminEmail = process.env.ADMIN_EMAIL
  const adminHash = process.env.ADMIN_PASSWORD_HASH
  // ... bcrypt.compare directly ...
}
```

An attacker can attempt unlimited passwords against the admin account with no throttling, lockout, or alerting.

**Exploitation path:**

```
Attacker knows ADMIN_EMAIL (admin@handoff.local — leaked in .env/.claude docs).
Script common wordlist (rockyou.txt, etc.) against /api/auth/login.
Time to compromise with default password "password": < 1 second.
Admin session → fraudulent license issuance, customer data access, audit log destruction.
```

**Remediation:**

1. **Immediate: Rebuild and redeploy the container from HEAD.** Commit `19c4c6c` adds 10 attempts/15min rate limiting.
2. After rebuild, see F-02 for remaining rate limit bypass risk.
3. Change the admin password from `password` to a strong random value before production.

---

### F-02 — Rate Limit Bypassable via X-Forwarded-For Spoofing [FIXED — High]

> **Status: Fixed 2026-06-08.** `src/lib/request.ts` now reads exclusively the header named by `TRUSTED_PROXY_HEADER` env var. `X-Forwarded-For` removed from the fallback chain. Startup warning fires in production when `TRUSTED_PROXY_HEADER` is unset. IP isolation is inactive until the env var is configured — acceptable for deployments without a reverse proxy that should not be internet-facing.

**Severity:** High  
**Confidence:** Confirmed  
**CWE:** CWE-307 Improper Restriction of Excessive Authentication Attempts  
**OWASP API:** API4:2023 Unrestricted Resource Consumption

**Evidence:**

```bash
# 30 requests with unique spoofed IPs — each creates a fresh rate-limit bucket:
for i in $(seq 1 30); do
  curl -s -X POST http://localhost:3001/api/auth/login \
    -H "X-Forwarded-For: 10.0.0.$i" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@handoff.local","password":"wrongpassword"}'
done
# All return HTTP 401. No 429 triggered.
```

**Root cause (pending code in `src/lib/request.ts:22`):**

```typescript
req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ?? null
```

The function trusts `X-Forwarded-For` without verifying it comes from a trusted proxy. When deployed after commit `19c4c6c`, the login rate limiter keys on `login:<ip>`. An attacker sends a unique IP header per request, creating a fresh 10-attempt window each time.

**Secondary DoS vector:** Without any proxy headers, `getClientIp()` returns `null` and the key becomes `login:unknown`. All direct connections share this bucket. An attacker exhausts it in 10 requests, blocking the legitimate admin for 15 minutes.

**Remediation:**

1. Only trust `CF-Connecting-IP` or `X-Real-IP` when the service sits behind a known trusted proxy; **do not trust `X-Forwarded-For` from untrusted clients.**
2. Deploy behind a TLS proxy (nginx, Caddy, Cloudflare) that sets `X-Real-IP` from the authenticated socket address.
3. Add CAPTCHA or account lockout after N consecutive failures as defense-in-depth.
4. Consider Redis-backed rate limiting to handle proxy deployments correctly.

---

### F-03 — No Rate Limiting or Nonce Replay Protection on Heartbeat [DEPLOYED — High]

**Severity:** High  
**Confidence:** Confirmed (from compiled bundle inspection)  
**CWE:** CWE-400 Uncontrolled Resource Consumption / CWE-294 Authentication Bypass by Capture-Replay  
**OWASP API:** API4:2023 Unrestricted Resource Consumption

**Evidence:**

```bash
# Compiled heartbeat route has no rate limit:
docker exec handoff-license-server-portal-ui-1 \
  grep -c "allow\|429\|nonce\|replay" /app/.next/server/app/api/v1/heartbeat/route.js
# Output: 1  (only appearance is in error message strings, not logic)
```

In the current deployed container:

1. **No rate limit:** An attacker can send unlimited heartbeat requests. The HMAC signature check requires the instance private key, but the DB lookup and signature verification happen for every request regardless.

2. **No nonce replay:** A captured valid heartbeat packet (with valid signature) can be replayed indefinitely to keep a license appearing as "active" from an already-revoked or expired instance.

**Post-rebuild state:** Commit `19c4c6c` adds a 5 req/min rate limit keyed per `license_id`. This introduces a new issue — see F-04b below.

**Remediation:**

1. **Immediate: Rebuild and redeploy.** This adds rate limiting and nonce replay protection.
2. Post-rebuild: See F-04b for remaining heartbeat DoS risk.

---

### F-04 — Heartbeat DoS via License-ID Rate Key [FIXED — Medium]

> **Status: Fixed 2026-06-08.** Rate key changed to `heartbeat:${licenseId}:${ip}` in `src/app/api/v1/heartbeat/route.ts`. An attacker holding the victim's license file gets their own IP bucket and cannot exhaust the legitimate instance's quota. Effective IP isolation depends on `TRUSTED_PROXY_HEADER` — see F-02.

**Severity:** Medium  
**Confidence:** Confirmed (by design)  
**CWE:** CWE-400 Uncontrolled Resource Consumption  
**OWASP API:** API6:2023 Unrestricted Access to Sensitive Business Flows

After rebuilding with `19c4c6c`, the heartbeat rate limit will be:

```typescript
// src/app/api/v1/heartbeat/route.ts:69
const rl = allow(`heartbeat:${licenseId}`, 5, 60_000)
```

Keyed on `license_id`, **not IP**. The `license_id` is a UUID embedded in the customer's public license token (every customer possesses it). Any party with the license file can:

1. Send 5 fabricated heartbeat requests per minute using the victim's `license_id`
2. Consume the 5-request window before the legitimate Handoff instance can poll
3. Cause the license state to stagnate → DEGRADED after 24h → EXPIRED after grace period

Rate limit applies after UUID validation but before signature verification. Invalid signatures still consume slots.

**Remediation:**


Key the rate limit on both `license_id` AND IP: `heartbeat:${licenseId}:${ip}`. Apply `getClientIp()` with the same trusted-proxy caveats as F-02.

---

### F-05 — No Server-Side Session Revocation (Missing JTI) [FIXED — High]

> **Status: Fixed 2026-06-08.** `createSession()` now generates a `jti` UUID, stores it in the new `Session` table (migration `0002_add_session_table`), and embeds it in the JWT claim. `verifySession()` performs a DB lookup — fail-closed (DB down = session rejected). Logout deletes the JTI row. Session TTL reduced 8h → 2h. Expired rows swept at module load. **Breaking change:** existing sessions (no `jti` claim) invalidate on deploy — one forced re-login.

**Severity:** High  
**Confidence:** Confirmed  
**CWE:** CWE-613 Insufficient Session Expiration  
**OWASP API:** API2:2023 Broken Authenticationf

**Evidence:**

Observed session JWT payload (decoded):
```json
{"alg":"HS256"}.{"role":"admin","iat":1780912992,"exp":1780941792}
```

No `jti` (JWT ID) claim. `verifySession()` in `src/lib/auth.ts` only checks signature and expiry:

```typescript
export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}
```

Consequences:
- Logout only clears the cookie client-side. The token itself remains valid for 8 hours.
- If a session token is leaked (logs, XSS, shoulder-surfing), it cannot be revoked.
- No concurrent session detection — admin and attacker can hold valid sessions simultaneously.
- Admin cannot force-expire all sessions after a suspected compromise.

**Remediation:**

1. Add a `jti` UUID claim on session creation.
2. Store active JTIs in a Redis set or a `active_sessions` Postgres table with TTL matching JWT expiry.
3. Check JTI in `verifySession()` against the active set.
4. On logout, remove the JTI.
5. Add an "invalidate all sessions" admin function for incident response.
6. Reduce session lifetime from 8h to 2h for an admin portal.

---

### F-06 — Product Slug Enumeration Oracle via `/api/v1/validate` [FIXED — Medium]

> **Status: Fixed 2026-06-08.** `unknown_product` and `invalid_signature` collapsed into `invalid_license` in `src/app/api/v1/validate/route.ts`. Attacker can no longer distinguish a missing slug from a bad signature. `malformed_license`, `missing_fields`, and `license_not_found` (post-signature) remain distinct — they carry no product-existence information.

**Severity:** Medium  
**Confidence:** Confirmed  
**CWE:** CWE-203 Observable Discrepancy  
**OWASP API:** API3:2023 Broken Object Property Level Authorization

**Evidence:**

```bash
# "Handoff" exists — returns invalid_signature:
curl -s -X POST http://localhost:3001/api/v1/validate \
  -d '{"license_text":"eyJwcm9kdWN0X2lkIjoiSGFuZG9mZiIsImxpY2Vuc2VfaWQiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAifQ.AAAA"}'
# → {"state":"INVALID","error":"invalid_signature"}  ← product EXISTS

# "handoff" (wrong case) does not exist:
# → {"state":"INVALID","error":"unknown_product"}    ← product ABSENT
```

The validate endpoint distinguishes between missing and present product slugs:
- `unknown_product` → slug not in `Product.slug` column
- `invalid_signature` → slug matched, signature wrong

Combined with the rate limit bypass (F-02, post-rebuild), an attacker can enumerate all registered product names using a wordlist. This leaks the entire product registry and confirms attacker hypotheses.

**Remediation:**

Return a single undifferentiated error for all pre-signature-verification failures:
```json
{"state":"INVALID","error":"invalid_license"}
```
Reserve detail (expired, revoked) for post-signature verification only.

---

### F-07 — Stored Unsanitized HTML in Customer Fields [FIXED — Medium]

> **Status: Fixed 2026-06-08.** Zod schemas added to all three admin create endpoints. Customer: `name` max 255, `email` validated as RFC email + max 254, `notes` max 4000. Product: `slug` validated against `/^[A-Za-z0-9-]+$/` (mixed-case, compatible with existing slugs), `name` max 255. License: `productId`/`customerId` validated as UUIDs, `tier` max 64, `features` array bounded, `limits` keys bounded, dates validated as ISO datetime, `heartbeatUrl` validated as URL. All endpoints return `validation_error` with field-level details on failure.

**Severity:** Medium  
**Confidence:** Confirmed (API behavior); Probable (UI impact)  
**CWE:** CWE-79 Cross-Site Scripting  
**OWASP API:** API8:2023 Security Misconfiguration

**Evidence:**

```bash
curl -s -X POST http://localhost:3001/api/admin/customers \
  -H "Cookie: lsrv_session=<valid>" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"t@t.com<script>alert(1)</script>","notes":"<img src=x onerror=alert(1)>"}'
# HTTP 201 — HTML stored as-is
```

The admin customer creation endpoint accepts raw HTML/JavaScript in text fields. React's JSX `{value}` escaping likely prevents execution in the current frontend. However:
- If any template uses `dangerouslySetInnerHTML` on customer fields, XSS executes in the admin panel.
- The API contract itself stores unvalidated data.
- An attacker with admin access can plant payloads for a secondary admin user (hypothetical multi-user scenario).

**Note:** Test records created during assessment were deleted (`DELETE FROM "Customer" WHERE id IN (...)` — confirmed 2 rows removed).

**Remediation:**

1. Add server-side validation: validate email format with regex, enforce max length on all string fields.
2. Audit all frontend templates for `dangerouslySetInnerHTML` usage on customer data.
3. Consider stripping HTML from text-only fields with a library like `he` or `DOMPurify`.

---

### F-08 — Audit Log Destruction via Unconstrained Prune [FIXED — Medium]

> **Status: Fixed 2026-06-08.** `src/app/api/admin/audit/prune/route.ts` now enforces `MIN_RETENTION_DAYS = 90`. Requests below the floor return 400 `minimum_retention_days` and write an `AUDIT_PRUNE_REJECTED` event before returning. Successful prunes write an `AUDIT_PRUNE` event before executing the delete, ensuring the prune itself is traceable. External SIEM integration (the deeper fix) remains out-of-band.

**Severity:** Medium  
**Confidence:** Confirmed  
**CWE:** CWE-778 Insufficient Logging  
**OWASP API:** API5:2023 Broken Function Level Authorization

```typescript
// src/app/api/admin/audit/prune/route.ts
if (typeof body.days === 'number' && body.days > 0) days = Math.floor(body.days)
// No minimum floor. {"days":1} deletes everything except the last 24h.
const result = await db.auditEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
```

A `POST /api/admin/audit/prune` with `{"days":1}` deletes essentially the entire audit log. No minimum retention, no confirmation, no soft-delete.

**Attack chain:** Admin compromised via F-01 → fraudulent licenses issued → prune called with `days=1` → ISSUE and ADMIN_LOGIN events gone → forensic investigation has no trail.

**Remediation:**

1. Enforce a minimum of 90 days — reject requests below this floor.
2. Ship audit events to an external SIEM or append-only store in real-time.
3. Log prune operations to an out-of-band destination before executing the delete.
4. Require re-authentication for destructive admin actions.

---

### F-09 — CSP `unsafe-inline` [FIXED — Low]

> **Status: Fixed 2026-06-08.** All 28 UI files migrated from React `style={{}}` props to Tailwind utility classes and `globals.css` custom classes. `<style>` tag blocks removed from all components. `middleware.ts` generates a UUID nonce per request, sets `Content-Security-Policy: script-src 'self' 'nonce-{nonce}'; style-src 'self'` and forwards the nonce via `x-nonce` header. Root `layout.tsx` reads the nonce and passes it to `<html nonce>` so Next.js threads it to its bootstrap inline scripts. `Permissions-Policy: camera=(), microphone=(), geolocation=()` added. Deployed and browser-verified: no CSP violations, UI renders correctly with no `unsafe-inline` in either directive.

**Severity:** Medium (currently deployed), Low (post-rebuild)  
**Confidence:** Confirmed  
**CWE:** CWE-1021 / CWE-16  
**OWASP API:** API8:2023 Security Misconfiguration

```bash
curl -sI -X POST http://localhost:3001/api/v1/validate
# No X-Content-Type-Options, X-Frame-Options, CSP, HSTS, Referrer-Policy
```

All security headers are absent from the deployed container. Commit `19c4c6c` adds them via `next.config.ts`:

```typescript
{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
{ key: 'X-Frame-Options', value: 'DENY' },
{ key: 'X-Content-Type-Options', value: 'nosniff' },
{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
{ key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'..." },
```

**Post-rebuild residual:** The CSP uses `script-src 'self' 'unsafe-inline'`. The `unsafe-inline` directive neutralizes most XSS protection from CSP. Replace with nonce-based CSP.

**Remediation:**

1. **Immediate: Rebuild to deploy the security headers.**
2. Post-rebuild: Replace `'unsafe-inline'` in `script-src` with `'nonce-{nonce}'` using Next.js nonce support.
3. Add `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

---

### F-10 — Broken Container Health Check (`curl` Not Found) [FIXED — Low]

> **Status: Fixed 2026-06-08.** `Dockerfile` now includes a `HEALTHCHECK` using `node -e` (no `curl` dependency). Checks `http://localhost:3001/login` — exits 0 for HTTP < 500, exits 1 on error or 5xx. Takes effect on next container rebuild.

**Severity:** Low  
**Confidence:** Confirmed

```bash
docker inspect handoff-license-server-portal-ui-1 --format \
  '{{range .State.Health.Log}}{{.End}} {{.ExitCode}} {{.Output}}{{end}}'
# 2026-06-08 10:14:21 1 /bin/sh: curl: not found
# (repeated every 10s for 24+ hours)
```

Health check `CMD-SHELL: curl -f http://localhost:3001/login` fails because `curl` is not in the Node.js Alpine image. Container reports `unhealthy` despite functioning. Orchestrators using health status may kill healthy containers.

**Remediation:**

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/login', r => \
    process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"
```

---

### F-11 — OpenAPI Specification Is Public [DOCUMENTED — Low]

> **Status: Intentional, documented 2026-06-08.** Confirmed intentional — the spec documents the public enforcement API (`/api/v1/validate`, `/api/v1/heartbeat`) for product integrators. Comment added to `PUBLIC_PATHS` in `src/middleware.ts` explaining the decision. Admin endpoint details are present in the spec; if that becomes a concern, restrict by removing `/api/openapi.json` from `PUBLIC_PATHS` or serve a filtered spec.

**Severity:** Low  
**Confidence:** Confirmed  
**CWE:** CWE-200 Information Exposure

`/api/openapi.json` is in `PUBLIC_PATHS` in `src/middleware.ts` — accessible without authentication. Exposes full API schema including admin endpoint paths to unauthenticated clients. Accepted as intentional developer documentation.

**Residual:** Admin endpoint schemas are visible. If the product integrator audience does not need admin API docs, filter `buildOpenApiDocument()` to exclude admin paths.

---

### F-12 — Proxy Forwards All Client Headers to Upstream [FIXED — Low]

> **Status: Fixed 2026-06-08.** `src/lib/proxy.ts` now uses a deny-by-default allowlist for outbound request headers. Only `content-type`, `accept`, `accept-encoding`, `accept-language`, `user-agent` are forwarded. `cookie`, `authorization`, and all `x-*` headers are dropped. Operators who need upstream session auth must explicitly extend the allowlist for their deployment. Response headers still strip hop-by-hop only (responses do not carry privilege-escalation risk in the same way).

**Severity:** Low (currently: proxy not configured)  
**Confidence:** Confirmed from source

The `/api/proxy/` endpoint is in `PUBLIC_PATHS` — no authentication required. When `PROXY_UPSTREAM_URL` is configured, unauthenticated clients can route requests to the upstream and inject arbitrary HTTP headers. Old behavior: `stripHopByHop` passed everything except 6 connection headers. New behavior: only the 5-header allowlist passes.

---

### F-13 — Default Development Password in `.env` [DEFERRED — ⚠️ CRITICAL BEFORE PRODUCTION]

> **Status: Deferred — local deployment only.** Acceptable now because the container is not reachable from the internet. The moment port 3001 is exposed publicly, this is a sub-second full compromise. **Do not skip this step.**

**Severity:** Informational locally / **Critical** if internet-facing  
**Confidence:** Confirmed

`ADMIN_PASSWORD_HASH` in `.env` corresponds to plaintext `password`. The hash is trivially cracked (or the default credential simply tried directly). An attacker with network access to port 3001 gains full admin in < 1 second: issue fraudulent licenses, exfiltrate customer PII, destroy audit log.

**Remediation — before any internet-facing deployment:**

```bash
# 1. Generate a strong password (example: random 32-char)
openssl rand -base64 24

# 2. Hash it
node -e "require('bcryptjs').hash('YOUR_GENERATED_PASSWORD', 12).then(console.log)"

# 3. Replace ADMIN_PASSWORD_HASH in .env with the output
# 4. Rebuild and redeploy
```

---

### F-14 — KEK Compromise Enables Full License Forgery [Architectural]

**Severity:** Architectural Risk  
**Confidence:** Confirmed from source

All Ed25519 product private keys are stored encrypted with a single AES-256-GCM key (`KEK_BASE64`). KEK compromise decrypts all private keys → forged valid license tokens for any product without server interaction.

**Remediation:** Store `KEK_BASE64` in a dedicated secrets manager. Consider HSM for KEK. Implement key rotation with re-encryption procedure.

---

## 4. Chained Exploitation Scenarios

### Chain A: Admin Takeover → License Fraud → Evidence Destruction (Currently Deployed)

**Precondition:** Attacker knows admin email (`admin@handoff.local` — leaked in docs)  
**Skill level:** Script kiddie  
**Probability:** HIGH (deployed container has no rate limit)

```
1. F-01: POST /api/auth/login with password "password" → immediate success (no rate limit,
         default password confirmed).
2. Issue unlimited fraudulent licenses via POST /api/admin/licenses.
3. Exfiltrate all customer PII (name, email) from GET /api/admin/customers.
4. F-08: POST /api/admin/audit/prune {"days":1} → destroy ISSUE + ADMIN_LOGIN evidence.
5. Session expires naturally (8h). No forensic trace.
```

**Business impact:** Complete licensing system compromise, revenue loss, customer data exposure.

---

### Chain B: Brute-Force Admin (Post-Rebuild) → Same Outcome

**Precondition:** Admin email known; no MFA; non-Cloudflare deployment  
**Skill level:** Script kiddie with XFF knowledge  
**Probability:** ~~MEDIUM~~ **LOW** (F-02 fixed — XFF spoofing no longer creates fresh buckets)

> **F-02 fixed.** `X-Forwarded-For` is no longer trusted. Rate limit now keys on `TRUSTED_PROXY_HEADER` value exclusively. Without a reverse proxy, all direct connections share one bucket (shared lockout risk, not bypass risk). With a proxy, the proxy IP is authoritative — clients cannot spoof it.

```
Previously:
1. F-02: Script 10k requests with unique X-Forwarded-For per request → bypassed.
Now:
1. XFF ignored. All requests consume the same IP bucket → locked out after 10 attempts.
   Remaining attack vector: IP rotation at the network level (requires real infra, not header spoofing).
```

---

### Chain C: Heartbeat Rate Exhaustion → License Degradation (Post-Rebuild)

**Precondition:** Attacker has access to victim's license file  
**Skill level:** Intermediate  
**Probability:** ~~MEDIUM~~ **LOW** (F-04 fixed — rate key now on licenseId+IP)

> **F-04 fixed.** Heartbeat rate limit now keyed on `heartbeat:${licenseId}:${ip}`. An attacker from a different IP gets their own bucket and cannot exhaust the legitimate instance's 5-req/min quota. Effective only when `TRUSTED_PROXY_HEADER` is set — without it, both attacker and victim share `heartbeat:${licenseId}:unknown`.

```
Previously:
2. F-04: Send 5 fake heartbeats/min → same bucket as victim → exhausted.
Now:
2. Attacker IP bucket is separate → legitimate instance unaffected.
   Remaining vector: attacker co-located on same IP as victim (NAT, same proxy) — unlikely.
```

---

### Chain D: Product Enumeration → Targeted Reconnaissance (Post-Rebuild)

**Precondition:** None  
**Skill level:** Beginner  
**Probability:** ~~HIGH~~ **LOW** (F-06 fixed — oracle collapsed; F-02 fixed — rate limit not bypassable via XFF)

> **F-06 fixed.** Both `unknown_product` and `invalid_signature` now return `invalid_license`. An attacker cannot distinguish a missing slug from a present one with a bad signature — the enumeration oracle is closed. Combined with F-02 fix (XFF bypass removed), wordlist enumeration is rate-limited and yields no signal.

```
Previously:
1. F-06: "invalid_signature" = product exists → enumerate slug wordlist.
2. F-02: XFF bypass → unlimited guesses.
Now:
1. All pre-sig failures return "invalid_license" → no slug oracle.
2. Rate limit 30/min enforced on real IP → enumeration bounded.
```

---

## 5. Hardening Recommendations

### Immediate (Before Any Production Traffic)

- [x] **Rebuild and redeploy container from HEAD** — done 2026-06-08; migration `0002_add_session_table` applied
- [ ] **⚠️ MUST DO before internet-facing: change admin password** from `password` to a 32+ char random secret — current hash is public knowledge, portal falls in < 1 second (F-13)
- [x] **Fix health check** — Dockerfile now uses `node -e` (F-10)

### Authentication (Post-Rebuild)

- [x] Fix rate limit key to only trust IP from controlled proxy, not `X-Forwarded-For` (F-02) — `TRUSTED_PROXY_HEADER` env var
- [x] Add JTI-based session revocation (F-05) — `Session` table, fail-closed, 2h TTL
- [ ] Add TOTP/FIDO2 as second factor
- [ ] Alert admin via email on every successful login

### Authorization

- [x] Key heartbeat rate limit on IP + license_id pair (F-04)
- [x] Enforce minimum 90-day retention floor in `/api/admin/audit/prune` (F-08) — floor + pre-delete audit event
- [x] Create header allowlist on proxy (F-12) — deny-by-default: content-type, accept, accept-encoding, accept-language, user-agent

### API Design

- [x] Unify validate error codes to prevent product slug oracle (F-06) — `invalid_license` for unknown slug + bad sig
- [x] Add input validation + max-length on all customer/product string fields (F-07) — Zod schemas on all three create endpoints
- [ ] Decide and document OpenAPI spec visibility (F-11)

### CSP (Post-Rebuild)

- [x] Add `Permissions-Policy: camera=(), microphone=(), geolocation=()` header
- [x] Replace `'unsafe-inline'` with nonce-based CSP (F-09) — 28-file Tailwind migration + per-request nonce in middleware + `<html nonce>` in layout

### Secrets Management

- [ ] Move `KEK_BASE64` to secrets manager (F-14)
- [ ] Add startup rejection of known-weak admin password hashes (F-13)
- [ ] Rotate `JWT_SECRET` after any suspected session leak

### Logging and Monitoring

- [ ] Stream AuditEvent rows to external SIEM in real-time
- [ ] Alert on bulk license issuance, prune operations, admin logins from new IPs
- [ ] Log failed login attempts (currently not persisted)
- [x] Add `jti` to session tokens to correlate audit events to specific sessions (done as part of F-05)

---

## 6. Out of Scope / Not Tested

- Handoff backend (port 8080) — out of scope per assessment decision
- Postgres direct access — no credentials available
- Host OS / container escape
- Prisma SQL injection — confirmed not vulnerable (parameterized queries throughout)
- Ed25519 / AES-GCM implementation correctness — uses Node.js `crypto` module (sound)

---

## 7. Assessment Artifacts

**Test data:** Two customers created during assessment were deleted before delivery:

```sql
-- Already executed, confirmed 2 rows deleted:
DELETE FROM "Customer"
WHERE id IN (
  '40a054f6-9c8c-478a-a994-926a674266eb',
  '67cd410a-0fb8-4d75-b85d-c4cf7aba6574'
);
```

**Confirmed product slug:** `Handoff` (case-sensitive) — registered in the running instance.

**Confirmed admin credentials:** `admin@handoff.local` / `password` (from `.env` — rotate immediately).
