/**
 * Prompt-to-Scene Server
 *
 * Serves the demo UI and provides API endpoints for the Director agent
 * and all generators.
 *
 * Usage:
 *   node server.js
 *   node server.js --port 3000
 *
 * Environment (optional .env file):
 *   OPENROUTER_API_KEY   — for minimax-m2.5 (default LLM)
 *   NVIDIA_API_KEY       — legacy, not used (all models via OpenRouter)
 *   PORT                 — server port (default: 7041)
 *
 * Endpoints:
 *   GET  /                  → Demo UI
 *   POST /api/generate       → { prompt } → Director spec
 *   POST /api/generate/p5js  → { spec } → p5.js HTML
 *   POST /api/generate/ascii → { spec } → ASCII HTML
 *   POST /api/generate/stitch→ { spec, audioData? } → stitcher HTML
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// ─── Crash recovery: log but don't exit — keep serving ──────────────────
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err.message);
  console.error(err.stack?.slice(0, 500));
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
});

// ─── Load .env file (no dependency needed) ─────────────────────────────────

(function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch(e) { /* ignore */ }
})();

const PORT = parseInt(process.env.PORT || process.argv[3] || '7041', 10);
const ROOT = __dirname;

// ─── Audit result cache (for PR generation) ──────────────────────────────────
const auditCache = new Map();

// ─── Scan history (for history widget) ──────────────────────────────────────
const scanHistory = [];
const DATA_DIR = path.join(__dirname, 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'scan-history.json');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');

// Load persisted history
try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  if (fs.existsSync(HISTORY_FILE)) {
    const loaded = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (Array.isArray(loaded)) scanHistory.push(...loaded);
    console.log(`✓ Loaded ${scanHistory.length} scan history entries`);
  }
} catch(e) { console.warn('Could not load scan history:', e.message); }

function saveHistory() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(scanHistory), 'utf8');
  } catch(e) { /* silent */ }
}

// ─── Famous repos cache ────────────────────────────────────────────────────
const FAMOUS_REPOS = [
  'expressjs/express',
  'facebook/react',
  'vuejs/core',
  'facebook/jest',
  'coe0718/archiview',
];
const FAMOUS_FILE = path.join(DATA_DIR, 'famous-repos.json');
let famousResults = [];

// Load cached famous repo results
try {
  if (fs.existsSync(FAMOUS_FILE)) {
    famousResults = JSON.parse(fs.readFileSync(FAMOUS_FILE, 'utf8'));
    console.log(`✓ Loaded ${famousResults.length} famous repo results`);
  }
} catch(e) { console.warn('Could not load famous repos:', e.message); }

// ─── Require project modules ───────────────────────────────────────────────

let director, p5jsGen, asciiGen, stitcher, vision, repoFetcher, repoAuditor, reportGen;

try {
  director = require('./director/agent.js');
} catch(e) {
  console.warn('Director agent not available (LLM calls will fail):', e.message);
  director = null;
}

try {
  p5jsGen = require('./generators/p5js-scene.js');
} catch(e) {
  console.warn('p5js generator not available:', e.message);
  p5jsGen = null;
}

try {
  asciiGen = require('./generators/ascii-engine.js');
} catch(e) {
  console.warn('ASCII generator not available:', e.message);
  asciiGen = null;
}

try {
  repoFetcher = require('./modules/repo-fetcher.js');
  repoAuditor = require('./modules/repo-auditor.js');
  reportGen = require('./modules/report-generator.js');
  console.log('✓ Repo Auditor modules loaded');
} catch(e) {
  console.warn('Repo Auditor modules not available:', e.message);
}

try {
  stitcher = require('./sync/stitcher.js');
} catch(e) {
  console.warn('Stitcher not available:', e.message);
  stitcher = null;
}

try {
  vision = require('./director/vision.js');
} catch(e) {
  console.warn('Vision module not available:', e.message);
  vision = null;
}

let presets;
try {
  presets = require('./presets.js').PRESETS;
  console.log(`✓ ${presets.length} presets loaded`);
} catch(e) {
  console.warn('Presets not available:', e.message);
  presets = [];
}

// ─── Enhanced p5.js template ──────────────────────────────────────────────

