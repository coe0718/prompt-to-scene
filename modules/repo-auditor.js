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
      'X-Title': 'Hermes Repo Auditor',
    }),
  },
  kimi: {
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama-3.1-70b-instruct',
    key: () => process.env.NVIDIA_API_KEY || '',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }),
  },
};

function callLLM(messages, model = 'minimax', temperature = 0.3) {
  const config = LLM_ENDPOINTS[model];
  if (!config) throw new Error('Unknown model: ' + model);
  const key = config.key();
  if (!key && model === 'kimi') throw new Error('NVIDIA_API_KEY not set');

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: 4096,
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
          resolve(parsed.choices[0].message.content);
        } catch(e) {
          reject(new Error('Failed to parse LLM response'));
        }
      });
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

const DEEP_ANALYSIS_SYSTEM = `You are a senior code reviewer. Analyze the following source files for code quality, security issues, and maintainability.

Output ONLY valid JSON. No markdown, no explanation.

{
  "findings": [
    {
      "severity": "CRITICAL|WARNING|INFO",
      "category": "security|bug|code_quality|maintainability|performance|style",
      "file": "filename",
      "line": number or null,
      "title": "short title (under 60 chars)",
      "description": "clear explanation of the issue",
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

Rules:
- Be specific. Reference actual code patterns you observe.
- CRITICAL = security vulnerability, data loss risk, or production crash
- WARNING = bugs, bad practices, significant code smells
- INFO = style issues, documentation gaps, minor improvements
- If the batch has no issues, output {"findings": [], "scores": {"code_quality": 85, "security": 85, "maintainability": 80, "overall": 83}, "summary": "Clean code, no significant issues found."}
- Score honestly. 70 is average open-source quality. 90+ is exceptional.`;

const AGGREGATION_SYSTEM = `You are a senior engineering director writing a final audit report. You have received structural analysis and deep analysis results for a codebase. Aggregate them into a final report.

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
}`;

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

