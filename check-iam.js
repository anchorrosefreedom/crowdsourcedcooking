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

async function checkIAM() {
  const token = await getToken();
  
  const req = https.request({
    hostname: 'cloudresourcemanager.googleapis.com',
    path: '/v1/projects/crowdsourcedcooking:getIamPolicy',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const policy = JSON.parse(d);
        console.log('Policy bindings:');
        policy.bindings?.forEach(b => {
          console.log('Role:', b.role);
          console.log('Members:', b.members.join(', '));
          console.log('---');
        });
      } catch(e) {
        console.log('Error parsing:', d.substring(0, 500));
      }
    });
  });
  req.on('error', e => console.log('Error:', e.message));
  req.write('{}');
  req.end();
}

checkIAM();