let enhancedTemplate = null;
try {
  enhancedTemplate = require('fs').readFileSync(
    path.join(ROOT, 'generators', 'p5js-enhanced.html'), 'utf8'
  );
  console.log('✓ Enhanced p5.js template loaded (' + (enhancedTemplate.length/1024).toFixed(1) + 'KB)');
} catch(e) {
  console.warn('Enhanced template not available:', e.message);
}

// ─── Procedural Audio generator ───────────────────────────────────────────

let proceduralAudio = null;
try {
  proceduralAudio = require('./generators/procedural-audio.js');
  console.log('✓ Procedural audio generator loaded');
} catch(e) {
  console.warn('Procedural audio generator not available:', e.message);
}

// ─── Enhanced ASCII template ──────────────────────────────────────────────

let asciiEnhancedTemplate = null;
try {
  asciiEnhancedTemplate = require('fs').readFileSync(
    path.join(ROOT, 'generators', 'ascii-enhanced.html'), 'utf8'
  );
  console.log('✓ Enhanced ASCII template loaded (' + (asciiEnhancedTemplate.length/1024).toFixed(1) + 'KB)');
} catch(e) {
  console.warn('Enhanced ASCII template not available:', e.message);
}

// ─── CDN asset fetcher for standalone export ────────────────────────────────

const CDN_CACHE = {};

function fetchCdnAsset(url) {
  return new Promise((resolve, reject) => {
    if (CDN_CACHE[url]) return resolve(CDN_CACHE[url]);

    const mod = url.startsWith('https') ? https : http;
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        return fetchCdnAsset(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`CDN fetch ${url}: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const content = Buffer.concat(chunks).toString('utf-8');
        CDN_CACHE[url] = content;
        resolve(content);
      });
    }).on('error', reject);
  });
}

// ─── Standalone Export ──────────────────────────────────────────────────────

async function handleExport(req, res) {
  const body = await readBody(req);
  const spec = body.spec || body;
  const generator = body.generator || 'p5js-enhanced';

  if (!spec || !spec.scene) {
    return jsonResponse(res, 400, { error: 'Missing or invalid scene spec' });
  }

  try {
    // Generate the HTML using the appropriate generator
    let html;
    switch (generator) {
      case 'p5js-enhanced':
        if (!enhancedTemplate) throw new Error('Enhanced p5.js template not loaded');
        html = enhancedTemplate.replace(
          '<body>',
          '<body data-spec="' + JSON.stringify(spec).replace(/"/g, '&quot;') + '">'
        );
        break;
      case 'ascii-enhanced':
        if (!asciiEnhancedTemplate) throw new Error('Enhanced ASCII template not loaded');
        html = asciiEnhancedTemplate.replace(
          '<body data-spec="{}">',
          '<body data-spec="' + JSON.stringify(spec).replace(/"/g, '&quot;') + '">'
        );
        break;
      case 'procedural-audio':
        if (!proceduralAudio) throw new Error('Procedural audio generator not loaded');
        html = proceduralAudio.generate(spec);
        break;
      case 'stitch':
        if (!stitcher) throw new Error('Stitcher not loaded');
        html = stitcher.buildHTML(spec, null, body.audioData || null);
        break;
      default:
        return jsonResponse(res, 400, { error: 'Unknown generator: ' + generator });
    }

    // Find and fetch all CDN script tags, inline them
    const cdnUrls = [];
    const cdnRegex = /<script\s+src="(https?:\/\/[^"]+)"[^>]*><\/script>/g;
    let match;
    while ((match = cdnRegex.exec(html)) !== null) {
      cdnUrls.push(match[1]);
    }

    if (cdnUrls.length > 0) {
      const results = await Promise.allSettled(cdnUrls.map(fetchCdnAsset));
      for (let i = 0; i < cdnUrls.length; i++) {
        const url = cdnUrls[i];
        const result = results[i];
        if (result.status === 'fulfilled') {
          // Replace CDN script tag with inlined script
          html = html.replace(
            '<script src="' + url + '"></script>',
            '<script>' + result.value + '</script>'
          );
        } else {
          console.warn('Failed to fetch CDN asset, keeping remote:', url, result.reason.message);
        }
      }
    }

    // Add export metadata badge
    const sceneName = (spec.scene && spec.scene.name) || 'scene';
    const exportBadge = `<!--\n  ═══ Prompt-to-Scene · Standalone Export ═══\n  Scene: ${sceneName}\n  Generator: ${generator}\n  Generated: ${new Date().toISOString()}\n  Built by Archiview (autonomous AI agents)\n  → https://github.com/coe0718/archiview\n  ═══════════════════════════════════════════════\n-->\n`;
    html = exportBadge + html;

    // Return as downloadable file
    const filename = sceneName.replace(/[^a-z0-9-]/gi, '-').toLowerCase() + '-' + generator + '.html';
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(html);
  } catch(e) {
    console.error('Export error:', e.message);
    jsonResponse(res, 500, { error: 'Export failed: ' + e.message });
  }
}

// ─── MIME types ────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

// ─── JSON helpers ──────────────────────────────────────────────────────────

function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch(e) { resolve({ raw: body }); } });
  });
}

