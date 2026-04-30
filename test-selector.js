/**
 * Quick test: call the selector model directly to see what OpenRouter returns.
 */
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').filter(Boolean);
env.forEach(l => { const [k, v] = l.split('='); if (k && v) process.env[k.trim()] = v.trim(); });

const auditor = require('./modules/repo-auditor');
const { extractJSON, callLLM } = auditor;

// Simple test - consistent input every time
const testFindings = [
  { severity: "CRITICAL", category: "security", file: "src/auth.py", title: "Hardcoded API key in source", description: "API key 'sk-xxx' is hardcoded in source", suggestion: "Move to env var" },
  { severity: "WARNING", category: "code_quality", file: "src/utils.py", title: "Unused import", description: "os imported but never used", suggestion: "Remove import" },
  { severity: "WARNING", category: "bug", file: "src/handler.py", title: "Missing null check", description: "req.get('data') could be None", suggestion: "Add if data is None check" },
  { severity: "INFO", category: "docs", file: "README.md", title: "Missing installation docs", description: "No install steps in readme", suggestion: "Add pip install" },
];

const PR_SELECTOR_PROMPT = `You are selecting the BEST single candidate for an automated fix pull request. Choose ONE finding from the list below.

Output ONLY valid JSON:
{"selected": {"finding_index": 0}, "rejected_runner_ups": [], "confidence": "high", "confidence_reasoning": "test"}`;

async function test() {
  const selectorInput = { repo: "test/repo", total_findings: 4, findings: testFindings };

  console.log('Testing with minimax27 (OpenRouter)...');
  try {
    const raw = await callLLM([
      { role: 'system', content: PR_SELECTOR_PROMPT },
      { role: 'user', content: JSON.stringify(selectorInput, null, 2) },
    ], 'minimax27', 0.3, 4096);

    console.log('Raw response length:', raw?.length, '| content:', JSON.stringify(raw).slice(0, 500));
    
    if (!raw || !raw.trim()) {
      console.log('EMPTY RESPONSE');
    } else {
      try {
        const parsed = JSON.parse(extractJSON(raw));
        console.log('Parsed OK:', JSON.stringify(parsed).slice(0, 300));
      } catch(e) {
        console.log('Parse failed:', e.message);
        console.log('Raw dump:', raw.slice(0, 1000));
      }
    }
  } catch(e) {
    console.log('LLM ERROR:', e.message);
  }
}

test().catch(e => console.log('FATAL:', e.message));
