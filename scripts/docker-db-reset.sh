#!/bin/bash
# Reset the PostgreSQL Docker container (removes all data)

echo "⚠️  WARNING: This will delete all data in the database!"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read -r

echo "Stopping and removing PostgreSQL container and volume..."
docker compose down -v

if [ $? -eq 0 ]; then
  echo "✓ Database reset complete"
  echo ""
  echo "Next steps:"
  echo "  1. Start database: pnpm db:start"
  echo "  2. Run migrations: cd packages/backend && pnpm db:push"
  echo "  3. (Optional) Seed data: cd packages/backend && pnpm tsx src/scripts/seedMessages.ts"
else
  echo "✗ Failed to reset database"
  exit 1
fi
