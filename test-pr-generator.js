/**
 * Test script for the dry-run PR generator.
 * Usage: node test-pr-generator.js
 *
 * Runs a quick 10-file audit, then generates a PR dry-run package.
 * Outputs the result to stdout and saves to data/pr-dry-run.json.
 */

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

async function test() {
  const REPO = 'https://github.com/nousresearch/hermes-agent';
  const LOG = '/tmp/archiview-pr-test.log';
  function log(msg) {
    const now = new Date();
    const utc = now.toISOString().replace('T', ' ').slice(0, 19);
    const local = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).replace(',', '');
    const tz = 'EDT';
    const line = `${local} ${tz} | ${msg}`;
    fs.appendFileSync(LOG, `${utc} UTC | ${msg}\n`);
    process.stderr.write(line + '\n');
  }

  log('Fetching repo (10 files)...');
  const data = await fetcher.fetchRepo(REPO, { maxFiles: 10 });

  log('Running audit...');
  const start = Date.now();
  const result = await auditor.analyzeRepo(data, (step, msg) =>
    log('  ' + step + ': ' + msg)
  );
  log('Audit done in ' + Math.round((Date.now() - start) / 1000) + 's. Findings: ' + result.findings.length);

  log('\n=== GENERATING PR DRY RUN ===');
  const prStart = Date.now();
  const prResult = await auditor.generateFixPR(result, 'nousresearch/hermes-agent');
  log('PR generation done in ' + Math.round((Date.now() - prStart) / 1000) + 's');

  // Save full output
  const output = JSON.stringify(prResult, null, 2);
  fs.writeFileSync('data/pr-dry-run.json', output);
  log('Saved to data/pr-dry-run.json (' + (output.length / 1024).toFixed(0) + 'KB)');

  // Print summary to stdout
  if (prResult.dry_run) {
    const dr = prResult.dry_run;
    console.log('\n=== DRY-RUN PR PACKAGE ===');
    console.log('Selected: ' + dr.selected_finding.title + ' (' + dr.selected_finding.severity + ')');
    console.log('File:     ' + dr.selected_finding.file);
    console.log('Patch:    ' + dr.patch.summary);
    console.log('Diff:     ' + dr.patch.diff_summary);
    console.log('Branch:   ' + dr.pr_draft.branch);
    console.log('Full output in data/pr-dry-run.json');
  } else if (prResult.status === 'no_safe_candidate') {
    console.log('\n=== PR GENERATOR — INTENTIONAL NO-OP ===');
    console.log('Status:   ' + prResult.status);
    console.log('Decision: ' + prResult.decision);
    console.log('Audited:  ' + prResult.audited_findings + ' total, ' + prResult.evaluated_count + ' evaluated');
    console.log('Rejected: ' + prResult.explicit_rejection_count + ' by safety gates');
    console.log('\nSafety gates:');
    for (const gate of prResult.safety_gates) {
      console.log('  • ' + gate);
    }
    console.log('\nRejection breakdown:');
    for (const [key, count] of Object.entries(prResult.rejection_summary || {})) {
      if (count > 0) console.log('  - ' + key + ': ' + count);
    }
    console.log('\n' + prResult.human_summary);
    console.log('\nFull output in data/pr-dry-run.json');
  } else {
    console.log(JSON.stringify(prResult, null, 2));
  }
}

test().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
