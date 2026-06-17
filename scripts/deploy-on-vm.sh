#!/bin/bash
# Roda DENTRO da nova VM (WSL2/Ubuntu), na raiz do projeto ja extraido.
# Restaura o dump do banco e sobe a stack de producao
# (docker-compose.prod.yml) com Caddy + tls internal.
#
# Uso: ./scripts/deploy-on-vm.sh <IP_DA_VM> <caminho_para_o_dump.dump>
# Ex.: ./scripts/deploy-on-vm.sh 10.90.10.50 ~/migration/logistica_db_20260615.dump
set -euo pipefail

cd "$(dirname "$0")/.."

VM_IP="${1:?Uso: $0 <IP_DA_VM> <arquivo .dump>}"
DUMP_FILE="${2:?Uso: $0 <IP_DA_VM> <arquivo .dump>}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Erro: dump '$DUMP_FILE' nao encontrado." >&2
  exit 1
fi

if [ ! -f .env.production ]; then
  echo "==> .env.production nao encontrado, gerando..."
  ./scripts/generate-env-production.sh "$VM_IP"
fi

set -a
# shellcheck disable=SC1091
source .env.production
set +a

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

echo "==> Subindo postgres e redis..."
$COMPOSE up -d postgres redis

echo "==> Aguardando postgres ficar saudavel..."
until $COMPOSE exec -T postgres pg_isready -U "$DB_USER" >/dev/null 2>&1; do
  sleep 2
done

echo "==> Restaurando dump ($DUMP_FILE) em '$DB_NAME'..."
cat "$DUMP_FILE" | $COMPOSE exec -T postgres \
  pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner --role="$DB_USER"

echo "==> Build e subida do restante da stack (backend, frontend, caddy, backup)..."
$COMPOSE up -d --build

echo
echo "==> Pronto! Servicos:"
$COMPOSE ps
echo
echo "Frontend: ${APP_DOMAIN}"
echo "API:      ${API_DOMAIN}"
echo
echo "Obs: o backend roda 'prisma migrate deploy' automaticamente na"
echo "inicializacao (ver backend/Dockerfile, stage 'production')."
