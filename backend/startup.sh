#!/bin/sh
set -e
NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=448}"
export NODE_OPTIONS
exec node dist/backend/src/index.js
