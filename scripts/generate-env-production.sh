#!/bin/bash
# Gera .env.production a partir de .env.production.example, substituindo
# <VM_IP> pelo IP fixo da VM e gerando secrets aleatorios para senha do
# banco, JWT e senha do admin inicial.
#
# Uso: ./scripts/generate-env-production.sh <IP_DA_VM>
# Ex.: ./scripts/generate-env-production.sh 10.90.10.50
set -euo pipefail

cd "$(dirname "$0")/.."

VM_IP="${1:?Uso: $0 <IP_DA_VM>}"
TEMPLATE=".env.production.example"
OUT_FILE=".env.production"

if [ -f "$OUT_FILE" ]; then
  echo "Erro: $OUT_FILE ja existe. Remova-o ou edite manualmente se quiser regenerar." >&2
  exit 1
fi

DB_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 48)
JWT_REFRESH_SECRET=$(openssl rand -hex 48)
SEED_ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=')

sed \
  -e "s|<VM_IP>|${VM_IP}|g" \
  -e "s|change_me_to_a_strong_db_password|${DB_PASSWORD}|g" \
  -e "s|change_me_to_a_strong_secret|${JWT_SECRET}|g" \
  -e "s|change_me_to_a_strong_refresh_secret|${JWT_REFRESH_SECRET}|g" \
  -e "s|change_me_admin_password|${SEED_ADMIN_PASSWORD}|g" \
  "$TEMPLATE" > "$OUT_FILE"

echo "Gerado $OUT_FILE para a VM ${VM_IP}."
echo
echo "Guarde estas credenciais geradas em local seguro:"
echo "  DB_PASSWORD (postgres)......: ${DB_PASSWORD}"
echo "  SEED_ADMIN_PASSWORD.........: ${SEED_ADMIN_PASSWORD}"
echo
echo "Revise tambem os campos de SMTP, GOOGLE_MAPS_API_KEY e demais"
echo "integracoes opcionais em $OUT_FILE antes de subir a stack."
