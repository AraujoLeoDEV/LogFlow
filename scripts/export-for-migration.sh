#!/bin/bash
# Empacota o codigo do projeto e gera um dump do banco de producao atual
# para transferencia manual para a nova VM (Windows Server 2019 + WSL2 +
# Docker). Roda na maquina atual, a partir da raiz do projeto.
#
# Uso: ./scripts/export-for-migration.sh
#
# Gera em ./migration/:
#   - antigravity-app_<timestamp>.tar.gz  (codigo-fonte, sem node_modules/.git/etc)
#   - logistica_db_<timestamp>.dump       (dump custom do Postgres, via pg_dump -Fc)
set -euo pipefail

cd "$(dirname "$0")/.."

OUT_DIR="migration"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$OUT_DIR"

echo "==> Empacotando codigo do projeto..."
tar \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='generated' \
  --exclude='storage' \
  --exclude='coverage' \
  --exclude="$OUT_DIR" \
  --exclude='backend/.env' \
  --exclude='backend/.env.dev' \
  --exclude='frontend/.env' \
  --exclude='frontend/.env.dev' \
  --exclude='.env.production' \
  -czf "$OUT_DIR/antigravity-app_${TIMESTAMP}.tar.gz" .
echo "    -> $OUT_DIR/antigravity-app_${TIMESTAMP}.tar.gz"

DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-logistica_db}"

echo "==> Gerando dump do banco de producao (${DB_NAME})..."
docker compose exec -T postgres pg_dump -Fc -U "$DB_USER" "$DB_NAME" \
  > "$OUT_DIR/logistica_db_${TIMESTAMP}.dump"
echo "    -> $OUT_DIR/logistica_db_${TIMESTAMP}.dump"

echo
echo "Pacote gerado em $OUT_DIR/:"
ls -lh "$OUT_DIR"
echo
echo "Copie esses dois arquivos para a nova VM e siga o runbook"
echo "DEPLOY_WINDOWS_SERVER_2019.md."
