# Security Policy

## Reporting a Vulnerability

Email **phyolinmg.dev@gmail.com** with subject line `[SECURITY] keyforge`.

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected version / commit
- Your assessment of impact

You will receive an acknowledgement within **48 hours** and a status update within **7 days**.

Please do not open a public GitHub issue for security vulnerabilities.

## Scope

In scope:
- `POST /api/v1/validate` and `POST /api/v1/heartbeat` — public endpoints, no auth
- `POST /api/auth/login` — credential handling
- License token forgery or bypass
- Privilege escalation via admin routes
- Cryptographic weaknesses in Ed25519 signing or AES-GCM key encryption

Out of scope:
- Denial-of-service attacks requiring physical access or sustained traffic
- Vulnerabilities in third-party dependencies (report upstream)
- Social engineering

## High-Impact Scenarios

These are the most critical classes of vulnerability for this project:

**`KEK_BASE64` compromise** — This key encrypts all product Ed25519 private keys at rest. If compromised, an attacker can decrypt stored private keys and forge license tokens for any product. Recovery requires rotating `KEK_BASE64`, re-encrypting all product keys, and re-issuing all licenses.

**Product Ed25519 private key compromise** — Each product has its own keypair. Compromise of a single product's key allows forging licenses for that product only. Recovery requires generating a new keypair via the admin UI, embedding the new `publicKeyB64` in a re-deployed product binary, and re-issuing affected licenses.

**Admin session bypass** — All `/api/admin/**` routes are gated by an HS256 JWT cookie (`lsrv_session`) derived from `JWT_SECRET`. A bypass here gives full control: issue, revoke, or read all licenses.

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main`  | Yes       |

Fixes are applied to `main` only. Pin to a specific commit for production deployments.
