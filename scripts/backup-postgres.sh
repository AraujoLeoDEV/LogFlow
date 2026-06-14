#!/bin/sh
# Backup periodico do Postgres (Fase 15 - Deploy e Producao).
# Roda em loop, gera um dump custom (-Fc) por dia em /backups e remove
# dumps mais antigos que BACKUP_RETENTION_DAYS (default 7).
set -e

mkdir -p /backups

while true; do
  timestamp=$(date +%Y%m%d_%H%M%S)
  file="/backups/${PGDATABASE}_${timestamp}.dump"

  echo "[backup-postgres] iniciando dump em ${file}"
  if pg_dump -Fc -f "${file}"; then
    echo "[backup-postgres] dump concluido"
  else
    echo "[backup-postgres] falha ao gerar dump" >&2
    rm -f "${file}"
  fi

  find /backups -name "*.dump" -mtime "+${BACKUP_RETENTION_DAYS:-7}" -delete

  sleep 86400
done
