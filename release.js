const https = require('https');
const fs = require('fs');
const jsonwebtoken = require('jsonwebtoken');

const serviceAccount = JSON.parse(fs.readFileSync('/Users/anchorrose/Downloads/crowdsourcedcooking-cf5a52eeb67b.json', 'utf8'));

function getAccessToken() {
  return new Promise((resolve, reject) => {
    const jwt = jsonwebtoken.sign(
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
    
    const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;
    
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).access_token));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function releaseRules() {
  const accessToken = await getAccessToken();
  console.log('Token obtained');
  
  // First create a new ruleset
  const rulesContent = fs.readFileSync('./firestore.rules', 'utf8');
  
  const rulesetData = JSON.stringify({
    name: 'projects/crowdsourcedcooking/rulesets',
    source: { files: [{ name: 'firestore.rules', content: rulesContent }] }
  });
  
  const req1 = https.request({
    hostname: 'firebaserules.googleapis.com',
    path: '/v1/projects/crowdsourcedcooking/rulesets',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(rulesetData) }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', async () => {
      const result = JSON.parse(data);
      console.log('Ruleset created:', result.name);
      
      // Now release it
      const releaseData = JSON.stringify({
        name: 'projects/crowdsourcedcooking/releases/(latest)',
        rulesetName: result.name
      });
      
      const req2 = https.request({
        hostname: 'firebaserules.googleapis.com',
        path: '/v1/projects/crowdsourcedcooking/releases',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(releaseData) }
      }, (res2) => {
        let data2 = '';
        res2.on('data', c => data2 += c);
        res2.on('end', () => console.log('Release response:', data2.substring(0, 300)));
      });
      req2.on('error', e => console.log('Release error:', e.message));
      req2.write(releaseData);
      req2.end();
    });
  });
  
  req1.on('error', e => console.log('Error:', e.message));
  req1.write(rulesetData);
  req1.end();
}

releaseRules();
