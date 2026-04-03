const { exec } = require('child_process');
const saPath = '/Users/anchorrose/Downloads/crowdsourcedcooking-cf5a52eeb67b.json';

exec(`GOOGLE_APPLICATION_CREDENTIALS="${saPath}" npx firebase firestore:rules:tail`, (err, stdout, stderr) => {
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
  if (err) console.log('error:', err.message);
});
