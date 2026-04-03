const https = require('https');
const fs = require('fs');
const jwt = require('jsonwebtoken');

// Try both service accounts
const accounts = [
  '/Users/anchorrose/Downloads/crowdsourcedcooking-cf5a52eeb67b.json',
  '/Users/anchorrose/Downloads/crowdsourcedcooking-firebase-adminsdk-fbsvc-7b68531380.json'
];

for (const path of accounts) {
  try {
    const sa = JSON.parse(fs.readFileSync(path, 'utf8'));
    console.log('Trying:', sa.client_email);
    
    // Generate token
    const token = jwt.sign(
      { 
        iss: sa.client_email, 
        aud: 'https://oauth2.googleapis.com/token', 
        iat: Math.floor(Date.now()/1000), 
        exp: Math.floor(Date.now()/1000) + 3600,
        scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/cloud-platform.read-write'
      },
      sa.private_key, 
      { algorithm: 'RS256' }
    );
    
    // Exchange for access token
    const tokenReq = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const result = JSON.parse(d);
          if (result.access_token) {
            console.log('Got access token for:', sa.client_email);
            deployRules(result.access_token);
          }
        } catch(e) {}
      });
    });
    
    tokenReq.on('error', () => {});
    tokenReq.write(`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`);
    tokenReq.end();
  } catch(e) {}
}

function deployRules(accessToken) {
  const rules = fs.readFileSync('./firestore.rules', 'utf8');
  
  // Create and release in one go using firebase API
  const rulesetData = JSON.stringify({
    source: { files: [{ name: 'firestore.rules', content: rules }] }
  });
  
  // First create ruleset
  const rsReq = https.request({
    hostname: 'firebaserules.googleapis.com',
    path: '/v1/projects/crowdsourcedcooking/rulesets?alt=json',
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${accessToken}`, 
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const rs = JSON.parse(d);
        console.log('Ruleset created:', rs.name);
        
        // Now create release
        const relReq = https.request({
          hostname: 'firebaserules.googleapis.com',
          path: '/v1/projects/crowdsourcedcooking/releases?alt=json',
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${accessToken}`, 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }, (res2) => {
          let d2 = '';
          res2.on('data', c => d2 += c);
          res2.on('end', () => console.log('Release:', d2.substring(0, 500)));
        });
        
        relReq.on('error', e => console.log('Rel error:', e.message));
        relReq.write(JSON.stringify({
          name: 'projects/crowdsourcedcooking/releases/(latest)',
          rulesetName: rs.name
        }));
        relReq.end();
      } catch(e) {
        console.log('Parse error:', d.substring(0, 300));
      }
    });
  });
  
  rsReq.on('error', e => console.log('RS error:', e.message));
  rsReq.write(rulesetData);
  rsReq.end();
}
