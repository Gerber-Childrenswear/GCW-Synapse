#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

echo "==> Installing dependencies"
npm ci
npm --prefix apps/admin ci

echo "==> Building admin UI"
npm run cf:build

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "Missing CLOUDFLARE_API_TOKEN. Create one at:" >&2
  echo "  https://developers.cloudflare.com/fundamentals/api/get-started/create-token/" >&2
  echo "Permissions: Account / Workers Scripts / Edit, Account / Workers KV Storage / Edit" >&2
  exit 1
fi

if [[ -n "${SYNAPSE_INGRESS_TOKEN:-}" ]]; then
  echo "==> Setting Worker secret SYNAPSE_INGRESS_TOKEN"
  printf '%s' "$SYNAPSE_INGRESS_TOKEN" | npx wrangler secret put SYNAPSE_INGRESS_TOKEN
fi

echo "==> Deploying gcw-synapse-super"
npx wrangler deploy

WORKER_URL="https://gcw-synapse-super.${CLOUDFLARE_ACCOUNT_SUBDOMAIN:-$(npx wrangler whoami 2>/dev/null | awk '/Account/{getline; print tolower($0)}' | tr -d ' ')}.workers.dev"

echo ""
echo "Deploy complete."
echo "Health:  ${WORKER_URL}/health"
echo "Admin:   ${WORKER_URL}/"
echo "Event:   ${WORKER_URL}/event"
echo ""
echo "Next manual steps (require Shopify / GTM admin):"
echo "  1. Theme app embed -> Synapse endpoint: ${WORKER_URL}/event"
echo "  2. Customer-events pixel endpoint -> ${WORKER_URL}/event"
echo "  3. Shopify webhooks -> ${WORKER_URL}/webhooks/shopify/..."
echo "  4. GitHub secrets: SYNAPSE_BASE_URL=${WORKER_URL}, SYNAPSE_INGRESS_TOKEN=<token>"
echo "  5. Import docs/gtm/GTM-TKW58K8_synapse_runtime_companion_import.json to GTM-TKW58K8"
echo ""
echo "Full lean checklist: docs/LEAN_GO_LIVE.md"
echo "Verify deployment:     npm run lean:verify"
