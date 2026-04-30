const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').filter(Boolean);
env.forEach(l => { const [k, v] = l.split('='); if (k && v) process.env[k.trim()] = v.trim(); });

// Load auditor module to test its extractJSON
const auditor = require('./modules/repo-auditor');
const raw = fs.readFileSync('/tmp/archiview-json-fail-1777585753799.txt', 'utf8');

try {
  const result = JSON.parse(auditor.extractJSON(raw));
  console.log('PASS: extracted valid JSON');
  console.log('summary:', result.summary);
  console.log('has full_file_content:', !!result.full_file_content);
  console.log('has verification:', !!result.verification);
} catch(e) {
  console.log('FAIL:', e.message);
}
