#!/bin/bash

# Configuration
HEALTH_URL="http://localhost:3001/api/health"
LOG_FILE="/var/www/chat-app/logs/health-check.log"
MAX_RETRIES=3

# Function to check health
check_health() {
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>&1)
    echo "$STATUS"
}

# Main health check logic
echo "[$(date)] Starting health check..." >> "$LOG_FILE"

STATUS=$(check_health)

if [ "$STATUS" = "200" ]; then
    # Health check passed - silent success
    exit 0
else
    echo "[$(date)] ⚠️  Health check failed with status: $STATUS" >> "$LOG_FILE"

    # Retry a few times before restarting
    for i in $(seq 1 $MAX_RETRIES); do
        echo "[$(date)] Retry attempt $i/$MAX_RETRIES..." >> "$LOG_FILE"
        sleep 2
        STATUS=$(check_health)

        if [ "$STATUS" = "200" ]; then
            echo "[$(date)] ✅ Health check recovered on retry $i" >> "$LOG_FILE"
            exit 0
        fi
    done

    # All retries failed - restart the service
    echo "[$(date)] ❌ All retries failed. Restarting backend service..." >> "$LOG_FILE"
    pm2 restart chat-app-backend >> "$LOG_FILE" 2>&1

    # Wait for service to start
    sleep 5

    # Final check
    STATUS=$(check_health)
    if [ "$STATUS" = "200" ]; then
        echo "[$(date)] ✅ Service restarted successfully" >> "$LOG_FILE"
    else
        echo "[$(date)] 🚨 CRITICAL: Service failed to restart (status: $STATUS)" >> "$LOG_FILE"
        # Consider sending an alert here (email, Slack, etc.)
    fi
fi
