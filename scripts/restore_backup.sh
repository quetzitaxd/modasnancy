#!/usr/bin/env bash
set -euo pipefail

# Restore a backup SQL into a new/target database inside the Dockerized MariaDB instance.
# This script assumes docker-compose services are available and that the DB container
# can be accessed with a root password available in the environment variable DB_ROOT_PASSWORD.

# Usage: ./scripts/restore_backup.sh <backup_file.sql> [target_db_name]

BACKUP_FILE="${1:-backup.sql}"
TARGET_DB="${2:-modasnancy_db}"

DB_ROOT_PASSWORD=""

if [[ -z "$DB_ROOT_PASSWORD" ]]; then
  if [[ -f ".env" ]]; then
    # Attempt to read DB_ROOT_PASSWORD from the local .env file
    DB_ROOT_PASSWORD=$(grep -E '^DB_ROOT_PASSWORD=' .env | head -n1 | cut -d '=' -f2-)
  fi
fi

DB_CONTAINER="${DB_CONTAINER:-modasnancy-db}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER_ROOT="root"

if [[ -z "$DB_ROOT_PASSWORD" ]]; then
  echo "[error] DB_ROOT_PASSWORD is not set. Export it or pass via environment."
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[error] Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "[info] Starting migration:"
echo "  Backup file: $BACKUP_FILE"
echo "  Target DB:   $TARGET_DB"

echo "[info] Ensuring DB container is up..."
docker-compose up -d db >/dev/null

# Wait for MySQL to be ready
echo "[info] Waiting for database to be ready..."
TIMEOUT=60
COUNT=0
until docker exec "$DB_CONTAINER" mysqladmin ping -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER_ROOT" --password="$DB_ROOT_PASSWORD" --silent; do
  sleep 2
  COUNT=$((COUNT+2))
  if (( COUNT >= TIMEOUT )); then
    echo "[error] Database did not become ready within timeout."; exit 1
  fi
done

echo "[info] Copying backup into the DB container..."
docker cp "$BACKUP_FILE" "$DB_CONTAINER":/backup/backup.sql

echo "[info] Creating target database if not exists..."
docker exec -i "$DB_CONTAINER" bash -lc "mysql -u root -p\"$DB_ROOT_PASSWORD\" -e \"CREATE DATABASE IF NOT EXISTS \`$TARGET_DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""

echo "[info] Importing backup into target database..."
docker exec -i "$DB_CONTAINER" bash -lc "mysql -u root -p\"$DB_ROOT_PASSWORD\" \"$TARGET_DB\" < /backup/backup.sql"

if docker exec -i "$DB_CONTAINER" bash -lc '[ -f /backup/migrate.sql ]'; then
  echo "[info] Applying additional migrations (migrate.sql) if present..."
  docker exec -i "$DB_CONTAINER" bash -lc "if [ -f /backup/migrate.sql ]; then mysql -u root -p\"$DB_ROOT_PASSWORD\" \"$TARGET_DB\" < /backup/migrate.sql; fi"
fi

echo "[info] Migration complete for database: $TARGET_DB"
echo "[info] Listing tables in target database..."
docker exec -i "$DB_CONTAINER" bash -lc "echo 'Tables:'; mysql -u root -p\"$DB_ROOT_PASSWORD\" -e \"SHOW TABLES IN \`$TARGET_DB\`;\""

echo "[info] Next steps: update your application configuration to point to database '$TARGET_DB' and restart relevant services."
