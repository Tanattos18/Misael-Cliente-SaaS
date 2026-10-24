#!/usr/bin/env bash
# Backup diário do banco da CuraLog (para a opção VPS; no Supabase Pro o backup diário já é automático).
#
# Uso:   DATABASE_URL=postgres://... ./scripts/backup.sh
# Cron (todo dia às 3h):
#   0 3 * * * cd /opt/curalog && DATABASE_URL=... ./scripts/backup.sh >> /var/log/curalog-backup.log 2>&1
#
# Variáveis opcionais:
#   BACKUP_DIR       pasta dos arquivos (padrão: /var/backups/curalog)
#   BACKUP_DIAS      quantos dias manter (padrão: 30)
#   BACKUP_RCLONE    destino rclone para cópia fora do servidor, ex.: "gdrive:curalog-backups"
#
# Restaurar:  pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" arquivo.dump
set -euo pipefail

: "${DATABASE_URL:?defina DATABASE_URL}"
DIR="${BACKUP_DIR:-/var/backups/curalog}"
DIAS="${BACKUP_DIAS:-30}"
ARQUIVO="$DIR/curalog_$(date +%Y-%m-%d_%H%M).dump"

mkdir -p "$DIR"
chmod 700 "$DIR"   # contém dados de saúde de pacientes

# Formato custom: já comprimido e restaurável tabela a tabela.
pg_dump --format=custom --no-owner --file="$ARQUIVO" "$DATABASE_URL"
chmod 600 "$ARQUIVO"

# Confere que o arquivo é legível antes de considerar o backup feito.
pg_restore --list "$ARQUIVO" > /dev/null
echo "$(date -Is) backup ok: $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"

find "$DIR" -name 'curalog_*.dump' -mtime +"$DIAS" -delete

if [[ -n "${BACKUP_RCLONE:-}" ]]; then
  rclone copy "$ARQUIVO" "$BACKUP_RCLONE"
  echo "$(date -Is) cópia externa ok: $BACKUP_RCLONE"
fi
