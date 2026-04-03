const https = require('https');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const sa = JSON.parse(fs.readFileSync('/Users/anchorrose/Downloads/crowdsourcedcooking-firebase-adminsdk-fbsvc-7b68531380.json', 'utf8'));

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

async function release() {
  const token = await getToken();
  
  // First create a ruleset
  const rules = fs.readFileSync('./firestore.rules', 'utf8');
  
  // Create ruleset
  const rsReq = https.request({
    hostname: 'firebaserules.googleapis.com',
    path: '/v1/projects/crowdsourcedcooking/rulesets',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  }, (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', async () => {
      const rs = JSON.parse(d);
      console.log('Created ruleset:', rs.name);
      
      // Now release it
      const relReq = https.request({
        hostname: 'firebaserules.googleapis.com',
        path: '/v1/projects/crowdsourcedcooking/releases',
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      }, (res2) => {
        let d2 = '';
        res2.on('data', c => d2 += c);
        res2.on('end', () => {
          console.log('Release result:', d2);
        });
      });
      
      relReq.on('error', e => console.log('Release error:', e.message));
      relReq.write(JSON.stringify({
        name: 'projects/crowdsourcedcooking/releases/(latest)',
        rulesetName: rs.name
      }));
      relReq.end();
    });
  });
  
  rsReq.on('error', e => console.log('Ruleset error:', e.message));
  rsReq.write(JSON.stringify({
    name: 'projects/crowdsourcedcooking/rulesets',
    source: { files: [{ name: 'firestore.rules', content: rules }] }
  }));
  rsReq.end();
}

release().catch(e => console.log('Error:', e.message));
