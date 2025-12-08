#!/bin/bash
# Start the PostgreSQL Docker container

# Load environment variables from .env.docker if it exists
if [ -f .env.docker ]; then
  export $(cat .env.docker | grep -v '^#' | xargs)
fi

POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_PORT=${POSTGRES_PORT}

echo "Starting PostgreSQL Docker container..."
docker compose up -d postgres

# Wait for database to be healthy
echo "Waiting for database to be ready..."
timeout 30s bash -c "until docker compose exec postgres pg_isready -U $POSTGRES_USER -d $POSTGRES_DB > /dev/null 2>&1; do sleep 1; done"

if [ $? -eq 0 ]; then
  echo "✓ PostgreSQL is ready at localhost:$POSTGRES_PORT"
  echo "  Database: $POSTGRES_DB"
  echo "  User: $POSTGRES_USER"
  echo "  Password: $POSTGRES_PASSWORD"
else
  echo "✗ Database failed to start. Check logs with: pnpm db:logs"
  exit 1
fi
