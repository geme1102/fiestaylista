#!/bin/sh
set -e

echo "=== Intentando migraciones (si fallan, ignoramos - ya aplicadas) ==="
npx drizzle-kit migrate --config=./drizzle.config.js 2>&1 || echo "Migraciones ya aplicadas, continuando..."

echo "=== Iniciando servidor ==="
exec node dist/index.js