// ─── Static file server ────────────────────────────────────────────────────

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime, 'Access-Control-Allow-Origin': '*' });
    res.end(content);
  } catch(e) {
    res.writeHead(404);
    res.end('Not found');
  }
}

// ─── Router ────────────────────────────────────────────────────────────────

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // ── Health check ──────────────────────────────────────────────────────────
 if (url.pathname === '/health' && method === 'GET') {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ status: 'ok', port: PORT }));
 }

 // ── API Routes ──
  if (url.pathname === '/api/generate' && method === 'POST') {
    return handleGenerate(req, res);
  }
  if (url.pathname === '/api/generate/p5js' && method === 'POST') {
    return handleGenerateP5JSEnhanced(req, res);
  }
  if (url.pathname === '/api/generate/ascii' && method === 'POST') {
    return handleGenerateOutput(req, res, 'ascii');
  }
  if (url.pathname === '/api/generate/ascii-enhanced' && method === 'POST') {
    return handleASCIIEnhanced(req, res);
  }
  if (url.pathname === '/api/generate/procedural-audio' && method === 'POST') {
    return handleProceduralAudio(req, res);
  }
  if (url.pathname === '/api/generate/stitch' && method === 'POST') {
    return handleGenerateOutput(req, res, 'stitch');
  }
if (url.pathname === '/api/batch' && method === 'POST') {
  return handleBatch(req, res);
}
if (url.pathname === '/api/generate-from-image' && method === 'POST') {
  return handleGenerateFromImage(req, res);
}
if (url.pathname === '/api/export' && method === 'POST') {
  return handleExport(req, res);
}
if (url.pathname === '/api/audit' && method === 'POST') {
  return handleAudit(req, res);
}
if (url.pathname === '/api/audit/pr' && method === 'POST') {
  return handleAuditPR(req, res);
}
if (url.pathname === '/api/audit/pr/publish' && method === 'POST') {
  return handleAuditPRPublish(req, res);
}
if (url.pathname === '/api/audit/history' && method === 'GET') {
  return jsonResponse(res, 200, scanHistory);
}
if (url.pathname === '/api/audit/badge' && method === 'GET') {
  return handleBadge(req, res, url);
}
if (url.pathname === '/api/audit/famous' && method === 'GET') {
  return jsonResponse(res, 200, famousResults);
}

