#!/usr/bin/env bash

set -euo pipefail

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="${SCRIPT_DIR}/deployment.log"
readonly HEALTH_CHECK_URL="http://localhost:3001/api/health"
readonly HEALTH_CHECK_RETRIES=5
readonly HEALTH_CHECK_DELAY=5

###############################################################################
# Helper Functions
###############################################################################

log() {
  local level="$1"
  shift
  local message="$*"
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  case "$level" in
    INFO)
      echo -e "${BLUE}[INFO]${NC} ${message}"
      ;;
    SUCCESS)
      echo -e "${GREEN}[SUCCESS]${NC} ${message}"
      ;;
    WARNING)
      echo -e "${YELLOW}[WARNING]${NC} ${message}"
      ;;
    ERROR)
      echo -e "${RED}[ERROR]${NC} ${message}"
      ;;
  esac

  echo "[${timestamp}] [${level}] ${message}" >> "$LOG_FILE"
}

error_exit() {
  log ERROR "$1"
  exit 1
}

check_prerequisites() {
  log INFO "Checking prerequisites..."

  if ! command -v docker &> /dev/null; then
    error_exit "Docker is not installed. Please install Docker first."
  fi

  if ! docker info &> /dev/null; then
    error_exit "Docker daemon is not running. Please start Docker."
  fi

  if ! docker compose version &> /dev/null; then
    error_exit "Docker Compose is not available. Please install Docker Compose."
  fi

  log SUCCESS "All prerequisites met"
}

pull_latest_code() {
  log INFO "Pulling latest code from git..."

  cd "$SCRIPT_DIR"

  if ! git diff-index --quiet HEAD --; then
    error_exit "Local changes detected in repository. Deployment aborted. Please commit or reset changes first."
  fi

  git fetch origin || error_exit "Failed to fetch from origin"

  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)

  git reset --hard "origin/${current_branch}" || error_exit "Failed to reset to origin/${current_branch}"

  local commit_hash
  commit_hash=$(git rev-parse --short HEAD)

  log SUCCESS "Updated to latest commit: ${commit_hash}"
}

build_docker_images() {
  log INFO "Building Docker images on VPS..."

  cd "$SCRIPT_DIR"

  if ! docker compose build; then
    error_exit "Failed to build Docker images"
  fi

  log SUCCESS "Docker images built successfully"
}

run_database_migration() {
  log INFO "Running database migrations..."

  cd "$SCRIPT_DIR"

  if ! docker compose run --rm backend pnpm --filter @chat-app/backend db:migrate; then
    error_exit "Database migration failed"
  fi

  log SUCCESS "Database migrations completed"
}

restart_services() {
  log INFO "Restarting services with newly built images..."

  cd "$SCRIPT_DIR"

  if ! docker compose up -d; then
    error_exit "Failed to restart services"
  fi

  log SUCCESS "Services restarted"
}

health_check() {
  log INFO "Waiting for backend container to be healthy..."

  cd "$SCRIPT_DIR"

  # Wait for Docker healthcheck to pass (max 60 seconds)
  local wait_time=0
  local max_wait=60

  while [[ $wait_time -lt $max_wait ]]; do
    local health_status
    health_status=$(docker inspect --format='{{.State.Health.Status}}' chat-app-backend 2>/dev/null || echo "none")

    if [[ "$health_status" == "healthy" ]]; then
      log SUCCESS "Backend container is healthy"
      break
    fi

    if [[ $wait_time -eq 0 ]]; then
      log INFO "Waiting for backend healthcheck... (status: ${health_status})"
    fi

    sleep 2
    wait_time=$((wait_time + 2))
  done

  if [[ $wait_time -ge $max_wait ]]; then
    log WARNING "Backend container healthcheck timeout. Attempting direct HTTP check..."
  fi

  log INFO "Running HTTP health check..."

  local retries=0

  while [[ $retries -lt $HEALTH_CHECK_RETRIES ]]; do
    log INFO "Health check attempt $((retries + 1))/${HEALTH_CHECK_RETRIES}..."

    local status_code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_CHECK_URL" || echo "000")

    if [[ "$status_code" == "200" ]]; then
      log SUCCESS "Backend health check passed (HTTP ${status_code})"
      return 0
    fi

    log WARNING "Health check failed (HTTP ${status_code}). Retrying in ${HEALTH_CHECK_DELAY}s..."
    sleep "$HEALTH_CHECK_DELAY"
    retries=$((retries + 1))
  done

  log ERROR "Health check failed after ${HEALTH_CHECK_RETRIES} attempts"
  log ERROR "Check logs with: docker compose logs backend"
  return 1
}

show_deployment_status() {
  log INFO "Current deployment status:"

  cd "$SCRIPT_DIR"

  echo ""
  docker compose ps
  echo ""

  local commit_hash
  commit_hash=$(git rev-parse --short HEAD)

  local commit_message
  commit_message=$(git log -1 --pretty=%B | head -n 1)

  log INFO "Deployed commit: ${commit_hash} - ${commit_message}"
}

cleanup_old_images() {
  log INFO "Cleaning up old Docker images..."

  if docker image prune -f &> /dev/null; then
    log SUCCESS "Old images cleaned up"
  else
    log WARNING "Could not clean up old images (this is non-critical)"
  fi
}

###############################################################################
# Main Deployment Flow
###############################################################################

main() {
  local start_time
  start_time=$(date '+%s')

  log INFO "=== Starting deployment at $(date) ==="
  echo ""

  check_prerequisites
  echo ""

  pull_latest_code
  echo ""

  build_docker_images
  echo ""

  run_database_migration
  echo ""

  restart_services
  echo ""

  if ! health_check; then
    log WARNING "Deployment completed with warnings (health check failed)"
    log INFO "Services are running but may not be healthy. Check logs for details."
    exit 1
  fi
  echo ""

  show_deployment_status
  echo ""

  cleanup_old_images
  echo ""

  local end_time
  end_time=$(date '+%s')
  local duration=$((end_time - start_time))

  log SUCCESS "=== Deployment completed successfully in ${duration}s ==="
  log INFO "Deployment log saved to: ${LOG_FILE}"
}

main "$@"
