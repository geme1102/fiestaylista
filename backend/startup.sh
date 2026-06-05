#!/bin/sh
set -e

echo "=== Ejecutando migraciones ==="
npx drizzle-kit migrate

echo "=== Iniciando servidor ==="
exec node dist/index.js
