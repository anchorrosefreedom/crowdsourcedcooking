const fs = require('fs');
const { FirestoreManagementServiceClient } = require('@google-cloud/firestore-admin');

async function deployRules() {
  const client = new FirestoreManagementServiceClient({
    keyFilename: '/Users/anchorrose/Downloads/crowdsourcedcooking-cf5a52eeb67b.json'
  });
  
  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}`;
  
  const parent = 'projects/crowdsourcedcooking/databases/(default)';
  
  try {
    const [policy] = await client.getDatabase({
      name: parent
    });
    console.log('Current policy:', policy);
  } catch(e) {
    console.log('Error:', e.message);
  }
}

deployRules();
