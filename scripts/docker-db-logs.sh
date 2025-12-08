#!/bin/bash
# View PostgreSQL Docker container logs

echo "Showing PostgreSQL logs (Ctrl+C to exit)..."
docker compose logs -f postgres