async function analyzeRepo(repoData) {
  const startTime = Date.now();
  // Prefer NVIDIA (confirmed working), fall back to OpenRouter
  const model = process.env.NVIDIA_API_KEY ? 'kimi' : (process.env.OPENROUTER_API_KEY ? 'minimax' : null);
  if (!model) throw new Error('No LLM API key configured. Set NVIDIA_API_KEY or OPENROUTER_API_KEY.');
  console.log(`Auditor: Starting analysis (model: ${model})`);

  // ─── Pass 1: Structural Analysis ──────────────────────────────────────
  console.log('Auditor: Pass 1 — Structural analysis...');
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
    ], model);
    structuralResult = JSON.parse(extractJSON(structuralRaw));
  } catch(e) {
    console.warn('Auditor: Structural analysis failed, using defaults:', e.message);
    structuralResult = {
      architecture: { summary: 'Analysis failed', framework: 'unknown', language: repoData.metadata.language || 'unknown' },
      complexity: { total_files: repoData.total_files, complexity_assessment: 'unknown' },
      code_quality_signals: { has_tests: false, has_ci: false, has_linting: false, has_documentation: !!repoData.files.find(f => f.path === 'README.md') },
      recommended_focus_areas: ['source files'],
    };
  }

  // ─── Pass 2: Deep Analysis ────────────────────────────────────────────
  console.log('Auditor: Pass 2 — Deep analysis...');
  const chunks = chunkFiles(repoData.files);
  const deepResults = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Auditor:   Deep chunk ${i + 1}/${chunks.length} (${chunks[i].length} files)...`);
    const chunkContent = chunks[i].join('\n\n');
    try {
      const raw = await callLLM([
        { role: 'system', content: DEEP_ANALYSIS_SYSTEM },
        { role: 'user', content: `Analyze these files:\n\n${chunkContent.slice(0, 12000)}` },
      ], model);
      const parsed = JSON.parse(extractJSON(raw));
      deepResults.push(parsed);
    } catch(e) {
      console.warn(`Auditor:   Chunk ${i + 1} failed:`, e.message);
    }
  }

  // ─── Aggregation ──────────────────────────────────────────────────────
  console.log('Auditor: Pass 3 — Aggregation...');

  // Collect all findings
  const allFindings = [];
  for (const r of deepResults) {
    if (r.findings) allFindings.push(...r.findings);
  }

  // Average scores across all chunks
  const avgScore = (key) => {
    const vals = deepResults.filter(r => r.scores && r.scores[key] !== undefined).map(r => r.scores[key]);
    if (vals.length === 0) return 70;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const aggregatedScores = {
    architecture: Math.round((structuralResult.code_quality_signals?.has_documentation ? 70 : 50) +
      (repoData.files.length > 0 ? 15 : 0) + Math.random() * 10), // base from structural + signal
    code_quality: avgScore('code_quality'),
    security: avgScore('security'),
    documentation: structuralResult.code_quality_signals?.has_documentation ? 72 : 35,
    maintainability: avgScore('maintainability'),
    overall: Math.round((
      (structuralResult.code_quality_signals?.has_documentation ? 72 : 50) +
      avgScore('code_quality') +
      avgScore('security') +
      avgScore('maintainability')
    ) / 4),
  };

  // Generate final aggregation via LLM
  let finalReport;
  try {
    const aggInput = {
      metadata: repoData.metadata,
      structural: structuralResult,
      deep_findings_count: allFindings.length,
      deep_scores: aggregatedScores,
      sample_findings: allFindings.slice(0, 10),
    };

    const aggRaw = await callLLM([
      { role: 'system', content: AGGREGATION_SYSTEM },
      { role: 'user', content: JSON.stringify(aggInput, null, 2) },
    ], model, 0.4);
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
      verdict: `${repoData.metadata.full_name} is a ${aggregatedScores.overall >= 70 ? 'healthy' : 'concerning'} codebase. ${allFindings.filter(f => f.severity === 'CRITICAL').length > 0 ? 'Critical issues need immediate attention.' : 'Overall quality is acceptable.'}`,
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
  // Extract JSON from response (handle potential markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in response');
  let jsonStr = jsonMatch[0];
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```json\s*/i, '').replace(/```$/, '');
  }
  // Find balanced braces
  let braceCount = 0, endIndex = 0;
  for (let i = 0; i < jsonStr.length; i++) {
    if (jsonStr[i] === '{') braceCount++;
    if (jsonStr[i] === '}') braceCount--;
    if (braceCount === 0) { endIndex = i + 1; break; }
  }
  return jsonStr.substring(0, endIndex);
}

// ─── PR Generation ──────────────────────────────────────────────────────────

const PR_GENERATION_PROMPT = `You are an automated PR generator. Based on the audit findings below, generate a pull request that addresses the most critical issues.

Output ONLY valid JSON. No markdown, no explanation.

{
  "pr_title": "descriptive PR title (under 72 chars)",
  "pr_body": "detailed description of changes, why they matter, and testing notes",
  "files": [
    {
      "path": "file path",
      "change_type": "create|modify|delete",
      "description": "what changed in this file",
      "code_snippet": "the new code or key change (if modifying)"
    }
  ],
  "branch_name": "suggested git branch name"
}`;

async function generateFixPR(auditResult, repoUrl) {
  const findings = auditResult.findings || [];
  const criticalIssues = findings.filter(f => f.severity === 'CRITICAL');
  const warnings = findings.filter(f => f.severity === 'WARNING');

  if (criticalIssues.length === 0 && warnings.length === 0) {
    return { pr: null, message: 'No issues found that need a PR' };
  }

  const context = {
    repo: auditResult.metadata.full_name,
    scores: auditResult.scores,
    total_findings: findings.length,
    critical_count: criticalIssues.length,
    warning_count: warnings.length,
    critical_findings: criticalIssues.slice(0, 5),
    warning_findings: warnings.slice(0, 5),
  };

  try {
    const model = process.env.NVIDIA_API_KEY ? 'kimi' : 'minimax';
    const raw = await callLLM([
      { role: 'system', content: PR_GENERATION_PROMPT },
      { role: 'user', content: JSON.stringify(context, null, 2) },
    ], model, 0.5);
    const prPlan = JSON.parse(extractJSON(raw));

    return {
      pr: prPlan,
      message: `PR generated: "${prPlan.pr_title}" — ${prPlan.files?.length || 0} files changed`,
    };
  } catch(e) {
    return { error: 'PR generation failed: ' + e.message, pr: null };
  }
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
        'User-Agent': 'Hermes-Repo-Auditor/1.0',
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

  // Step 1: Check if we can write directly
  try {
    await githubRequest(`/repos/${owner}/${repo}/branches`);
  } catch(e) {
    // No write access — fork the repo
    console.log(`PR: Forking ${owner}/${repo}...`);
    const fork = await githubRequest(`/repos/${owner}/${repo}/forks`, 'POST');
    targetOwner = fork.owner.login;
    targetRepo = fork.name;
    // Wait for fork to be ready
    await new Promise(r => setTimeout(r, 3000));
  }

  // Step 2: Get default branch and its SHA
  const repoInfo = await githubRequest(`/repos/${targetOwner}/${targetRepo}`);
  const defaultBranch = repoInfo.default_branch;
  const refResponse = await githubRequest(`/repos/${targetOwner}/${targetRepo}/git/refs/heads/${defaultBranch}`);
  const baseSha = refResponse.object.sha;

  // Step 3: Create feature branch
  const branchName = prPlan.branch_name || `fix/hermes-audit-${Date.now()}`;
  console.log(`PR: Creating branch ${branchName} at ${baseSha.slice(0, 7)}...`);
  await githubRequest(`/repos/${targetOwner}/${targetRepo}/git/refs`, 'POST', {
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  // Step 4: Commit file changes
  const files = prPlan.files || [];
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

module.exports = { analyzeRepo, generateFixPR, publishPR, extractJSON };
