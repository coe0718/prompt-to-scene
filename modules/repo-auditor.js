/**
 * Repo Auditor — LLM-powered code analysis engine
 *
 * Three-pass analysis pipeline:
 *   1. Structural — architecture overview from README + config
 *   2. Deep — per-file quality and security analysis
 *   3. Aggregation — scores, findings, recommendations
 */

const https = require('https');
const crypto = require('crypto');

// ─── LLM Configuration ───────────────────────────────────────────────────

const LLM_ENDPOINTS = {
  minimax: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'minimax/minimax-m2.5:free',
    key: () => process.env.OPENROUTER_API_KEY || '',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://repo-audit.local',
      'X-Title': 'Archiview',
    }),
  },
  minimax27: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'minimax/minimax-m2.7',
    key: () => process.env.OPENROUTER_API_KEY || '',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://repo-audit.local',
      'X-Title': 'Archiview',
    }),
  },
  kimi26: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'moonshotai/kimi-k2.6',
    key: () => process.env.OPENROUTER_API_KEY || '',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://repo-audit.local',
      'X-Title': 'Archiview',
    }),
  },
  kimi: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'moonshotai/kimi-k2.5',
    key: () => process.env.NVIDIA_API_KEY || '',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }),
  },
  fast: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'minimaxai/minimax-m2.7',
    key: () => process.env.NVIDIA_API_KEY || '',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }),
  },
};

