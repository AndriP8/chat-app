#!/bin/bash
# Connect to PostgreSQL shell (psql)

# Load environment variables from .env.docker if it exists
if [ -f .env.docker ]; then
  export $(cat .env.docker | grep -v '^#' | xargs)
fi

POSTGRES_USER=${POSTGRES_USER}
POSTGRES_DB=${POSTGRES_DB}

echo "Connecting to PostgreSQL shell..."
echo "Type 'exit' or press Ctrl+D to quit"
echo ""
docker compose exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
