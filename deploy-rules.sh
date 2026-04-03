#!/bin/bash
# Deploy Firestore rules to CrowdSourced Cooking

cd /Users/anchorrose/.openclaw/workspace/crowdsourcedcooking

# Use the service account to authenticate and deploy
firebase deploy --only firestore \
  --project crowdsourcedcooking \
  --token "$(cat ~/.config/firebase/token.json 2>/dev/null || echo '')"

echo "Done!"