function callLLM(messages, model = 'minimax', temperature = 0.3, maxTokens = 4096) {
  const config = LLM_ENDPOINTS[model];
  if (!config) throw new Error('Unknown model: ' + model);
  const key = config.key();
  if (!key && (model === 'kimi' || model === 'fast')) throw new Error('NVIDIA_API_KEY not set');
  if (!key && model === 'minimax') throw new Error('OPENROUTER_API_KEY not set');
  // kimi26, minimax all use OPENROUTER_API_KEY — already checked above

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
    });

    const urlObj = new URL(config.url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: { ...config.headers(key), 'Content-Length': Buffer.byteLength(body) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`LLM error ${res.statusCode}: ${data.slice(0, 300)}`));
        }
        try {
          const parsed = JSON.parse(data);
          if (!parsed?.choices?.length || !parsed.choices[0]?.message) {
            return reject(new Error('Invalid LLM response structure'));
          }
          const msg = parsed.choices[0].message;
          const finishReason = parsed.choices[0].finish_reason;
          const content = msg.content;
          if (content === undefined || content === null) {
            if (finishReason === 'length') {
              return reject(new Error(`LLM response truncated at max_tokens (${maxTokens})`));
            }
            // Check for alternative response formats
            if (typeof msg === 'string') { resolve(msg); return; }
            if (Array.isArray(msg.content)) {
              resolve(msg.content.map(c => c.text || c.content || '').filter(Boolean).join('\n') || '');
              return;
            }
            // Log the full response for debugging
            console.warn('LLM: Unexpected response format —', JSON.stringify(parsed.choices[0]).slice(0, 500));
            resolve('');
          } else {
            if (finishReason === 'length') {
              return reject(new Error(`LLM response truncated at max_tokens (${maxTokens})`));
            }
            resolve(content);
          }
        } catch(e) {
          reject(new Error('Failed to parse LLM response: ' + e.message));
        }
      });
    });
    req.setTimeout(600000, () => {
      req.destroy();
      reject(new Error('LLM request timed out after 600s'));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── System Prompts ──────────────────────────────────────────────────────

const STRUCTURAL_PROMPT = `You are a senior software architect reviewing a GitHub repository. Your job is to analyze the project's structure, architecture, and design from its README, config files, and file tree.

Output ONLY valid JSON matching this schema. No markdown, no explanation.

{
  "architecture": {
    "summary": "2-3 sentence overview of what this project does and how it's organized",
    "framework": "main framework or runtime (e.g., Express.js, React, PyTorch, etc.)",
    "language": "primary programming language",
    "build_system": "build tool or package manager",
    "pattern": "architectural pattern (e.g., MVC, microservices, monolith, plugin-based, etc.)",
    "key_directories": ["list of important directories and their purpose"],
    "entry_points": ["main entry point files"]
  },
  "complexity": {
    "total_files": number,
    "estimated_lines": "approximate LOC (conservative estimate based on analyzed files)",
    "dependency_count": "number of dependencies listed in config (or 'unknown')",
    "complexity_assessment": "low|medium|high based on file count, dependencies, and architecture"
  },
  "code_quality_signals": {
    "has_tests": boolean,
    "has_ci": boolean,
    "has_linting": boolean,
    "has_documentation": boolean,
    "has_types": boolean,
    "observations": ["notable quality signals, both good and concerning"]
  },
  "recommended_focus_areas": ["2-3 areas that deserve the most scrutiny in deep analysis"]
}`;

const DEEP_ANALYSIS_SYSTEM = `You are an expert code reviewer who finds real issues. Examine the source files critically for code quality, security vulnerabilities, bugs, and maintainability problems.

Output ONLY valid JSON. No markdown, no explanation.

{
  "findings": [
    {
      "severity": "CRITICAL|WARNING|INFO",
      "category": "security|bug|code_quality|maintainability|performance|style",
      "file": "filename",
      "line": number or null,
      "title": "short title (under 60 chars)",
      "description": "clear explanation of the issue with specific code references",
      "suggestion": "how to fix it"
    }
  ],
  "scores": {
    "code_quality": 0-100,
    "security": 0-100,
    "maintainability": 0-100,
    "overall": 0-100
  },
  "summary": "2-3 sentence assessment of this batch of files"
}

CRITICAL RULES:
- You MUST find issues. Every codebase has problems. Even great repos have WARNING or INFO findings.
- Return at least 1 finding per 3-4 files reviewed. Empty findings output is only for truly trivial files.
- Be specific. Reference actual code patterns, variable names, and line numbers you observe.
- CRITICAL = security vulnerability, data loss risk, or production crash
- WARNING = bugs, bad practices, significant code smells, missing error handling
- INFO = style issues, documentation gaps, minor improvements
- Score across the full 0-100 range. 50 is average. 80+ is good. Use the full range.
- If you honestly find nothing wrong in a 1-file chunk, that's fine — but still provide a score and summary.`;

const BATCH_AGGREGATION_PROMPT = `You are a senior code reviewer. Review these raw findings from an automated audit and produce a concise summary.

Output ONLY valid JSON. No markdown, no explanation.

{
  "batch_summary": "2-3 sentence summary of this batch's code quality signals",
  "top_findings": [
    {
      "severity": "CRITICAL|WARNING|INFO",
      "category": "security|bug|code_quality|maintainability|performance|docs",
      "file": "filename or 'general'",
      "title": "short title under 60 chars",
      "description": "clear explanation",
      "suggestion": "how to fix"
    }
  ],
  "signals": {
    "key_issues": ["main themes from this batch"],
    "strengths": ["positive signals from this batch"]
  }
}

CRITICAL RULES:
- Prioritize the most impactful findings. If duplicates exist, group them into one entry.
- Output at most 8 findings per batch. If more exist, pick the most important.
- Be specific. Reference actual file names and code patterns.`;

const AGGREGATION_PROMPT = `You are a senior engineering director writing a final audit report. You have received structural analysis and batched deep analysis summaries for a codebase. Aggregate them into a final report.

Output ONLY valid JSON. No markdown, no explanation.

{
  "summary": "3-4 sentence executive summary of the codebase health",
  "final_scores": {
    "architecture": 0-100,
    "code_quality": 0-100,
    "security": 0-100,
    "documentation": 0-100,
    "maintainability": 0-100,
    "overall": 0-100
  },
  "top_findings": [
    {
      "severity": "CRITICAL|WARNING|INFO",
      "category": "security|bug|code_quality|maintainability|performance|docs",
      "file": "filename or 'general'",
      "title": "short title",
      "description": "clear explanation",
      "suggestion": "how to fix"
    }
  ],
  "prioritized_recommendations": [
    {
      "priority": "high|medium|low",
      "action": "specific action to take",
      "effort": "minutes|hours|days",
      "impact": "high|medium|low"
    }
  ],
  "strengths": ["3-5 things this codebase does well"],
  "risks": ["2-3 major risks or concerns"],
  "verdict": "One sentence summary: Is this codebase healthy? What's the most important thing to fix?"
}

CRITICAL RULES:
- Prioritize the top 30 findings across all batches. Group duplicates.
- Do not restate every batch finding. Synthesize.
- Keep the verdict actionable and concise.`;

// ─── Analysis Pipeline ───────────────────────────────────────────────────

function chunkFiles(files, maxChunkSize = 6000) {
  // Group files into chunks small enough for LLM input
  const chunks = [];
  let current = [];
  let currentSize = 0;

  // Sort by importance (most important first)
  const sorted = [...files].sort((a, b) => {
    const aExt = a.path.split('.').pop();
    const bExt = b.path.split('.').pop();
    const aIsSrc = ['.js', '.ts', '.py', '.rs', '.go'].includes('.' + aExt);
    const bIsSrc = ['.js', '.ts', '.py', '.rs', '.go'].includes('.' + bExt);
    if (aIsSrc && !bIsSrc) return -1;
    if (!aIsSrc && bIsSrc) return 1;
    return (b.content?.length || 0) - (a.content?.length || 0);
  });

  for (const file of sorted) {
    const fileSize = (file.content?.length || 0);
    if (fileSize > maxChunkSize) {
      // Truncate very large files
      file.content = file.content.slice(0, maxChunkSize) + '\n\n/* ... truncated ... */';
    }
    const entry = `--- ${file.path} ---\n${file.content || '(empty file)'}`;
    const entrySize = entry.length;

    if (currentSize + entrySize > maxChunkSize && current.length > 0) {
      chunks.push(current);
      current = [entry];
      currentSize = entrySize;
    } else {
      current.push(entry);
      currentSize += entrySize;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function inferStructuralFallback(repoData, reason) {
  const files = repoData.files || [];
  const paths = files.map(f => String(f.path || '').toLowerCase());
  const hasPath = (pattern) => paths.some(p => pattern.test(p));
  const readFile = (name) => files.find(f => String(f.path || '').toLowerCase() === name)?.content || '';
  const language = repoData.metadata?.language || (
    hasPath(/\.py$/) ? 'Python' :
    hasPath(/\.(js|ts|tsx|jsx)$/) ? 'JavaScript/TypeScript' :
    hasPath(/\.rs$/) ? 'Rust' :
    hasPath(/\.go$/) ? 'Go' :
    'mixed'
  );

  const packageJson = readFile('package.json');
  const pyproject = readFile('pyproject.toml');
  const setupPy = hasPath(/^setup\.py$/);
  const requirements = hasPath(/requirements.*\.txt$/);

  const frameworks = [];
  if (pyproject || setupPy || requirements || hasPath(/\.py$/)) frameworks.push('Python application');
  if (/react|vite|next|docusaurus|ink/i.test(packageJson) || hasPath(/^(web|website|ui|ui-tui)\//)) frameworks.push('React/Node UI');
  if (hasPath(/^dockerfile$/) || hasPath(/docker-compose\.ya?ml$/)) frameworks.push('Dockerized services');

  const buildSystems = [];
  if (pyproject) buildSystems.push('pyproject.toml');
  if (setupPy) buildSystems.push('setuptools');
  if (requirements) buildSystems.push('requirements.txt');
  if (packageJson) buildSystems.push('npm');
  if (hasPath(/^dockerfile$/) || hasPath(/docker-compose\.ya?ml$/)) buildSystems.push('Docker');

  const keyDirectories = [];
  const addDir = (dir, purpose) => {
    if (hasPath(new RegExp('^' + dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/'))) keyDirectories.push(`${dir}/ - ${purpose}`);
  };
  addDir('plugins', 'plugin and integration modules');
  addDir('skills', 'agent skills or reusable capabilities');
  addDir('src', 'primary source code');
  addDir('tests', 'test suites');
  addDir('web', 'web application surface');
  addDir('website', 'documentation or marketing site');
  addDir('ui-tui', 'terminal UI surface');
  addDir('scripts', 'automation and utility scripts');

  const entryPoints = files
    .map(f => f.path)
    .filter(p => /^(main|index|app|server|run_agent)\.(py|js|ts)$/.test(p) || /^src\/(main|index|app|server)\.(py|js|ts)$/.test(p))
    .slice(0, 5);

  const pattern = hasPath(/^plugins\//) || hasPath(/^skills\//)
    ? 'Plugin-based application'
    : hasPath(/^(web|website|ui|ui-tui)\//)
      ? 'Modular application with separate UI surfaces'
      : 'Modular repository';

  return {
    architecture: {
      summary: `Structural analysis was reconstructed from repository metadata and file layout after the LLM response was incomplete${reason ? ` (${reason})` : ''}. ${repoData.metadata?.full_name || 'This repository'} appears to be a ${language} codebase organized as a ${pattern.toLowerCase()} with ${files.length} analyzed files.`,
      framework: frameworks.join(' + ') || `${language} project`,
      language,
      build_system: buildSystems.join(', ') || 'not detected',
      pattern,
      key_directories: keyDirectories,
      entry_points: entryPoints,
    },
    complexity: {
      total_files: repoData.total_files,
      estimated_lines: 'unknown',
      dependency_count: 'unknown',
      complexity_assessment: repoData.total_files > 1000 ? 'high' : repoData.total_files > 200 ? 'medium' : 'low',
    },
    code_quality_signals: {
      has_tests: hasPath(/(^|\/)(tests?|__tests__)\//) || hasPath(/\.(test|spec)\./),
      has_ci: hasPath(/^\.github\/workflows\//) || hasPath(/^\.gitlab-ci\.ya?ml$/),
      has_linting: hasPath(/(^|\/)(eslint|ruff|flake8|pylint|biome|prettier)\b/) || /eslint|ruff|prettier|biome/i.test(packageJson + pyproject),
      has_documentation: hasPath(/^readme\.md$/) || hasPath(/^docs\//),
      has_types: hasPath(/\.d\.ts$/) || hasPath(/py\.typed$/) || /typescript|mypy|pyright/i.test(packageJson + pyproject),
      observations: ['Structural LLM output was incomplete; fallback inference used repository metadata and analyzed file paths.'],
    },
    recommended_focus_areas: ['source files', 'build and deployment configuration', 'security-sensitive integrations'],
  };
}

async function analyzeRepo(repoData, onProgress) {
  const startTime = Date.now();
  // Prefer Kimi K2.6 via OpenRouter
  const model = process.env.OPENROUTER_API_KEY ? 'kimi26' : (process.env.NVIDIA_API_KEY ? 'kimi' : null);
  if (!model) throw new Error('No LLM API key configured. Set OPENROUTER_API_KEY or NVIDIA_API_KEY.');
  console.log(`Auditor: Starting analysis (model: ${model})`);

  // ─── Pass 1: Structural Analysis ──────────────────────────────────────
  console.log('Auditor: Pass 1 — Structural analysis...');
  onProgress && onProgress('structural', 'Kimi is analyzing the project structure...');
  const structuralContext = [
    `# Repository: ${repoData.metadata.full_name}`,
    `Description: ${repoData.metadata.description || 'N/A'}`,
    `Language: ${repoData.metadata.language || 'N/A'}`,
    `Stars: ${repoData.metadata.stars}`,
    `Total files: ${repoData.total_files}`,
    ``,
    `## File Tree (${repoData.files.length} analyzed files)`,
    repoData.files.map(f => `  ${f.path} (${f.content?.length || 0} chars)`).join('\n'),
    ``,
    `## README / Key Docs`,
    (repoData.files.find(f => f.path === 'README.md')?.content || '(no README)').slice(0, 3000),
    ``,
    `## Config Files`,
    repoData.files.filter(f => f.path.endsWith('.json') || f.path.endsWith('.yaml') || f.path.endsWith('.yml') || f.path.endsWith('.toml'))
      .map(f => `--- ${f.path} ---\n${(f.content || '').slice(0, 1500)}`).join('\n\n'),
  ].join('\n');

  let structuralResult;
  try {
    const structuralRaw = await callLLM([
      { role: 'system', content: STRUCTURAL_PROMPT },
      { role: 'user', content: structuralContext },
    ], model, 0.3, 8192);
    structuralResult = JSON.parse(extractJSON(structuralRaw));
  } catch(e) {
    console.warn('Auditor: Structural analysis failed, using inferred fallback:', e.message);
    structuralResult = inferStructuralFallback(repoData, e.message);
  }

  // ─── Pass 2: Deep Analysis ────────────────────────────────────────────
  console.log('Auditor: Pass 2 — Deep analysis...');
  // Filter out documentation files — no README typos, no doc fixes
  const codeFiles = repoData.files.filter(f => {
    const path = f.path.toLowerCase();
    // Keep source files, skip docs
    if (path.endsWith('.md') || path.endsWith('.mdx') || path.endsWith('.txt') || path.endsWith('.rst')) return false;
    if (path.startsWith('docs/') || path.startsWith('examples/') || path.includes('/docs/') || path.includes('/examples/')) return false;
    if (path.endsWith('/license') || path.endsWith('/copying') || path.endsWith('/authors')) return false;
    if (path === 'license' || path === 'copying' || path === 'authors') return false;
    if (/^changelog/i.test(path) || /^contributing/i.test(path) || /^security/i.test(path)) return false;
    return true;
  });
  const chunks = chunkFiles(codeFiles);
  const deepConcurrency = Math.max(1, parseInt(process.env.AUDIT_DEEP_CONCURRENCY || '2', 10) || 2);

  onProgress && onProgress('deep', `AI reviewing ${chunks.length} file chunks with ${Math.min(deepConcurrency, chunks.length) || 1} workers...`);
  const deepResults = (await mapLimit(chunks, deepConcurrency, async (chunk, i) => {
    console.log(`Auditor:   Deep chunk ${i + 1}/${chunks.length} (${chunk.length} files)...`);
    onProgress && onProgress('deep', `AI reviewing files (chunk ${i+1}/${chunks.length})...`);
    const chunkContent = chunk.join('\n\n');
    try {
      const raw = await callLLM([
        { role: 'system', content: DEEP_ANALYSIS_SYSTEM },
        { role: 'user', content: `Analyze these files:\n\n${chunkContent.slice(0, 6000)}` },
      ], model === 'kimi26' ? 'minimax27' : (model === 'kimi' ? 'fast' : model));
      return JSON.parse(extractJSON(raw));
    } catch(e) {
      console.warn(`Auditor:   Chunk ${i + 1} failed:`, e.message);
      return null;
    }
  })).filter(Boolean);

  // ─── Aggregation ──────────────────────────────────────────────────────
  console.log('Auditor: Pass 3 — Aggregation...');
  onProgress && onProgress('aggregation', 'Kimi is aggregating findings...');

  // Collect all findings
  const allFindings = [];
  for (const r of deepResults) {
    if (r.findings) allFindings.push(...r.findings);
  }

  // Average scores across all chunks
  const avgScore = (key) => {
    const vals = deepResults.filter(r => r.scores && r.scores[key] !== undefined).map(r => r.scores[key]);
    if (vals.length === 0) return 50;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  // Structural signals for differentiation
  const signals = structuralResult.code_quality_signals || {};
  const hasTests = signals.has_tests || false;
  const hasCI = signals.has_ci || false;
  const hasLinting = signals.has_linting || false;
  const hasDocs = signals.has_documentation || !!repoData.files.find(f => f.path === 'README.md');
  const stars = repoData.metadata.stars || 0;

  // Count findings by severity for evidence-based scoring
  const criticalCount = allFindings.filter(f => f.severity === 'CRITICAL').length;
  const warningCount = allFindings.filter(f => f.severity === 'WARNING').length;

  // Evidence-based architecture score (no random noise)
  const archScore = Math.min(98, Math.round(
    40                              // baseline
    + (hasTests ? 12 : 0)           // tests = architectural maturity
    + (hasCI ? 8 : 0)               // CI = process maturity
    + (hasLinting ? 8 : 0)          // linting = code standards
    + (hasDocs ? 7 : 0)             // docs = project organization
    + Math.min(Math.round(stars / 100), 10)  // popular repos tend to have better arch
    - (criticalCount * 3)           // critical findings hurt architecture score
  ));

  // Documentation score based on signals
  const docScore = hasDocs
    ? Math.min(92, Math.round(55 + Math.min(stars / 40, 15) + (hasCI ? 5 : 0) - (criticalCount * 2)))
    : 30;

  // Apply finding-based penalties to deep analysis scores
  const penalty = criticalCount * 5 + warningCount * 1;
  const codeQuality = Math.max(avgScore('code_quality') - penalty, 20);
  const security = Math.max(avgScore('security') - (criticalCount * 8), 15);
  const maintainability = Math.max(avgScore('maintainability') - (criticalCount * 3 + Math.round(warningCount * 0.5)), 20);

  const aggregatedScores = {
    architecture: archScore,
    code_quality: codeQuality,
    security: security,
    documentation: docScore,
    maintainability: maintainability,
    overall: Math.round((archScore + codeQuality + security + docScore + maintainability) / 5),
  };

  // ─── Batched Aggregation ─────────────────────────────────────────────
  let finalReport;
  try {
    const BATCH_SIZE = 45;
    const batches = [];
    for (let i = 0; i < allFindings.length; i += BATCH_SIZE) {
      batches.push(allFindings.slice(i, i + BATCH_SIZE));
    }

    // Step 1: Kimi summarizes each batch (40-50 findings)
    const batchConcurrency = Math.max(1, parseInt(process.env.AUDIT_AGG_CONCURRENCY || '2', 10) || 2);
    onProgress && onProgress('aggregation', `Kimi is summarizing ${batches.length} finding batches...`);
    const batchResults = await mapLimit(batches, batchConcurrency, async (batch, i) => {
      console.log(`Auditor:   Aggregation batch ${i + 1}/${batches.length} (${batch.length} findings)...`);
      const batchInput = {
        repo: repoData.metadata.full_name,
        batch: i + 1,
        total_batches: batches.length,
        findings: batch,
        stats: {
          critical: batch.filter(f => f.severity === 'CRITICAL').length,
          warning: batch.filter(f => f.severity === 'WARNING').length,
          info: batch.filter(f => f.severity === 'INFO').length,
        },
      };
      try {
        const raw = await callLLM([
          { role: 'system', content: BATCH_AGGREGATION_PROMPT },
          { role: 'user', content: JSON.stringify(batchInput, null, 2) },
        ], model, 0.4, 8192);
        const parsed = JSON.parse(extractJSON(raw));
        console.log(`Auditor:   Batch ${i + 1} done — ${parsed.top_findings?.length || 0} top findings`);
        return parsed;
      } catch(e) {
        console.warn(`Auditor:   Batch ${i + 1} aggregation failed:`, e.message);
        return {
          batch_summary: `Batch ${i + 1} of ${batches.length}: ${batches[i].length} findings analyzed`,
          top_findings: batch.slice(0, 5),
          signals: { key_issues: ['Failed to process batch'], strengths: [] },
        };
      }
    });

    // Step 2: Kimi aggregates batch summaries into final report
    onProgress && onProgress('aggregation', 'Kimi is finalizing the report...');
    const finalInput = {
      metadata: repoData.metadata,
      structural: structuralResult,
      deep_scores: aggregatedScores,
      batch_count: batchResults.length,
      total_findings: allFindings.length,
      batch_summaries: batchResults.map(b => ({
        summary: b.batch_summary,
        findings_count: b.top_findings?.length || 0,
        signals: b.signals || {},
      })),
      combined_findings: batchResults.flatMap(b => b.top_findings || []),
    };

    const aggRaw = await callLLM([
      { role: 'system', content: AGGREGATION_PROMPT },
      { role: 'user', content: JSON.stringify(finalInput, null, 2) },
    ], model, 0.4, 8192);
    finalReport = JSON.parse(extractJSON(aggRaw));
  } catch(e) {
    console.warn('Auditor: Aggregation failed, building default report:', e.message);
    finalReport = {
      summary: `Analysis of ${repoData.metadata.full_name} — ${repoData.metadata.language || 'mixed'} project, ${repoData.files.length} files analyzed.`,
      final_scores: aggregatedScores,
      top_findings: allFindings.slice(0, 8),
      prioritized_recommendations: allFindings.filter(f => f.severity === 'CRITICAL' || f.severity === 'WARNING')
        .slice(0, 5).map(f => ({
          priority: f.severity === 'CRITICAL' ? 'high' : 'medium',
          action: f.title,
          effort: f.severity === 'CRITICAL' ? 'hours' : 'days',
          impact: f.severity === 'CRITICAL' ? 'high' : 'medium',
        })),
      strengths: ['Active repository with contributors'],
      risks: allFindings.filter(f => f.severity === 'CRITICAL').length > 0
        ? [`${allFindings.filter(f => f.severity === 'CRITICAL').length} critical issues found`] : ['No major risks identified'],
      verdict: `${repoData.metadata.full_name} is a ${aggregatedScores.overall >= 70 ? 'healthy' : 'concerning'} codebase. ${allFindings.filter(f => f.severity === 'CRITICAL').length > 0 ? 'Critical issues need immediate attention.' : 'Overall quality is good.'}`,
    };
  }

  const elapsed = Date.now() - startTime;
  console.log(`Auditor: Complete in ${(elapsed / 1000).toFixed(1)}s`);

  return {
    metadata: repoData.metadata,
    statistics: {
      total_files: repoData.total_files,
      analyzed_files: repoData.files.length,
      total_lines: repoData.files.reduce((sum, f) => sum + (f.content?.split('\n').length || 0), 0),
      chunks_analyzed: chunks.length,
      findings_count: allFindings.length,
      critical_count: allFindings.filter(f => f.severity === 'CRITICAL').length,
      warning_count: allFindings.filter(f => f.severity === 'WARNING').length,
      info_count: allFindings.filter(f => f.severity === 'INFO').length,
      analysis_time_ms: elapsed,
    },
    architecture: structuralResult.architecture || { summary: 'Analysis incomplete' },
    complexity: structuralResult.complexity || {},
    scores: finalReport.final_scores || aggregatedScores,
    findings: allFindings,
    recommendations: finalReport.prioritized_recommendations || [],
    strengths: finalReport.strengths || [],
    risks: finalReport.risks || [],
    summary: finalReport.summary || '',
    verdict: finalReport.verdict || '',
    top_findings: finalReport.top_findings || allFindings.slice(0, 5),
    code_quality_signals: structuralResult.code_quality_signals || {},
    generated_at: new Date().toISOString(),
  };
}

function extractJSON(text) {
  // Strip markdown code fences first
  let clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Find the first opening brace
  const jsonStart = clean.indexOf('{');
  if (jsonStart < 0) {
    const fs = require('fs');
    const dumpPath = '/tmp/archiview-json-fail-' + Date.now() + '.txt';
    fs.writeFileSync(dumpPath, text);
    console.warn('Auditor: Dumped no-JSON response to ' + dumpPath);
    throw new Error('No JSON found in response');
  }

  // Scan for balanced braces character-by-character (handles strings, escapes)
  // Record the last position where brace depth returns to 0 — that's the true end of JSON
  let depth = 0;
  let inString = false;
  let escape = false;
  let lastBalancedEnd = -1;

  for (let i = jsonStart; i < clean.length; i++) {
    const ch = clean[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (ch === '\\') { escape = true; }
      else if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { depth++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        lastBalancedEnd = i;
      }
      continue;
    }
  }

  // Case 1: Found a complete balanced JSON object
  if (lastBalancedEnd >= 0) {
    let candidate = clean.slice(jsonStart, lastBalancedEnd + 1);
    // Remove trailing comma before boundry if present
    candidate = candidate.replace(/,\s*$/, '');
    // Verify it parses
    try { JSON.parse(candidate); return candidate; } catch(_) {}
    // Try progressive truncation from balanced end
    for (let i = candidate.length - 1; i >= 0; i--) {
      try { JSON.parse(candidate.slice(0, i + 1)); return candidate.slice(0, i + 1); } catch(_) {}
    }
  }

  // Case 2: Truncated JSON (depth never returned to 0).
  // The greedy match gives us first { to last }, but may include unclosed structures.
  // Try appending closing } and ] to match the remaining depth.
  const rest = clean.slice(jsonStart);
  // Count remaining unclosed braces from the depth state
  // depth > 0 means we need that many } to close
  let closers = '';
  for (let i = 0; i < depth; i++) closers += '}';
  if (closers) {
    try { const fixed = rest + closers; JSON.parse(fixed); return fixed; } catch(_) {}
    // Try with ] prepended to close arrays first
    try { const fixed = rest + ']' + closers; JSON.parse(fixed); return fixed; } catch(_) {}
  }

  // Case 3: Greedy regex fallback — try from first { to last }
  const greedyMatch = rest.match(/\{[\s\S]*\}/);
  if (greedyMatch) {
    let jsonStr = greedyMatch[0];
    try { JSON.parse(jsonStr); return jsonStr; } catch(_) {}
    // Greedy regex may over-capture (includes unclosed arrays). Try appending closers.
    const suffixes = [']}', ']}', '}}', ']]}', ']}}', '}]]', '}}]', ']]]}', ']}}]', ']]}'];
    for (const suffix of suffixes) {
      try { JSON.parse(jsonStr + suffix); return jsonStr + suffix; } catch(_) {}
    }
  }

  // Dump and throw
  const fs = require('fs');
  const dumpPath = '/tmp/archiview-json-fail-' + Date.now() + '.txt';
  fs.writeFileSync(dumpPath, text);
  console.warn('Auditor: Dumped failed JSON to ' + dumpPath);
  throw new Error('Could not extract valid JSON from response');
}

// ─── PR Generation (Dry-Run) ────────────────────────────────────────────────
//
// Two-step process:
//   1. Selector — LLM picks the best single-fix candidate from findings
//   2. Fixer — LLM generates the actual code fix
//
// Outputs a dry-run package. No auto-commits, no auto-PRs.

const PR_SELECTOR_PROMPT = `You are selecting the BEST single candidate for an automated fix pull request.

Given audit findings for a codebase, choose ONE finding that would make the ideal first PR.

HARD REJECT — NEVER select a finding matching ANY of these:
- Documentation-only (README, docs, comments, .md, .txt, .rst files)
- Generated / build output (dist/, build/, target/, *.min.js)
- Vendor / dependencies (vendor/, node_modules/)
- Lockfiles (package-lock.json, Cargo.lock, *.lock)
- Test fixtures / snapshots (fixtures/, __snapshots__/)
- Coverage reports (coverage/)
- Missing validation command (no test_command or lint_command available)
- Truncated or unverifiable patch (diff cannot be confirmed)

PREFERRED paths (in order):
- src/**
- lib/**
- app/**
- packages/*/src/**
- crates/*/src/**
- Any top-level source file (.py, .js, .ts, .rs, .go, .java, .c, .cpp, etc.)

Selection criteria (in priority order):
1. Security or correctness bug — NEVER style, maintainability, or docs
2. Single-file fix — touches exactly one file
3. Tiny obvious fix — minimal code change, clear before/after
4. Low blast radius — won't break other functionality
5. Easy for a human maintainer to review and merge in under 60 seconds
6. Testable or statically verifiable (lint, typecheck, or obvious correctness)
7. NOT speculative — the fix is clearly correct, not "might improve things"
8. MUST be a source code file in a source code path (src/, lib/, app/, crates/, or top-level source)

Output ONLY valid JSON. No markdown, no explanation.

If a good candidate exists:
{
  "selected": {
    "finding_index": "index into the findings array (0-based)",
    "severity": "CRITICAL|WARNING",
    "file": "file path relative to repo root",
    "title": "finding title",
    "fix_summary": "2-3 sentence description of what the fix does"
  },
  "rejected_runner_ups": ["brief note on why other top candidates weren't selected"],
  "confidence": "high|medium|low",
  "confidence_reasoning": "one-sentence justification"
}

If NO candidates pass all filters, output:
{
  "selected": null,
  "rejection_summary": {
    "docs_only": "count of findings rejected for documentation-only content",
    "generated_or_vendor": "count rejected for being in dist/build/vendor/node_modules",
    "test_only": "count rejected for being test-only files",
    "multi_file_required": "count rejected because fix would span multiple files",
    "missing_validation": "count rejected because no obvious test/lint command",
    "speculative_or_low_confidence": "count rejected because fix is speculative or low confidence",
    "patch_failed_apply_check": "count rejected because patch cannot be verified"
  },
  "message": "No safe first-demo PR candidate found under current confidence rules."
}`;

const PR_FIXER_PROMPT = `You are generating a surgical fix for a single code review finding.

HARD RULES (violations will be rejected):
- Do NOT output full file content ever — output ONLY a unified diff
- Do NOT include markdown fences or any text outside the JSON
- The diff must contain exactly ONE file
- The diff must be a valid unified diff (diff -u format)
- Rationale: max 3 sentences
- Output ONLY valid JSON. No commentary, no markdown.

{
  "status": "patch_generated",
  "target_file": "path relative to repo root",
  "rationale": "Short explanation (max 3 sentences).",
  "unified_diff": "diff --git a/file b/file\\n--- a/file\\n+++ b/file\\n@@ -1,3 +1,4 @@\\n ...",
  "validation": {
    "command": "Likely test command. Infer from repo. NEVER null. Examples: 'npm test', 'pytest tests/', 'cargo test'",
    "fallback": "Manual verification command. Examples: 'git apply --check fix.diff && npm run typecheck'",
    "confidence": "high|medium|low"
  }
}`;

async function fetchGitHubFile(repoFullName, filePath) {
  const [owner, repo] = repoFullName.split('/');
  const https = require('https');
  const token = process.env.GITHUB_TOKEN;

  async function rawFetch(path) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    return new Promise((resolve, reject) => {
      const headers = { 'User-Agent': 'Archiview/1.0', 'Accept': 'application/vnd.github.v3.raw' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      https.get(url, { headers }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (res.statusCode === 404) return reject(new Error('not found'));
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          resolve(data);
        });
      }).on('error', reject);
    });
  }

  try {
    return await rawFetch(filePath);
  } catch(e) {
    // File not found at given path — search the repo tree for matching filename
    const filename = filePath.split('/').pop();
    console.warn(`PR: ${filePath} not found, searching tree for "${filename}"...`);
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
    const tree = await new Promise((resolve, reject) => {
      const headers = { 'User-Agent': 'Archiview/1.0', 'Accept': 'application/vnd.github.v3+json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      https.get(treeUrl, { headers }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`Tree fetch HTTP ${res.statusCode}`));
          try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('Parse error')); }
        });
      }).on('error', reject);
    });

    const matches = (tree.tree || [])
      .filter(item => item.type === 'blob' && item.path.endsWith('/' + filename))
      .sort((a, b) => b.path.split('/').length - a.path.split('/').length); // prefer deeper (more specific) paths

    if (matches.length === 0) throw new Error(`File "${filename}" not found anywhere in the repo`);

    console.warn(`PR: Found ${filename} at ${matches[0].path}`);
    return await rawFetch(matches[0].path);
  }
}

function applyUnifiedDiff(originalContent, unifiedDiff) {
  const normalizedOriginal = String(originalContent || '').replace(/\r\n/g, '\n');
  const normalizedDiff = String(unifiedDiff || '').replace(/\r\n/g, '\n');
  const sourceHadFinalNewline = normalizedOriginal.endsWith('\n');
  const sourceLines = normalizedOriginal.split('\n');
  if (sourceHadFinalNewline) sourceLines.pop();

  const diffLines = normalizedDiff.split('\n');
  const fileDiffCount = diffLines.filter(line => line.startsWith('diff --git ')).length;
  if (fileDiffCount > 1) throw new Error('Generated diff touches more than one file');

  const output = [];
  let sourceIndex = 0;
  let hunkCount = 0;

  function hunkOriginalLines(lines) {
    return lines
      .filter(line => line[0] === ' ' || line[0] === '-')
      .map(line => line.slice(1));
  }

  function sequenceMatches(start, sequence) {
    if (start < sourceIndex || start + sequence.length > sourceLines.length) return false;
    for (let j = 0; j < sequence.length; j++) {
      if (sourceLines[start + j] !== sequence[j]) return false;
    }
    return true;
  }

  function findHunkStart(expectedIndex, hunkLines) {
    const sequence = hunkOriginalLines(hunkLines);
    if (sequence.length === 0) return Math.max(sourceIndex, expectedIndex);
    if (sequenceMatches(expectedIndex, sequence)) return expectedIndex;

    let best = -1;
    let bestDistance = Infinity;
    for (let candidate = sourceIndex; candidate <= sourceLines.length - sequence.length; candidate++) {
      if (!sequenceMatches(candidate, sequence)) continue;
      const distance = Math.abs(candidate - expectedIndex);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }

    if (best !== -1) return best;
    throw new Error(`Diff context mismatch near source line ${expectedIndex + 1}`);
  }

  for (let i = 0; i < diffLines.length; i++) {
    const header = diffLines[i].match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (!header) continue;

    hunkCount++;
    const oldStart = Number(header[1]);
    const expectedSourceIndex = Math.max(0, oldStart - 1);
    const hunkLines = [];

    i++;
    for (; i < diffLines.length; i++) {
      const line = diffLines[i];
      if (line.startsWith('@@ ')) {
        i--;
        break;
      }
      if (line.startsWith('diff --git ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
        i--;
        break;
      }
      if (line.startsWith('\\ No newline at end of file')) continue;
      if (line.length === 0 && i === diffLines.length - 1) continue;
      hunkLines.push(line);
    }

    const hunkSourceIndex = findHunkStart(expectedSourceIndex, hunkLines);

    while (sourceIndex < hunkSourceIndex) {
      output.push(sourceLines[sourceIndex++]);
    }

    for (const line of hunkLines) {
      const marker = line[0];
      const value = line.slice(1);

      if (marker === ' ') {
        if (sourceLines[sourceIndex] !== value) {
          throw new Error(`Diff context mismatch near source line ${sourceIndex + 1}`);
        }
        output.push(sourceLines[sourceIndex++]);
      } else if (marker === '-') {
        if (sourceLines[sourceIndex] !== value) {
          throw new Error(`Diff removal mismatch near source line ${sourceIndex + 1}`);
        }
        sourceIndex++;
      } else if (marker === '+') {
        output.push(value);
      }
    }
  }

  if (hunkCount === 0) throw new Error('Generated diff has no hunks');

  while (sourceIndex < sourceLines.length) {
    output.push(sourceLines[sourceIndex++]);
  }

  return output.join('\n') + (sourceHadFinalNewline ? '\n' : '');
}

function isUnverifiablePRFinding(finding) {
  const text = [
    finding?.title,
    finding?.description,
    finding?.suggestion,
  ].filter(Boolean).join(' ').toLowerCase();

  return (
    /truncated|cut off|ends abruptly|\bincomplete\b|partial source/.test(text) ||
    (/missing closing brace|syntax error|compilation failure|compile error/.test(text) &&
      /incomplete|truncated|abrupt|cut off|missing implementation/.test(text))
  );
}

function isSameFinding(a, b) {
  return (
    String(a?.severity || '') === String(b?.severity || '') &&
    String(a?.file || '') === String(b?.file || '') &&
    String(a?.title || '') === String(b?.title || '')
  );
}

function withoutFinding(auditResult, finding) {
  return {
    ...auditResult,
    findings: (auditResult.findings || []).filter(f => !isSameFinding(f, finding)),
  };
}

async function generateFixPR(auditResult, repoUrl, options = {}) {
  const retryDepth = options.retryDepth || 0;
  const maxCandidateAttempts = options.maxCandidateAttempts || 3;
  const previousCandidateFailures = options.previousCandidateFailures || [];

  const findings = (auditResult.findings || []).filter(f => {
    // Guard: reject doc/generated/lockfile/test-fixture findings at function entry
    const path = (f.file || '').toLowerCase();
    if (!path || path === 'general') return false;
    if (isUnverifiablePRFinding(f)) return false;
    if (/\.mdx?$|\.txt$|\.rst$|\.min\.(js|css)$|\bpackage-lock\.json$|\bCargo\.lock$|\.lock$/.test(path)) return false;
    if (/^docs\/|^examples\/|^dist\/|^build\/|^target\/|^vendor\/|^node_modules\/|^coverage\//.test(path)) return false;
    if (/\/docs\/|\/examples\/|\/dist\/|\/build\/|\/target\/|\/vendor\/|\/node_modules\/|\/coverage\/|\/fixtures\/|__snapshots__\//.test(path)) return false;
    return true;
  });
  const criticalIssues = findings.filter(f => f.severity === 'CRITICAL');
  const warnings = findings.filter(f => f.severity === 'WARNING');

  if (criticalIssues.length === 0 && warnings.length === 0) {
    if (previousCandidateFailures.length) {
      return {
        status: 'fix_generation_failed',
        reason: 'No remaining CRITICAL or WARNING candidates after failed patch attempts.',
        attempted_candidates: previousCandidateFailures,
      };
    }
    return { dry_run: null, message: 'No CRITICAL or WARNING findings — nothing to PR' };
  }

  const repoFullName = auditResult.metadata?.full_name || repoUrl;
  const model = process.env.OPENROUTER_API_KEY ? 'kimi26' : (process.env.NVIDIA_API_KEY ? 'kimi' : 'minimax');

  // ─── Step 1: Select the best finding ──────────────────────────────────
  console.log('PR: Selecting best fix candidate...');
  let selectedFinding, selectorResult;

  // Send most impactful findings only (keep input manageable)
  const selectorFindings = [
    ...criticalIssues,
    ...warnings.slice(0, Math.max(0, 15 - criticalIssues.length)),
  ];

  if (selectorFindings.length === 0) {
    return { dry_run: null, message: 'No fixable findings after filtering' };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const selectorInput = {
        repo: repoFullName,
        total_findings: findings.length,
        shown_findings: selectorFindings.length,
        findings: selectorFindings,
      };
      const raw = await callLLM([
        { role: 'system', content: PR_SELECTOR_PROMPT },
        { role: 'user', content: JSON.stringify(selectorInput, null, 2) },
      ], 'minimax27', 0.3, 4096);

      if (!raw || !raw.trim()) {
        if (attempt === 0) { console.warn('PR: Empty selector response, retrying...'); continue; }
        return { dry_run: null, error: 'Selector returned empty response after retry' };
      }

      selectorResult = JSON.parse(extractJSON(raw));

      // Handle intentional rejection (no viable candidate)
      if (selectorResult.selected === null || selectorResult.selected === undefined) {
        const reason = selectorResult.rejection_summary || {};
        const totalFindings = auditResult.findings ? auditResult.findings.length : 0;
        const explicitRejections = Object.values(reason).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
        console.warn(`PR: Selector rejected all candidates — ${selectorResult.message || 'no safe candidate'}`);
        if (Object.keys(reason).length) {
          console.warn('PR: Rejection breakdown:', JSON.stringify(reason));
        }
        return {
          status: 'no_safe_candidate',
          decision: 'No dry-run PR package generated because all candidates failed first-demo safety gates.',
          audited_findings: totalFindings,
          evaluated_count: selectorFindings.length,
          explicit_rejection_count: explicitRejections,
          selected_count: 0,
          attempted_candidates: previousCandidateFailures,
          safety_gates: [
            'single code file only',
            'non-doc source change',
            'validation command required',
            'patch must apply',
            'low blast radius',
            'non-speculative finding',
          ],
          rejection_summary: reason,
          human_summary: `The agent audited ${totalFindings} findings and deeply evaluated ${selectorFindings.length} candidate findings. Those candidates triggered ${explicitRejections} total safety-gate failures across categories. No candidate met the full first-demo PR bar.`,
          _raw: { dry_run: null, message: selectorResult.message },
        };
      }

      selectedFinding = selectorFindings[selectorResult.selected.finding_index];

      if (!selectedFinding) {
        return { dry_run: null, error: `Selected finding index ${selectorResult.selected.finding_index} not found in findings` };
      }
      break; // success
    } catch(e) {
      if (attempt === 0) { console.warn('PR: Selector attempt 1 failed, retrying:', e.message); continue; }
      return { dry_run: null, error: 'Candidate selection failed: ' + e.message.slice(0, 200) };
    }
  }

  // ─── Gate 3a: Post-extraction path reject ─────────────────────────────
  // HARD reject docs, generated, vendor, lockfiles, test fixtures for first-demo PRs
  const hardReject = [
    // Docs
    /\.mdx?$/, /\.txt$/, /\.rst$/, /^docs\//, /^examples\//, /\/docs\//, /\/examples\//,
    // Generated / build output
    /^dist\//, /^build\//, /^target\//, /\/dist\//, /\/build\//, /\/target\//,
    // Vendor / dependencies
    /^vendor\//, /^node_modules\//, /\/vendor\//, /\/node_modules\//,
    // Lockfiles
    /\bpackage-lock\.json$/, /\bpnpm-lock\.yaml$/, /\bCargo\.lock$/, /\.lock$/,
    // Minified / generated
    /\.min\.(js|css)$/,
    // Coverage
    /^coverage\//, /\/coverage\//,
    // Test fixtures / snapshots
    /\/fixtures\//, /__snapshots__\//,
  ];
  // For first-demo, also reject test-only paths (tests, specs, __tests__)
  const testReject = [
    /^tests?\//, /\/tests?\//, /\.test\./, /\.spec\./, /__tests__\//,
    /^cypress\//, /\/cypress\//,
  ];
  const fileLower = selectedFinding.file.toLowerCase();
  if (hardReject.some(p => p.test(fileLower))) {
    return retryWithNextCandidate(`Rejected non-source path: ${selectedFinding.file}`);
  }
  // Soft reject for test-only — log why, still allow (Tuck's "broken test masks real failure" exception)
  if (testReject.some(p => p.test(fileLower))) {
    console.warn(`PR: Test-only path ${selectedFinding.file} — proceeding only if finding suggests real bug masked by test`);
  }

  function candidateFailure(reason) {
    return {
      severity: selectedFinding.severity,
      file: selectedFinding.file,
      title: selectedFinding.title,
      reason,
    };
  }

  async function retryWithNextCandidate(reason) {
    const failures = [...previousCandidateFailures, candidateFailure(reason)];
    if (retryDepth + 1 >= maxCandidateAttempts) {
      return {
        status: 'fix_generation_failed',
        reason: `Candidate attempts exhausted — ${reason}`,
        attempted_candidates: failures,
        selected_finding: {
          severity: selectedFinding.severity,
          file: selectedFinding.file,
          title: selectedFinding.title,
          fix_summary: selectorResult.selected.fix_summary,
          confidence: selectorResult.confidence,
        },
      };
    }

    console.warn(`PR: Candidate failed (${reason}); trying next candidate...`);
    return generateFixPR(withoutFinding(auditResult, selectedFinding), repoUrl, {
      retryDepth: retryDepth + 1,
      maxCandidateAttempts,
      previousCandidateFailures: failures,
    });
  }

  // ─── Step 2: Fetch file content from GitHub ───────────────────────────
  console.log(`PR: Fetching ${selectedFinding.file} from ${repoFullName}...`);
  let fileContent;
  try {
    fileContent = await fetchGitHubFile(
      repoFullName.replace(/^https?:\/\/github\.com\//, ''),
      selectedFinding.file
    );
  } catch(e) {
    return retryWithNextCandidate(`Could not fetch file from GitHub: ${e.message}`);
  }

  // ─── Step 3: Generate the fix ─────────────────────────────────────────
  console.log('PR: Generating fix...');
  let fixResult;
  let replacementContent;
  try {
    const fixerInput = {
      severity: selectedFinding.severity,
      title: selectedFinding.title,
      description: selectedFinding.description,
      suggestion: selectedFinding.suggestion,
      file_path: selectedFinding.file,
      file_content: fileContent,
    };
    const fixerAttempts = [
      { model, maxTokens: 12288 },
      ...(model !== 'minimax27' ? [{ model: 'minimax27', maxTokens: 12288 }] : []),
    ];
    const fixerErrors = [];

    for (const attempt of fixerAttempts) {
      try {
        const raw = await callLLM([
          { role: 'system', content: PR_FIXER_PROMPT },
          { role: 'user', content: JSON.stringify(fixerInput, null, 2) },
        ], attempt.model, 0.2, attempt.maxTokens);

        const parsedFix = JSON.parse(extractJSON(raw));
        if (!parsedFix || parsedFix.status !== 'patch_generated') {
          throw new Error(parsedFix?.reason ?? 'Fixer returned status !== patch_generated');
        }

        const ver = parsedFix.validation || {};
        if (!ver.command && !ver.fallback) {
          throw new Error('Validation confidence too low: no validation command or fallback produced');
        }
        if (!parsedFix.unified_diff || parsedFix.unified_diff.trim().length === 0) {
          throw new Error('Fixer returned no unified_diff — no fix applied');
        }

        replacementContent = applyUnifiedDiff(fileContent, parsedFix.unified_diff);
        fixResult = parsedFix;
        break;
      } catch(e) {
        const attemptLabel = `${attempt.model}: ${e.message.slice(0, 160)}`;
        fixerErrors.push(attemptLabel);
        console.warn(`PR: Fixer attempt failed (${attemptLabel})`);
      }
    }

    if (!fixResult) {
      return retryWithNextCandidate('Fixer attempts failed — ' + fixerErrors.join(' | '));
    }
  } catch(e) {
    return retryWithNextCandidate('Fix generation failed: ' + e.message.slice(0, 200));
  }

  // ─── Step 4: Build dry-run package ────────────────────────────────────
  const branchName = 'fix/' + selectedFinding.file
    .replace(/\.\w+$/, '')         // remove extension
    .replace(/[\/\\]/g, '-')       // slashes to dashes
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()
    .slice(0, 40)
    + '-' + Date.now().toString(36).slice(-5);

  const dryRun = {
    selected_finding: {
      severity: selectedFinding.severity,
      category: selectedFinding.category,
      file: selectedFinding.file,
      title: selectedFinding.title,
      description: selectedFinding.description,
      fix_summary: selectorResult.selected.fix_summary,
      reason_selected: selectorResult.confidence_reasoning || '',
      rejected_alternatives: selectorResult.rejected_runner_ups || [],
      confidence: selectorResult.confidence,
    },
    patch: {
      file: selectedFinding.file,
      change_type: 'modify',
      rationale: fixResult.rationale || '',
      unified_diff: fixResult.unified_diff || '',
      original_content_preview: fileContent.slice(0, 500) + (fileContent.length > 500 ? '\n...' : ''),
      diff_preview: (fixResult.unified_diff || '').slice(0, 500) + ((fixResult.unified_diff || '').length > 500 ? '\n...' : ''),
    },
    validation: fixResult.validation || { command: null, fallback: null, confidence: 'low' },
    pr_draft: {
      title: `fix: ${selectedFinding.title.slice(0, 60)}`,
      body: [
        `## Description`,
        ``,
        fixResult.rationale || selectedFinding.description,
        ``,
        `**Finding:** ${selectedFinding.severity} — ${selectedFinding.title}`,
        `**File:** \`${selectedFinding.file}\``,
        ``,
        `## Risk Assessment`,
        ``,
        `- **Blast radius:** Single file, single concern`,
        `- **Change type:** Surgical fix — ${(fixResult.rationale || 'minimal change').slice(0, 120)}`,
        `- **Breaking potential:** Low — narrow scope, well-defined fix`,
        ``,
        `## Validation`,
        ``,
      ].join('\n'),
      branch: branchName,
    },
  };

  // Add validation section
  const v = fixResult.validation || {};
  if (v.command) dryRun.pr_draft.body += `- **Test:** \`${v.command}\`\n`;
  if (v.fallback) dryRun.pr_draft.body += `- **Fallback:** ${v.fallback}\n`;
  dryRun.pr_draft.body += `\n---\n*Generated by Archiview · Autonomous AI Audit*\n`;

  const prPlan = {
    pr_title: dryRun.pr_draft.title,
    pr_body: dryRun.pr_draft.body,
    branch_name: dryRun.pr_draft.branch,
    publishable: true,
    files: [{
      path: dryRun.patch.file,
      change_type: dryRun.patch.change_type,
      description: dryRun.patch.rationale || dryRun.selected_finding.title,
      code_snippet: replacementContent,
    }],
  };

  const publicPr = {
    ...prPlan,
    files: prPlan.files.map(({ code_snippet, ...file }) => file),
  };

  return {
    dry_run: dryRun,
    pr: publicPr,
    pr_plan: prPlan,
    message: `Dry-run PR package ready: "${selectedFinding.title}" in ${selectedFinding.file}`,
  };
}

// ─── GitHub API Helpers ─────────────────────────────────────────────────────

function githubUrl(path) {
  return `https://api.github.com${path}`;
}

function githubRequest(path, method = 'GET', body = null) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return Promise.reject(new Error('GITHUB_TOKEN not set'));

  return new Promise((resolve, reject) => {
    const urlObj = new URL(githubUrl(path));
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Archiview/1.0',
      },
    };

    let bodyStr = null;
    if (body) {
      bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          let msg = `GitHub API ${res.statusCode}`;
          try { const e = JSON.parse(data); msg += ': ' + (e.message || data.slice(0, 200)); }
          catch(e2) { msg += ': ' + data.slice(0, 200); }
          return reject(new Error(msg));
        }
        if (res.statusCode === 204) return resolve(null); // No content (delete)
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Parse owner/repo from various URL formats:
 *   https://github.com/owner/repo
 *   git@github.com:owner/repo.git
 *   owner/repo
 */
function parseRepoUrl(url) {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/) ||
                url.match(/^([^/]+)\/([^/]+)$/);
  if (!match) throw new Error('Invalid repo URL: ' + url);
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

/**
 * Publish a PR plan to GitHub:
 *   1. Check write access — fork if needed
 *   2. Create branch from default branch
 *   3. Commit file changes via Contents API
 *   4. Open pull request
 */
async function publishPR(prPlan, repoUrl) {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { error: 'GITHUB_TOKEN not set', url: null };

  // Resolve actual owner/repo (may fork if no write access)
  let targetOwner = owner;
  let targetRepo = repo;

  const files = prPlan.files || [];
  if (!files.length) {
    return { error: 'PR plan has no file changes to publish', url: null };
  }
  for (const file of files) {
    if (file.change_type !== 'delete' && typeof file.code_snippet !== 'string') {
      return {
        error: `PR plan is not publishable because ${file.path} is missing replacement content. Regenerate the PR plan.`,
        url: null,
      };
    }
  }

  // Step 1: Check if we can write directly
  let sourceRepoInfo;
  try {
    sourceRepoInfo = await githubRequest(`/repos/${owner}/${repo}`);
  } catch(e) {
    return { error: `Could not load repository metadata: ${e.message}`, url: null };
  }

  const perms = sourceRepoInfo.permissions || {};
  const canWriteDirectly = Boolean(perms.push || perms.maintain || perms.admin);
  if (!canWriteDirectly) {
    // No write access — fork the repo
    console.log(`PR: Forking ${owner}/${repo}...`);
    const fork = await githubRequest(`/repos/${owner}/${repo}/forks`, 'POST');
    targetOwner = fork.owner.login;
    targetRepo = fork.name;
    // Wait for fork to be ready
    await new Promise(r => setTimeout(r, 3000));
  }

  // Step 2: Get default branch and its SHA
  const repoInfo = canWriteDirectly
    ? sourceRepoInfo
    : await githubRequest(`/repos/${targetOwner}/${targetRepo}`);
  const defaultBranch = repoInfo.default_branch;
  const refResponse = await githubRequest(`/repos/${targetOwner}/${targetRepo}/git/refs/heads/${defaultBranch}`);
  const baseSha = refResponse.object.sha;

  // Step 3: Create feature branch
  let branchName = prPlan.branch_name || `fix/hermes-audit-${Date.now()}`;
  console.log(`PR: Creating branch ${branchName} at ${baseSha.slice(0, 7)}...`);
  try {
    await githubRequest(`/repos/${targetOwner}/${targetRepo}/git/refs`, 'POST', {
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
  } catch(e) {
    if (!/Reference already exists|422/.test(e.message)) throw e;
    branchName = `${branchName}-${Date.now().toString(36).slice(-5)}`;
    await githubRequest(`/repos/${targetOwner}/${targetRepo}/git/refs`, 'POST', {
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
  }

  // Step 4: Commit file changes
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`PR: ${file.change_type === 'delete' ? 'Deleting' : 'Updating'} ${file.path}...`);

    if (file.change_type === 'delete') {
      try {
        const fileInfo = await githubRequest(
          `/repos/${targetOwner}/${targetRepo}/contents/${file.path}?ref=${branchName}`
        );
        await githubRequest(
          `/repos/${targetOwner}/${targetRepo}/contents/${file.path}`, 'DELETE', {
          message: file.description || `Delete ${file.path}`,
          sha: fileInfo.sha,
          branch: branchName,
        });
      } catch(e) {
        console.warn(`PR: Could not delete ${file.path}: ${e.message}`);
      }
    } else {
      // Create or modify
      const content = Buffer.from(file.code_snippet || '').toString('base64');

      let sha = null;
      if (file.change_type === 'modify') {
        try {
          const existing = await githubRequest(
            `/repos/${targetOwner}/${targetRepo}/contents/${file.path}?ref=${branchName}`
          );
          sha = existing.sha;
        } catch(e) {
          // File doesn't exist yet — create it
        }
      }

      await githubRequest(
        `/repos/${targetOwner}/${targetRepo}/contents/${file.path}`, 'PUT', {
        message: file.description || `Update ${file.path}`,
        content,
        sha: sha || undefined,
        branch: branchName,
      });
    }
  }

  // Step 5: Open the pull request
  console.log(`PR: Opening PR "${prPlan.pr_title}"...`);
  const pr = await githubRequest(`/repos/${owner}/${repo}/pulls`, 'POST', {
    title: prPlan.pr_title,
    body: prPlan.pr_body,
    head: targetOwner !== owner ? `${targetOwner}:${branchName}` : branchName,
    base: defaultBranch,
  });

  return {
    success: true,
    url: pr.html_url,
    number: pr.number,
    message: `PR #${pr.number} opened: ${pr.html_url}`,
  };
}

module.exports = { analyzeRepo, generateFixPR, publishPR, extractJSON, callLLM, applyUnifiedDiff };
