#!/bin/sh
set -e

echo "=== Iniciando servidor ==="
exec node dist/index.js
