#!/bin/bash
# Stop the PostgreSQL Docker container

echo "Stopping PostgreSQL Docker container..."
docker compose stop postgres

if [ $? -eq 0 ]; then
  echo "✓ PostgreSQL container stopped"
  echo "  Data is preserved in volume: chat-app-postgres-data"
  echo "  Restart with: pnpm db:start"
else
  echo "✗ Failed to stop PostgreSQL container"
  exit 1
fi
