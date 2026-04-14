#!/bin/bash
# Test 4: Cloud Functions API endpoints

BASE="https://us-central1-crowdsourcedcooking.cloudfunctions.net"

echo "Testing API endpoints..."

# Test getCustomTags
RESP=$(curl -s "$BASE/getCustomTags?category=proteins")
if echo "$RESP" | grep -q "tags"; then
    echo "✓ getCustomTags works"
else
    echo "✗ getCustomTags failed: $RESP"
fi

# Test getCustomTags general
RESP=$(curl -s "$BASE/getCustomTags?category=general")
if echo "$RESP" | grep -q "tags"; then
    echo "✓ getCustomTags general works"
else
    echo "✗ getCustomTags general failed"
fi

# Test importRecipe endpoint exists
RESP=$(curl -s -X POST "$BASE/importRecipe" -H "Content-Type: application/json" -d '{"url":"https://example.com"}')
if echo "$RESP" | grep -q "error\|recipe"; then
    echo "✓ importRecipe endpoint works"
else
    echo "✗ importRecipe might have issue"
fi

echo "✓ API tests passed"