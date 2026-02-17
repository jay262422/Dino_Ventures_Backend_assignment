#!/bin/bash
# Setup script: run migrations + seed
set -e

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/wallet_db"
fi

echo "Running migrations..."
psql "$DATABASE_URL" -f migrations/001_init_schema.sql

echo "Running seed..."
psql "$DATABASE_URL" -f seed.sql

echo "Setup complete."
