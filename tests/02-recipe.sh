#!/bin/bash
# Test 2: Recipe page loads without errors

echo "Testing recipe page..."
HTML=$(curl -s "https://crowdsourcedcooking.web.app/recipe.html?id=test")

if echo "$HTML" | grep -q "Recipe - CrowdSourced Cooking"; then
    echo "✓ Recipe page title found"
else
    echo "✗ Recipe page title missing"
    exit 1
fi

if echo "$HTML" | grep -q "</body>"; then
    echo "✓ Recipe page ends properly"
else
    echo "✗ Recipe page missing closing body tag"
    exit 1
fi

# Check nav bullets
if echo "$HTML" | grep -q "list-style: none"; then
    echo "✓ Nav bullet fix in place"
else
    echo "✗ Nav bullet fix missing"
fi

echo "✓ Recipe page tests passed"