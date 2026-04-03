const https = require('https');
const fs = require('fs');
const path = require('path');

// Read service account
const serviceAccount = JSON.parse(fs.readFileSync('/Users/anchorrose/Downloads/crowdsourcedcooking-cf5a52eeb67b.json', 'utf8'));

// Get access token using JWT
function getAccessToken() {
  return new Promise((resolve, reject) => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      serviceAccount.private_key,
      { algorithm: 'RS256' }
    );
    
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`;
    
    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.access_token);
        } catch(e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function deployFirestoreRules() {
  try {
    const accessToken = await getAccessToken();
    console.log('Got access token');
    
    const rulesContent = fs.readFileSync(path.join(__dirname, 'firestore.rules'), 'utf8');
    
    // Use Firestore API to get current rules first
    const getOptions = {
      hostname: 'firestore.googleapis.com',
      path: '/v1/projects/crowdsourcedcooking/databases/(default)',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    console.log('Getting current database config...');
    
    // Try the correct API
    const updateOptions = {
      hostname: 'firebaserules.googleapis.com',
      path: '/v1/projects/crowdsourcedcooking/releases',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    // Build the ruleset
    const ruleset = {
      name: 'projects/crowdsourcedcooking/rulesets',
      source: {
        files: [{
          name: 'firestore.rules',
          content: rulesContent
        }]
      }
    };
    
    console.log('Creating ruleset...');
    const req2 = https.request({
      hostname: 'firebaserules.googleapis.com',
      path: '/v1/projects/crowdsourcedcooking/rulesets',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Ruleset response:', data.substring(0, 500));
      });
    });
    
    req2.on('error', e => console.log('Error:', e.message));
    req2.write(JSON.stringify(ruleset));
    req2.end();
    
  } catch(e) {
    console.log('Error:', e.message);
  }
}

deployFirestoreRules();
