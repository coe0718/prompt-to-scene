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

const REPO = 'https://github.com/sindresorhus/ky';
const LOG = '/tmp/archiview-success-test.log';
function log(msg) {
  const now = new Date();
  const local = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).replace(',', '');
  console.error(`${local} EDT | ${msg}`);
}

async function run() {
  log('Fetching ky (10 files, source-first mode)...');
  const data = await fetcher.fetchRepo(REPO, { maxFiles: 10, mode: 'source-first' });

  log('Running audit...');
  const start = Date.now();
  const result = await auditor.analyzeRepo(data, (step, msg) =>
    log('  ' + step + ': ' + msg)
  );
  log('Audit done in ' + Math.round((Date.now() - start) / 1000) + 's. Findings: ' + result.findings.length);

  log('\n=== GENERATING PR DRY RUN ===');
  const prStart = Date.now();
  const prResult = await auditor.generateFixPR(result, 'sindresorhus/ky');
  log('PR generation done in ' + Math.round((Date.now() - prStart) / 1000) + 's');

  // Save full output
  const output = JSON.stringify(prResult, null, 2);
  fs.writeFileSync('data/ky-pr-source-first.json', output);
  log('Saved to data/ky-pr-source-first.json (' + (output.length / 1024).toFixed(0) + 'KB)');

  // Print summary
  if (prResult.dry_run) {
    const dr = prResult.dry_run;
    console.log('\n=== DRY-RUN PR PACKAGE (sindresorhus/ky) ===');
    console.log('Selected: ' + dr.selected_finding.title + ' (' + dr.selected_finding.severity + ')');
    console.log('File:     ' + dr.selected_finding.file);
    if (dr.patch) {
      console.log('Rationale: ' + (dr.patch.rationale || '(no rationale)'));
      if (dr.patch.diff_preview) console.log('Diff preview:\n' + dr.patch.diff_preview);
      console.log('Branch:   ' + dr.pr_draft.branch);
      console.log('Validation: ' + JSON.stringify(dr.validation, null, 2));
    } else if (dr.error) {
      console.log('Error:    ' + dr.error);
    }
    console.log('\nFull output in data/ky-pr-source-first.json');
  } else if (prResult.status === 'no_safe_candidate') {
    console.log('\n=== PR GENERATOR — INTENTIONAL NO-OP (sindresorhus/ky) ===');
    console.log('Status:   ' + prResult.status);
    console.log('Decision: ' + prResult.decision);
    console.log('Audited:  ' + prResult.audited_findings + ' total findings');
    console.log('Evaluated: ' + prResult.evaluated_count + ' candidate findings');
    console.log('Rejected: ' + prResult.explicit_rejection_count + ' total safety-gate failures');
    console.log('Selected: ' + prResult.selected_count);
    console.log('\nRejection breakdown:');
    for (const [key, count] of Object.entries(prResult.rejection_summary || {})) {
      if (count > 0) console.log('  - ' + key + ': ' + count);
    }
    console.log('\n' + prResult.human_summary);
    console.log('\nFull output in data/ky-pr-source-first.json');
  } else if (prResult.status === 'fix_generation_failed') {
    console.log('\n=== PR GENERATOR — FIX GENERATION FAILED (sindresorhus/ky) ===');
    console.log('Status:   ' + prResult.status);
    console.log('Reason:   ' + prResult.reason);
    if (prResult.selected_finding) {
      console.log('File:     ' + prResult.selected_finding.file);
      console.log('Finding:  ' + prResult.selected_finding.title);
    }
    if (prResult.raw_output_path) console.log('Raw output: ' + prResult.raw_output_path);
    console.log('\nFull output in data/ky-pr-source-first.json');
  } else {
    console.log('\n' + JSON.stringify(prResult, null, 2));
  }
}

run().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
