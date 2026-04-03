const https = require('https');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const sa = JSON.parse(fs.readFileSync('/Users/anchorrose/Downloads/crowdsourcedcooking-cf5a52eeb67b.json', 'utf8'));

async function getToken() {
  const token = jwt.sign(
    { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3600 },
    sa.private_key, { algorithm: 'RS256' }
  );
  
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d).access_token));
    });
    req.on('error', reject);
    req.write(`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`);
    req.end();
  });
}

async function deploy() {
  const token = await getToken();
  const rules = fs.readFileSync('./firestore.rules', 'utf8');
  const encodedRules = Buffer.from(rules).toString('base64');
  
  const data = JSON.stringify({
    indexConfig: {},
    fieldOverrides: []
  });
  
  const req = https.request({
    hostname: 'firestore.googleapis.com',
    path: '/v1/projects/crowdsourcedcooking/databases/(default):updateDatabase',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => console.log('Firestore DB response:', d.substring(0, 500)));
  });
  req.on('error', e => console.log('Error:', e.message));
  req.write(data);
  req.end();
}

deploy();
