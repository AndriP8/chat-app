#!/bin/bash

# Configuration
BACKUP_DIR="/var/www/chat-app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_USER="chatapp"
DB_NAME="chatapp"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform backup
echo "Starting database backup at $(date)..."
pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/chatapp_$DATE.sql.gz"

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully: chatapp_$DATE.sql.gz"

    # Keep only last 7 days of backups
    find "$BACKUP_DIR" -name "chatapp_*.sql.gz" -mtime +7 -delete
    echo "🗑️  Cleaned up backups older than 7 days"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Display backup info
BACKUP_SIZE=$(du -h "$BACKUP_DIR/chatapp_$DATE.sql.gz" | cut -f1)
echo "Backup size: $BACKUP_SIZE"
echo "Backup location: $BACKUP_DIR/chatapp_$DATE.sql.gz"
