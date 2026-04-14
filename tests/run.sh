#!/bin/bash
# Run all tests
# Usage: ./tests/run.sh

cd "$(dirname "$0")"

echo "=== CrowdSourced Cooking Test Suite ==="
echo ""

PASS=0
FAIL=0

for test in tests/*.sh; do
    if [ "$test" = "tests/run.sh" ]; then continue; fi
    
    echo "Running $(basename $test)..."
    chmod +x "$test"
    if bash "$test"; then
        ((PASS++))
    else
        ((FAIL++))
    fi
    echo ""
done

echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"

if [ $FAIL -eq 0 ]; then
    echo "✓ All tests passed!"
    exit 0
else
    echo "✗ Some tests failed"
    exit 1
fi