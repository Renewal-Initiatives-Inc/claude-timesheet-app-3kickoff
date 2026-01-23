#!/bin/bash
# Adaptive E2E runner: parallel first, sequential on server crash
# This script attempts to run tests in parallel mode first (fast).
# If server overload is detected (connection errors), it retries sequentially.

echo "╔════════════════════════════════════════════╗"
echo "║  E2E Tests - Parallel Mode (Attempt 1)     ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Create temp file for output capture
TEMP_OUTPUT=$(mktemp)

# Run parallel (Playwright default)
npx playwright test "$@" 2>&1 | tee "$TEMP_OUTPUT"
EXIT_CODE=${PIPESTATUS[0]}

if [ $EXIT_CODE -ne 0 ]; then
    # Check for server crash indicators (connection errors)
    if grep -q -E "(ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket hang up|net::ERR_CONNECTION|Target closed|Browser closed|Page closed|Context closed)" "$TEMP_OUTPUT" 2>/dev/null; then
        echo ""
        echo "╔════════════════════════════════════════════╗"
        echo "║  Server overload detected!                 ║"
        echo "║  Cleaning up and retrying sequentially...  ║"
        echo "╚════════════════════════════════════════════╝"
        echo ""

        # Clean up ports and caches
        npm run test:clean 2>/dev/null || true

        # Give servers time to fully terminate
        sleep 3

        echo ""
        echo "╔════════════════════════════════════════════╗"
        echo "║  E2E Tests - Sequential Mode (Attempt 2)   ║"
        echo "╚════════════════════════════════════════════╝"
        echo ""

        # Retry with single worker (sequential)
        npx playwright test --workers=1 "$@"
        EXIT_CODE=$?

        if [ $EXIT_CODE -eq 0 ]; then
            echo ""
            echo "╔════════════════════════════════════════════╗"
            echo "║  ✓ Tests PASSED in sequential mode         ║"
            echo "║    (server couldn't handle parallel load)  ║"
            echo "╚════════════════════════════════════════════╝"
        fi
    else
        echo ""
        echo "╔════════════════════════════════════════════╗"
        echo "║  Tests failed (actual test failures)       ║"
        echo "║  Not a server crash - no retry needed      ║"
        echo "╚════════════════════════════════════════════╝"
    fi
fi

# Cleanup temp file
rm -f "$TEMP_OUTPUT"

exit $EXIT_CODE
