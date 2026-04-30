const fs = require('fs');
const path = require('path');

// Load .env
const env = fs.readFileSync('.env', 'utf8').split('\n').filter(Boolean);
env.forEach(l => {
  const [k, v] = l.split('=');
  if (k && v) process.env[k.trim()] = v.trim();
});

const auditor = require('./modules/repo-auditor');
const fetcher = require('./modules/repo-fetcher');
const gen = require('./modules/report-generator');

const LOG = '/tmp/archiview-scan.log';
function log(msg) {
  fs.appendFileSync(LOG, new Date().toISOString().slice(11,19) + ' ' + msg + '\n');
  // Also write to stderr (unbuffered)
  process.stderr.write(msg + '\n');
}

async function run() {
  log('Fetching repo...');
  const data = await fetcher.fetchRepo(
    'https://github.com/nousresearch/hermes-agent',
    { maxFiles: 10 }
  );
  log('Fetched ' + data.files.length + ' files');

  log('Starting audit with Kimi K2.6 for everything...');
  const start = Date.now();
  const result = await auditor.analyzeRepo(data, (step, msg) => log('Progress: ' + step + ' - ' + msg));
  const elapsed = Math.round((Date.now() - start) / 1000);
  log('Audit done in ' + elapsed + 's. Findings: ' + (result.findings?.length || 0));
  log('Scores: ' + JSON.stringify(result.scores));

  const html = gen.generateReport(result);
  fs.writeFileSync('data/reports/nousresearch__hermes-agent.html', html);
  log('Report saved (' + (html.length / 1024).toFixed(0) + 'KB)');
  log('Done.');
}
run().catch(e => {
  log('FAILED: ' + e.message + ' | ' + e.stack?.slice(0,300));
  process.exit(1);
});