// ── Cached report ───────────────────────────────────────────────────────
if (url.pathname === '/report' && method === 'GET') {
  var repo = (url.searchParams.get('repo') || '').trim();
  if (!repo) return jsonResponse(res, 400, { error: '?repo=user/repo required' });
  var safeName = repo.replace(/https?:\/\/github\.com\//, '').replace(/[^a-zA-Z0-9_\/-]/g, '_').replace(/\//g, '__');
  var reportPath = path.join(REPORTS_DIR, safeName + '.html');
  if (fs.existsSync(reportPath)) {
    return serveFile(res, reportPath);
  }
  // Check the in-memory audit cache as fallback
  var cached = auditCache.get(repo);
  if (cached && cached.result) {
    var html = reportGen.generateReport(cached.result, repo);
    try { fs.writeFileSync(reportPath, html, 'utf8'); } catch(e) {}
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    return res.end(html);
  }
  return jsonResponse(res, 404, { error: 'No report found for ' + repo + '. Run an audit first.', hint: 'POST /api/audit with { repo: "user/repo" }' });
}

// ── Landing page ───────────────────────────────────────────────────────────
if (url.pathname === '/landing' || url.pathname === '/about') {
  return serveFile(res, path.join(ROOT, 'ui', 'landing.html'));
}
if (url.pathname === '/creative') {
  return serveFile(res, path.join(ROOT, 'ui', 'index.html'));
}

// ── Repo Auditor page ──────────────────────────────────────────────────
if (url.pathname === '/audit') {
  return serveFile(res, path.join(ROOT, 'ui', 'auditor.html'));
}

 // ── Landing page (v3) — primary entry ──
 if (url.pathname === '/' || url.pathname === '/index.html') {
  return serveFile(res, path.join(ROOT, 'ui', 'landing-v3.html'));
 }
  // ui/ prefix
  if (url.pathname.startsWith('/ui/')) {
    const filePath = path.join(ROOT, url.pathname.slice(1));
    return serveFile(res, filePath);
  }
  // Fallback for CSS/JS in ui/
  const uiPath = path.join(ROOT, 'ui', url.pathname.slice(1));
  if (fs.existsSync(uiPath)) {
    return serveFile(res, uiPath);
  }

  res.writeHead(404);
  res.end('Not found');
}

// ── API Handlers ───────────────────────────────────────────────────────────

async function handleGenerate(req, res) {
  const body = await readBody(req);
  const prompt = body.prompt || body.raw || '';
  const usePreset = body.use_preset === true;

  // Try LLM first, fall back to preset
  const tryLLM = !usePreset && prompt && prompt.length >= 2;

  if (tryLLM && director) {
    try {
      const spec = await director.generateSpec(prompt, {
        duration: body.duration || 45,
        model: body.model || undefined,
      });
      console.log(`LLM: "${spec.scene?.name}" — ${spec.scene?.mood}, ${spec.scene?.tempo}BPM`);
      return jsonResponse(res, 200, spec);
    } catch(e) {
      console.warn('LLM failed, falling back to presets:', e.message);
    }
  }

  // Fallback: pick a preset
  if (presets.length === 0) {
    return jsonResponse(res, 503, { error: 'No presets available and Director agent not available' });
  }

  const preset = presets[Math.floor(Math.random() * presets.length)];
  // Stamp with current time
  const spec = JSON.parse(JSON.stringify(preset));
  spec.prompt = prompt || preset.prompt;
  spec.metadata = {
    director_model: 'preset',
    generated_at: new Date().toISOString(),
    generation_time_ms: 0
  };
  console.log(`Preset: "${spec.scene?.name}" — ${spec.scene?.mood}, ${spec.scene?.tempo}BPM`);
  jsonResponse(res, 200, spec);
}

async function handleGenerateFromImage(req, res) {
  const body = await readBody(req);
  const imageDataUrl = body.image;

  if (!imageDataUrl || typeof imageDataUrl !== 'string') {
    return jsonResponse(res, 400, { error: 'Missing or invalid image field (expecting data URL)' });
  }

  console.log('Image-to-Scene: calling vision model...');
  const attributes = await vision.analyzeImage(imageDataUrl);
  console.log(`Vision: mood=${attributes.mood}, style=${attributes.visual_style}, colors=${attributes.color_palette.join(',')}`);

  // Seed the director with image-derived attributes
  const seedPrompt = `${attributes.mood} ${attributes.visual_style} ${attributes.genre} scene with ${attributes.effects.join(', ')} effects, ${attributes.tempo}BPM`;

  let spec;
  let director_model = 'unknown';

  if (director) {
    try {
      spec = await director.generateSpec(seedPrompt, { imageAttributes: attributes });
      director_model = 'vision+director';
    } catch (e) {
      console.warn('Director failed after vision analysis:', e.message);
    }
  }

  // Fallback: build spec directly from vision attributes
  if (!spec) {
    spec = {
      visual: {
        style: attributes.visual_style,
        palette: attributes.color_palette,
        effects: attributes.effects,
        intensity: attributes.intensity,
      },
      scene: {
        name: `${attributes.mood} ${attributes.genre}`,
        mood: attributes.mood,
        tempo: parseInt(attributes.tempo),
        genre: attributes.genre,
        duration_seconds: 45,
        tags: attributes.tags,
      },
      audio: {
        mood: attributes.mood,
        genre: attributes.genre,
        intensity: attributes.intensity,
      },
      director_model,
    };
  }

  spec.metadata = {
    source: 'image',
    director_model: spec.metadata?.director_model || director_model,
    vision: {
      mood: attributes.mood,
      visual_style: attributes.visual_style,
      color_palette: attributes.color_palette,
      effects: attributes.effects,
      tempo: attributes.tempo,
      genre: attributes.genre,
      intensity: attributes.intensity,
      tags: attributes.tags,
    },
    generated_at: new Date().toISOString(),
  };

  jsonResponse(res, 200, spec);
}

