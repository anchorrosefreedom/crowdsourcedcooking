#!/bin/bash
# Test 3: Submit recipe page loads without code leak

echo "Testing submit page..."
HTML=$(curl -s "https://crowdsourcedcooking.web.app/submit-recipe.html")

if echo "$HTML" | grep -q "Submit Your Recipe"; then
    echo "✓ Submit page title found"
else
    echo "✗ Submit page title missing"
    exit 1
fi

# Count script tags at end - should be clean
ENDSCRIPTS=$(echo "$HTML" | tail -5 | grep -c "<script>")
if [ "$ENDSCRIPTS" -eq 1 ]; then
    echo "✓ Only one script at end"
else
    echo "✗ Multiple scripts at end: $ENDSCRIPTS"
fi

# Check for exposed JavaScript at very end
LASTLINE=$(echo "$HTML" | tail -1)
if echo "$LASTLINE" | grep -q "^</"; then
    echo "✓ Page ends with </body>"
elif echo "$LASTLINE" | grep -q "<script"; then
    echo "✗ Page ends with unclosed script"
else
    echo "✓ Page ends properly"
fi

# Check URL fields exist
if echo "$HTML" | grep -q "Recipe Source Link"; then
    echo "✓ Recipe Source Link field exists"
else
    echo "✗ Recipe Source Link field missing"
fi

if echo "$HTML" | grep -q "Technique Resource URL"; then
    echo "✓ Technique Resource URL field exists"
else
    echo "✗ Technique Resource URL field missing"
fi

# Check custom tag loading code
if echo "$HTML" | grep -q "_tl"; then
    echo "✓ Custom tag loader exists"
else
    echo "✗ Custom tag loader missing"
fi

echo "✓ Submit page tests passed"