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

const PORT = parseInt(process.env.PORT || process.argv[3] || '3000', 10);
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
    return handleGenerateOutput(req, res, 'p5js');
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

  if (!prompt || prompt.length < 2) {
    return jsonResponse(res, 400, { error: 'Prompt too short (min 2 chars)' });
  }

  if (!director) {
    return jsonResponse(res, 503, { error: 'Director agent not available (missing API keys?)' });
  }

  try {
    const spec = await director.generateSpec(prompt, {
      duration: body.duration || 45,
      model: body.model || undefined,
    });
    console.log(`Generated: "${spec.scene?.name}" — ${spec.scene?.mood}, ${spec.scene?.tempo}BPM`);
    jsonResponse(res, 200, spec);
  } catch(e) {
    console.error('Director error:', e.message);
    jsonResponse(res, 500, { error: e.message });
  }
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
      if (!director) {
        errors.push({ index: i, prompt, error: 'Director not available' });
        continue;
      }
      const spec = await director.generateSpec(prompt, { duration });
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
