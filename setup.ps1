# Setup script for Windows: run migrations + seed
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://postgres:postgres@localhost:5432/wallet_db" }

Write-Host "Running migrations..."
psql $env:DATABASE_URL -f migrations/001_init_schema.sql

Write-Host "Running seed..."
psql $env:DATABASE_URL -f seed.sql

Write-Host "Setup complete."
