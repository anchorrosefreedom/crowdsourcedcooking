#!/bin/bash
# Test 1: Homepage loads without errors

echo "Testing homepage..."
HTML=$(curl -s "https://crowdsourcedcooking.web.app/index.html")

if echo "$HTML" | grep -q "CrowdSourced Cooking"; then
    echo "✓ Homepage title found"
else
    echo "✗ Homepage title missing"
    exit 1
fi

if echo "$HTML" | grep -q "</body>"; then
    echo "✓ Homepage ends properly"
else
    echo "✗ Homepage missing closing body tag"
    exit 1
fi

# Check for exposed code
EXPOSED=$(echo "$HTML" | grep -c "<script>//")
if [ "$EXPOSED" -gt 3 ]; then
    echo "✗ WARNING: $EXPOSED script blocks at end (potential code leak)"
fi

echo "✓ Homepage tests passed"