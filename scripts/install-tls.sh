#!/usr/bin/env bash
set -euo pipefail
# Linux host, root only. No secret file is sourced and no key is printed.
test "$(id -u)" = 0 || { echo 'Ejecutar como root en el servidor TLS.' >&2; exit 1; }
domain="${1:?Indicar dominio}"
lineage="${2:?Indicar directorio de certificado de Certbot}"
[[ "$domain" =~ ^[a-z0-9]+([.-][a-z0-9]+)*\.[a-z]{2,}$ ]] || exit 1
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
openssl x509 -in "$lineage/fullchain.pem" -noout -checkhost "$domain" >/dev/null
openssl x509 -in "$lineage/fullchain.pem" -noout -checkend 604800 >/dev/null
certificate_public="$(openssl x509 -in "$lineage/fullchain.pem" -pubkey -noout | openssl sha256)"
private_public="$(openssl pkey -in "$lineage/privkey.pem" -passin pass: -pubout | openssl sha256)"
test "$certificate_public" = "$private_public" || { echo 'Par TLS inválido.' >&2; exit 1; }
install -d -m 0755 "$root/deploy/tls"
install -o 101 -g 101 -m 0400 "$lineage/privkey.pem" "$root/deploy/tls/privkey.pem.new"
install -o 101 -g 101 -m 0444 "$lineage/fullchain.pem" "$root/deploy/tls/fullchain.pem.new"
mv -- "$root/deploy/tls/fullchain.pem.new" "$root/deploy/tls/fullchain.pem"
mv -- "$root/deploy/tls/privkey.pem.new" "$root/deploy/tls/privkey.pem"
echo 'Certificado instalado para el proxy no root; valores ocultos.'
