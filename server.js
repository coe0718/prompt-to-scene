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
 *   NVIDIA_API_KEY       — for kimi-k2.5-nim (Kimi track)
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
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

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

// ─── Require project modules ───────────────────────────────────────────────

let director, p5jsGen, asciiGen, stitcher;

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
  stitcher = require('./sync/stitcher.js');
} catch(e) {
  console.warn('Stitcher not available:', e.message);
  stitcher = null;
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
  if (url.pathname === '/api/generate/stitch' && method === 'POST') {
    return handleGenerateOutput(req, res, 'stitch');
  }
  if (url.pathname === '/api/batch' && method === 'POST') {
    return handleBatch(req, res);
  }

  // ── Static files ──
  if (url.pathname === '/' || url.pathname === '/index.html') {
    return serveFile(res, path.join(ROOT, 'ui', 'index.html'));
  }
  // ui/ prefix
  if (url.pathname.startsWith('/ui/')) {
    const filePath = path.join(ROOT, url.pathname.slice(1));
    return serveFile(res, filePath);
  }
  // Test scenes
  if (url.pathname.startsWith('/test-')) {
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

async function handleGenerateP5JSEnhanced(req, res) {
  if (!enhancedTemplate) {
    // Fall back to old generator
    return handleGenerateOutput(req, res, 'p5js');
  }

  const body = await readBody(req);
  const spec = body.spec || body;

  // Inject spec into template via body data-spec attribute
  const specJSON = JSON.stringify(spec).replace(/'/g, "\\'");
  const html = enhancedTemplate.replace(
    '<body>',
    '<body data-spec=\'' + specJSON + '\'>'
  );

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
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
  console.log('  POST /api/generate         → Director agent (LLM)');
  console.log('  POST /api/generate/p5js    → p5.js HTML');
  console.log('  POST /api/generate/ascii   → ASCII HTML');
  console.log('  POST /api/generate/stitch  → Stitcher HTML');
  console.log('');
  if (!director) console.warn('⚠ Director agent NOT loaded — LLM calls will fail.');
  else console.log('✓ Director agent ready');
  if (!p5jsGen) console.warn('⚠ p5js generator NOT loaded');
  else console.log('✓ p5js generator ready');
  if (!asciiGen) console.warn('⚠ ASCII generator NOT loaded');
  else console.log('✓ ASCII generator ready');
  if (!stitcher) console.warn('⚠ Stitcher NOT loaded');
  else console.log('✓ Stitcher ready');
  console.log('');
});
