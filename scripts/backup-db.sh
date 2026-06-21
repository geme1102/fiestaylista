#!/bin/sh
set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="fiestaylista_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

if [ -n "$DATABASE_URL" ]; then
  echo "Usando DATABASE_URL del entorno"
  pg_dump "$DATABASE_URL" --no-owner --no-acl > "${BACKUP_DIR}/${FILENAME}"
elif command -v pg_dump > /dev/null 2>&1; then
  DB_NAME="${PGDATABASE:-fiestaylista}"
  pg_dump "$DB_NAME" --no-owner --no-acl > "${BACKUP_DIR}/${FILENAME}"
else
  echo "Error: pg_dump no encontrado. Instala PostgreSQL o define DATABASE_URL."
  exit 1
fi

gzip "${BACKUP_DIR}/${FILENAME}"
echo "Backup creado: ${BACKUP_DIR}/${FILENAME}.gz ($(du -h "${BACKUP_DIR}/${FILENAME}.gz" | cut -f1))"
