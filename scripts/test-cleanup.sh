#!/bin/bash
# Safe test environment cleanup
# Kills processes on test ports (excluding Docker), clears caches, removes artifacts

echo "╔════════════════════════════════════════════╗"
echo "║  Test Environment Cleanup                  ║"
echo "╚════════════════════════════════════════════╝"

# Ports used by this project
FRONTEND_PORT=5173
BACKEND_PORT=3001

# Kill processes on test ports (but NOT Docker)
cleanup_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pids" ]; then
        for pid in $pids; do
            # Don't kill Docker processes
            local cmd=$(ps -p $pid -o comm= 2>/dev/null)
            if [[ "$cmd" != *"docker"* && "$cmd" != *"Docker"* && "$cmd" != *"com.docker"* ]]; then
                echo "  Killing process $pid on port $port ($cmd)"
                kill -9 $pid 2>/dev/null
            else
                echo "  Skipping Docker process on port $port"
            fi
        done
    else
        echo "  Port $port: clear"
    fi
}

echo ""
echo "Checking ports..."
cleanup_port $FRONTEND_PORT
cleanup_port $BACKEND_PORT

# Clear node module caches
echo ""
echo "Clearing caches..."
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo "  Cleared node_modules/.cache"
fi
if ls packages/*/node_modules/.cache 1>/dev/null 2>&1; then
    rm -rf packages/*/node_modules/.cache
    echo "  Cleared packages/*/node_modules/.cache"
fi

# Clear test artifacts
echo ""
echo "Clearing test artifacts..."
[ -d "test-reports" ] && rm -rf test-reports && echo "  Removed test-reports/"
[ -d "playwright-report" ] && rm -rf playwright-report && echo "  Removed playwright-report/"
[ -d "packages/frontend/coverage" ] && rm -rf packages/frontend/coverage && echo "  Removed packages/frontend/coverage/"
[ -d "packages/backend/coverage" ] && rm -rf packages/backend/coverage && echo "  Removed packages/backend/coverage/"

echo ""
echo "✓ Test environment cleaned"