async function handleGenerateP5JSEnhanced(req, res) {
  if (!enhancedTemplate) {
    // Fall back to old generator
    return handleGenerateOutput(req, res, 'p5js');
  }

  const body = await readBody(req);
  const spec = body.spec || body;

    // Inject spec into template via body data-spec attribute (use &quot; for HTML attr safety)
    const specJSON = JSON.stringify(spec).replace(/"/g, '&quot;');
  const html = enhancedTemplate.replace(
    '<body>',
    '<body data-spec="' + specJSON + '">'
  );

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// ── Enhanced ASCII handler ──────────────────────────────────────────────────

function handleASCIIEnhanced(req, res) {
  if (!asciiEnhancedTemplate) {
    return jsonResponse(res, 500, { error: 'Enhanced ASCII template not available' });
  }

  readBody(req).then(body => {
    const spec = body.spec || body;
    const specJSON = JSON.stringify(spec).replace(/"/g, '&quot;');
    const html = asciiEnhancedTemplate.replace(
      '<body data-spec="{}">',
      '<body data-spec="' + specJSON + '">'
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }).catch(e => {
    console.error('ASCII Enhanced error:', e.message);
    jsonResponse(res, 500, { error: e.message });
  });
}

// ── Procedural Audio handler ────────────────────────────────────────────────

function handleProceduralAudio(req, res) {
  if (!proceduralAudio) {
    return jsonResponse(res, 500, { error: 'Procedural audio generator not available' });
  }

  readBody(req).then(body => {
    const spec = body.spec || body;
    if (!spec || !spec.scene) {
      return jsonResponse(res, 400, { error: 'Missing scene spec' });
    }
    try {
      const html = proceduralAudio.generate(spec);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(html);
    } catch(e) {
      console.error('Procedural audio error:', e.message);
      jsonResponse(res, 500, { error: e.message });
    }
  }).catch(e => {
    console.error('Procedural audio handler error:', e.message);
    jsonResponse(res, 500, { error: e.message });
  });
}

async function handleGenerateOutput(req, res, type) {
  const body = await readBody(req);
  const spec = body.spec || body;

  if (!spec || !spec.scene) {
    return jsonResponse(res, 400, { error: 'Missing scene spec' });
  }

  try {
    let html;
    switch (type) {
      case 'p5js':
        if (!p5jsGen) throw new Error('p5js generator not available');
        html = p5jsGen.buildHTML(spec);
        break;
      case 'ascii':
        if (!asciiGen) throw new Error('ASCII generator not available');
        html = asciiGen.buildHTML(spec);
        break;
      case 'stitch':
        if (!stitcher) throw new Error('Stitcher not available');
        html = stitcher.buildHTML(spec, null, body.audioData || null);
        break;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(html);
  } catch(e) {
    console.error(`${type} generator error:`, e.message);
    jsonResponse(res, 500, { error: e.message });
  }
}

// ── Batch Generation ───────────────────────────────────────────────────────

async function handleBatch(req, res) {
  const body = await readBody(req);
  const prompts = body.prompts || [];

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return jsonResponse(res, 400, { error: 'Provide { prompts: ["prompt1", "prompt2", ...] }' });
  }
  if (prompts.length > 50) {
    return jsonResponse(res, 400, { error: 'Max 50 prompts per batch' });
  }

  const duration = body.duration || 45;
  const results = [];
  const errors = [];

  console.log(`Batch: processing ${prompts.length} prompts...`);

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    try {
      let spec;
      if (director) {
        try {
          spec = await director.generateSpec(prompt, { duration });
        } catch(e) {
          // LLM failed, use preset
          const p = presets[i % presets.length];
          spec = JSON.parse(JSON.stringify(p));
          spec.prompt = prompt;
          spec.metadata = { director_model: 'preset-fallback', generated_at: new Date().toISOString(), generation_time_ms: 0 };
        }
      } else {
        const p = presets[i % presets.length];
        spec = JSON.parse(JSON.stringify(p));
        spec.prompt = prompt;
        spec.metadata = { director_model: 'preset', generated_at: new Date().toISOString(), generation_time_ms: 0 };
      }
      results.push({ index: i, prompt, spec });
      console.log(`  [${i+1}/${prompts.length}] "${spec.scene?.name}" — ${spec.scene?.mood}`);
    } catch(e) {
      errors.push({ index: i, prompt, error: e.message });
      console.log(`  [${i+1}/${prompts.length}] FAILED: ${e.message}`);
    }
  }

  jsonResponse(res, 200, {
    total: prompts.length,
    completed: results.length,
    failed: errors.length,
    results,
    errors,
  });
}

// ─── Repo Audit Handler ─────────────────────────────────────────────────────

async function handleAudit(req, res) {
  const body = await readBody(req);
  const repoUrl = body.repo || body.url;

  if (!repoUrl) {
    return jsonResponse(res, 400, { error: 'Missing repo URL. Send { repo: \"user/repo\" }' });
  }

  // Sanitize and validate
  var maxFiles = parseInt(body.maxFiles, 10);
  if (isNaN(maxFiles) || maxFiles < 1) maxFiles = 10;
  if (maxFiles > 9999) maxFiles = 9999;

  if (!repoFetcher || !repoAuditor || !reportGen) {
    return jsonResponse(res, 500, { error: 'Auditor modules not loaded' });
  }

  // ─── SSE Streaming Setup ────────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  let timedOut = false;
  let reqClosed = false;
  res.on('close', () => { reqClosed = true; });
  
  res.setTimeout(240000, () => {
    timedOut = true;
    if (!res.writableEnded) {
      try { res.write(`event: error\ndata: ${JSON.stringify({ message: 'Audit timed out. Try a smaller repo.' })}\n\n`); } catch(e) {}
      try { res.end(); } catch(e) {}
    }
  });

  const send = (event, data) => {
    if (!res.writableEnded && !timedOut && !reqClosed) {
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch(e) {}
    }
  };

  try {
    send('progress', { step: 'fetch', message: 'Fetching repo from GitHub...' });
    console.log(`Audit: Fetching ${repoUrl}...`);
    const repoData = await repoFetcher.fetchRepo(repoUrl, { maxFiles: maxFiles });
    console.log(`Audit: Analyzing ${repoData.metadata.full_name} (${repoData.files.length} files)...`);

    send('progress', { step: 'structural', message: `Kimi analyzing ${repoData.metadata.full_name}...` });
    const result = await repoAuditor.analyzeRepo(repoData, (phase, msg) => {
      send('progress', { step: phase, message: msg });
    });

    send('progress', { step: 'report', message: 'Generating report...' });
    const htmlReport = reportGen.generateReport(result, repoUrl);

    // Cache audit result for PR generation
    auditCache.set(repoUrl, { result, repoUrl, timestamp: Date.now() });
    
    // Push to scan history with trend tracking
    var prevEntry = scanHistory.find(function(h) { return h.repo === repoUrl; });
    var prevScore = prevEntry ? prevEntry.overall : null;
    var trend = 'new';
    if (prevScore !== null) {
      var diff = (result.scores?.overall || 0) - prevScore;
      trend = diff > 2 ? 'up' : (diff < -2 ? 'down' : 'same');
    }
    scanHistory.unshift({
      repo: repoUrl,
      full_name: repoData.metadata.full_name,
      language: repoData.metadata.language,
      stars: repoData.metadata.stars,
      overall: result.scores?.overall || 0,
      prev_overall: prevScore,
      trend: trend,
      findings: result.statistics?.findings_count || 0,
      critical: result.statistics?.critical_count || 0,
      timestamp: Date.now(),
    });
    if (scanHistory.length > 50) scanHistory.length = 50;
    saveHistory();

    send('complete', { html: htmlReport });
    // Persist report to file for /report route
    try {
      var safeName = repoUrl.replace(/https?:\/\/github\.com\//, '').replace(/[^a-zA-Z0-9_\/-]/g, '_').replace(/\//g, '__');
      var reportPath = path.join(REPORTS_DIR, safeName + '.html');
      fs.writeFileSync(reportPath, htmlReport, 'utf8');
      console.log(`✓ Report saved: ${reportPath}`);
    } catch(e) { console.warn('Could not save report file:', e.message); }

    res.end();
  } catch(e) {
    console.error(`Audit error for ${repoUrl}:`, e.message);
    if (!res.writableEnded) {
      send('error', { message: e.message.slice(0, 300) });
      res.end();
    }
  }
}

// ─── Badge SVG Handler ──────────────────────────────────────────────────────

function handleBadge(req, res, url) {
  var repo = (url.searchParams.get('repo') || '').trim();
  if (!repo) return jsonResponse(res, 400, { error: '?repo=user/repo required' });

  // Look up in audit cache first, then scan history
  var score;
  var cached = auditCache.get(repo);
  if (cached && cached.result && cached.result.scores) {
    score = cached.result.scores.overall;
  } else {
    var histEntry = scanHistory.find(function(h) { return h.repo === repo; });
    if (histEntry) score = histEntry.overall;
  }
  if (score === undefined) return jsonResponse(res, 404, { error: 'No audit found for ' + repo });

  var color = score >= 85 ? '#4ade80' : score >= 65 ? '#fbbf24' : score >= 45 ? '#fb923c' : '#f87171';
  var label = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="32">'
    + '<linearGradient id="b" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>'
    + '<clipPath id="c"><rect width="200" height="32" rx="4" fill="#fff"/></clipPath>'
    + '<g clip-path="url(#c)">'
    + '<rect width="120" height="32" fill="#555"/>'
    + '<rect x="120" width="80" height="32" fill="' + color + '"/>'
    + '<rect width="200" height="32" fill="url(#b)"/>'
    + '</g>'
    + '<g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="12">'
    + '<text x="60" y="20">Audit</text>'
    + '<text x="160" y="20" font-weight="bold">' + score + '</text>'
    + '</g>'
    + '</svg>';

  res.writeHead(200, {
    'Content-Type': 'image/svg+xml',
    'Cache-Control': 'max-age=3600',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(svg);
}

// ─── PR Plan Generation Handler ──────────────────────────────────────────────

async function handleAuditPR(req, res) {
  const body = await readBody(req);
  const repoUrl = body.repo || body.url;

  if (!repoUrl) {
    return jsonResponse(res, 400, { error: 'Send { repo: \"user/repo\" }' });
  }

  // Look up cached audit result
  const cached = auditCache.get(repoUrl);
  if (!cached || !cached.result) {
    return jsonResponse(res, 400, {
      error: 'No cached audit for this repo. Run the audit first.',
      hint: 'POST /api/audit with { repo: "user/repo" } first',
    });
  }

  console.log(`PR Plan: Generating for ${repoUrl}...`);
  try {
    const planResult = await repoAuditor.generateFixPR(cached.result, repoUrl);

    // Cache the dry-run result (no auto-publishing yet)
    auditCache.set(repoUrl, { ...cached, dryRun: planResult.dry_run, dryRunTimestamp: Date.now() });

    jsonResponse(res, 200, planResult);
  } catch(e) {
    console.error(`PR Plan error for ${repoUrl}:`, e.message);
    jsonResponse(res, 500, { error: 'PR generation failed: ' + e.message.slice(0, 200) });
  }
}

// ─── PR Publish Handler ──────────────────────────────────────────────────────

async function handleAuditPRPublish(req, res) {
  const body = await readBody(req);
  const repoUrl = body.repo || body.url;

  if (!repoUrl) {
    return jsonResponse(res, 400, { error: 'Send { repo: \"user/repo\" }' });
  }

  // Use cached PR plan, or accept one in the request body
  const cached = auditCache.get(repoUrl);
  const prPlan = body.pr_plan || cached?.prPlan;

  if (!prPlan) {
    return jsonResponse(res, 400, {
      error: 'No PR plan found. Generate one first via POST /api/audit/pr',
    });
  }

  if (!process.env.GITHUB_TOKEN) {
    return jsonResponse(res, 400, {
      error: 'GITHUB_TOKEN not configured. Set GITHUB_TOKEN in .env to publish PRs.',
      note: 'PR plan was generated but cannot be published without a GitHub token.',
      prPlan, // Return the plan so the user can still see it
    });
  }

  console.log(`PR Publish: Publishing PR for ${repoUrl}...`);
  try {
    const result = await repoAuditor.publishPR(prPlan, repoUrl);
    jsonResponse(res, 200, result);
  } catch(e) {
    console.error(`PR Publish error for ${repoUrl}:`, e.message);
    jsonResponse(res, 500, { error: 'PR publish failed: ' + e.message.slice(0, 300) });
  }
}

// ─── Start ─────────────────────────────────────────────────────────────────

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Prompt-to-Scene Server                 ║');
  console.log('║   http://localhost:' + PORT + '                    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /api/generate                → Director agent (LLM)');
  console.log('  POST /api/generate/p5js           → p5.js HTML (enhanced)');
  console.log('  POST /api/generate/ascii          → ASCII HTML (basic)');
  console.log('  POST /api/generate/ascii-enhanced → ASCII HTML (4-layer)');
  console.log('  POST /api/generate/procedural-audio → Procedural Audio HTML');
 console.log(' POST /api/generate/stitch → Stitcher HTML');
  console.log('  POST /api/generate-from-image → Image → Scene spec (VLM + Director)');
  console.log('  POST /api/export → Download standalone HTML (offline-ready)');
  console.log('  POST /api/audit → GitHub repo audit report');
  console.log('  GET  /audit → Repo Auditor UI');
  console.log('');
  if (!director) console.warn('⚠ Director agent NOT loaded — LLM calls will fail.');
  else console.log('✓ Director agent ready');
  if (!p5jsGen) console.warn('⚠ p5js generator NOT loaded');
  else console.log('✓ p5js generator ready');
  if (!asciiGen) console.warn('⚠ ASCII generator NOT loaded');
  else console.log('✓ ASCII generator ready');
  if (!stitcher) console.warn('⚠ Stitcher NOT loaded');
  else console.log('✓ Stitcher ready');
  if (!vision) console.warn('⚠ Vision module NOT loaded');
  else console.log('✓ Vision module ready (llama-3.2-90b-vision-instruct)');
  console.log('');

  // Seed famous repos in background if not cached
  if (repoFetcher && repoAuditor && famousResults.length === 0) {
    seedFamousRepos();
  }
});

// ─── Famous Repo Seeder ─────────────────────────────────────────────────────

function seedFamousRepos() {
  console.log('Seeding famous repo audits in background...');
  var queue = FAMOUS_REPOS.slice();
  var results = [];

  function processNext() {
    if (queue.length === 0) {
      famousResults = results;
      try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(FAMOUS_FILE, JSON.stringify(results), 'utf8');
      } catch(e) {}
      console.log('✓ Famous repo seeding complete (' + results.length + ' repos)');
      return;
    }
    var repo = queue.shift();
    console.log('  Seeding ' + repo + '...');
    repoFetcher.fetchRepo(repo, { maxFiles: 10 }).then(function(repoData) {
      return repoAuditor.analyzeRepo(repoData, function() {});
    }).then(function(result) {
      results.push({ repo: repo, full_name: result.metadata.full_name, language: result.metadata.language, stars: result.metadata.stars, scores: result.scores, findings_count: result.statistics?.findings_count || 0 });
      // Also cache for badge
      auditCache.set(repo, { result: result, repoUrl: repo, timestamp: Date.now() });
      console.log('  ✓ ' + repo + ' — overall: ' + (result.scores?.overall || '?'));
      setTimeout(processNext, 1000);
    }).catch(function(e) {
      console.warn('  ✗ ' + repo + ' failed: ' + e.message.slice(0, 100));
      results.push({ repo: repo, full_name: repo, error: e.message.slice(0, 100) });
      setTimeout(processNext, 1000);
    });
  }

  processNext();
}
