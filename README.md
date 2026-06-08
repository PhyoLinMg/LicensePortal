# Keyforge — License Server

Vendor-operated license portal for issuing, revoking, and tracking Ed25519-signed license tokens for self-hosted products. Customers never access this directly.

## Stack

- Next.js 15 (App Router) + TypeScript
- Prisma + PostgreSQL
- Vault OSS (secrets management for `KEK_BASE64`)

## Quick Start

```bash
cp .env.example .env
# Fill in JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, NEXT_PUBLIC_BASE_URL

# Bootstrap Vault and generate KEK (first deploy only — see docs)
docker compose up -d vault
docker compose exec vault vault operator init -key-shares=1 -key-threshold=1
# → save unseal key + root token offline
docker compose exec vault vault operator unseal <unseal_key>
docker compose exec vault vault login <root_token>
docker compose exec vault vault secrets enable -path=secret kv-v2
docker compose exec vault vault auth enable approle
docker compose exec vault vault policy write keyforge - <<'EOF'
path "secret/data/keyforge/kek" { capabilities = ["read"] }
EOF
docker compose exec vault vault write auth/approle/role/keyforge \
  token_policies="keyforge" token_ttl=5m token_max_ttl=10m
KEK=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
docker compose exec vault vault kv put secret/keyforge/kek kek_base64="$KEK"
docker compose exec vault vault read auth/approle/role/keyforge/role-id
docker compose exec vault vault write -f auth/approle/role/keyforge/secret-id
# → add VAULT_ROLE_ID and VAULT_SECRET_ID to .env

docker compose up -d
```

Portal runs on `http://localhost:3001`.

> **After every server reboot:** Vault starts sealed. Unseal before starting other services:
> ```bash
> docker compose exec vault vault operator unseal <unseal_key>
> docker compose up -d
> ```

## Docs

See [DOCS.md](DOCS.md) for the full self-hosting guide, API reference, and product integration guide.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability disclosure policy and [SECURITY_ASSESSMENT.md](SECURITY_ASSESSMENT.md) for the full security audit (all findings remediated).

## Development

```bash
npm install
cp .env.example .env   # set KEK_BASE64 directly for local dev (no Vault needed)
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Tests:

```bash
npm test
```
