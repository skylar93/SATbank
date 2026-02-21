#!/bin/bash

# Database backup script for Supabase
# Usage: ./backup-sql.sh

# Configuration
DB_HOST="db.eoyzqdsxlweygsukjnef.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
# You'll need to set PGPASSWORD environment variable

# Create timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/satbank_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting database backup..."
echo "Backup file: $BACKUP_FILE"

# Create full database dump
pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --no-password \
  --verbose \
  --no-owner \
  --no-privileges \
  --schema=public \
  --data-only \
  --file="$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully: $BACKUP_FILE"

    # Compress the backup file
    gzip "$BACKUP_FILE"
    echo "✅ Backup compressed: $BACKUP_FILE.gz"

    # Show file size
    ls -lh "$BACKUP_FILE.gz"
else
    echo "❌ Backup failed"
    exit 1
fi
