#!/usr/bin/env bash
set -euo pipefail
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
domain=fincamamasgarden.com
"$root/scripts/install-tls.sh" "$domain" "${RENEWED_LINEAGE:-/etc/letsencrypt/live/$domain}"
cd -- "$root"
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T proxy nginx -c /tmp/default.conf -t
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T proxy nginx -c /tmp/default.conf -s reload
