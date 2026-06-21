#!/bin/sh
set -e

if [ -z "$1" ]; then
  echo "Uso: $0 <archivo.sql.gz>"
  echo "Ej: $0 ./backups/fiestaylista_20250621_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Archivo no encontrado: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  VAS A RESTAURAR LA BASE DE DATOS DESDE: $BACKUP_FILE"
echo "   Esto SOBRESCRIBIRÁ todos los datos actuales."
printf "   ¿Continuar? (escribe 'si' para confirmar): "
read -r CONFIRM
if [ "$CONFIRM" != "si" ]; then
  echo "Restauración cancelada."
  exit 0
fi

if echo "$BACKUP_FILE" | grep -q '\.gz$'; then
  gunzip -c "$BACKUP_FILE" | psql "${DATABASE_URL:-postgresql://postgres:password@localhost:5432/fiestaylista}"
else
  psql "${DATABASE_URL:-postgresql://postgres:password@localhost:5432/fiestaylista}" < "$BACKUP_FILE"
fi

echo "Base de datos restaurada desde: $BACKUP_FILE"
