const https = require('https');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const sa = JSON.parse(fs.readFileSync('/Users/anchorrose/Downloads/crowdsourcedcooking-firebase-adminsdk-fbsvc-7b68531380.json', 'utf8'));

console.log('Service account:', sa.client_email);

async function getToken() {
  const token = jwt.sign(
    { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3600 },
    sa.private_key, { algorithm: 'RS256' }
  );
  
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d).access_token); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`);
    req.end();
  });
}

async function deployRules() {
  const token = await getToken();
  console.log('Got token');
  
  const rules = fs.readFileSync('./firestore.rules', 'utf8');
  
  const req = https.request({
    hostname: 'firebaserules.googleapis.com',
    path: '/v1/projects/crowdsourcedcooking/rulesets',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      console.log('Result:', d.substring(0, 800));
    });
  });
  
  req.on('error', e => console.log('Error:', e.message));
  req.write(JSON.stringify({
    name: 'projects/crowdsourcedcooking/rulesets',
    source: { files: [{ name: 'firestore.rules', content: rules }] }
  }));
  req.end();
}

deployRules().catch(e => console.log('Error:', e.message));
