/**
 * ASCII Engine
 *
 * Generates a self-contained HTML file with pure ASCII art animation.
 * No external dependencies — just a <pre> tag and vanilla JavaScript.
 *
 * Usage:
 *   node ascii-engine.js path/to/scene-spec.json > ascii-scene.html
 *   node ascii-engine.js path/to/scene-spec.json --output ascii-scene.html
 *
 * Consumes: visual.style, visual.ascii_char_set, visual.effects, timing.beat_interval_ms
 * Outputs: standalone HTML file with ASCII animation
 */

const fs = require('fs');

// ─── ASCII styles ──────────────────────────────────────────────────────────

const ASCII_STYLES = ['landscape', 'abstract', 'matrix', 'tunnel', 'bars', 'glyphs'];

const CHAR_SETS = {
  standard: ' .:-=+*#%@',
  blocks:   ' ░▒▓█',
  detailed: " .'`^,:;Il!i><~+_-?][}{1)(|\\\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  matrix:   'ｦｧｨｩｪｫｬｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾝ0123456789',
  hex:      '0123456789ABCDEF ',
  braille:  ' ⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠠⠡⠢⠣⠤⠥⠦⠧⠨⠩⠪⠫⠬⠭⠮⠯⠰⠱⠲⠳⠴⠵⠶⠷⠸⠹⠺⠻⠼⠽⠾⠿',
};

// ─── Color themes ──────────────────────────────────────────────────────────

const THEMES = {
  green:   { bg: '#0a0a0a', fg: '#00ff41', dim: '#003300', accent: '#00cc33', name: 'Phosphor Green' },
  amber:   { bg: '#0a0800', fg: '#ffb000', dim: '#332200', accent: '#ff8c00', name: 'Amber CRT' },
  white:   { bg: '#0a0a0a', fg: '#e0e0e0', dim: '#333333', accent: '#ffffff', name: 'White Mono' },
  cyan:    { bg: '#000a0f', fg: '#00d4ff', dim: '#002233', accent: '#00ffff', name: 'Cyan Terminal' },
  matrix:  { bg: '#000000', fg: '#00ff41', dim: '#0a2a0a', accent: '#00ff88', name: 'Matrix' },
  synth:   { bg: '#0a0014', fg: '#ff00ff', dim: '#1a0033', accent: '#ff66ff', name: 'Synthwave' },
};

// ─── Helper ────────────────────────────────────────────────────────────────

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ─── HTML builder ──────────────────────────────────────────────────────────

function buildHTML(spec) {
  const visual   = spec.visual  || {};
  const scene    = spec.scene   || {};
  const timing   = spec.timing  || {};
  const metadata = spec.metadata || {};

  const mood      = scene.mood        || 'dark';
  const duration  = scene.duration_seconds || 45;
  const tempo     = scene.tempo        || 120;
  const beatMs    = timing.beat_interval_ms || Math.round(60000 / tempo);
  const sectionList = timing.sections || [];
  const keyMoments  = timing.key_moments || [];
  const intensity = visual.intensity  ?? 0.5;
  const charSet   = visual.ascii_char_set || 'standard';
  const effects   = visual.effects    || [];
  const cols      = visual.resolution?.width  || 80;
  const rows      = visual.resolution?.height || 40;

  const durationDisplay = fmtTime(duration);

  // Pick theme based on mood
  const themeMap = {
    dark: 'green', melancholic: 'cyan', energetic: 'amber',
    calm: 'white', chaotic: 'synth', uplifting: 'matrix',
    meditative: 'cyan', nostalgic: 'amber',
  };
  const theme = THEMES[themeMap[mood] || 'green'];

  // Select char set
  const chars = CHAR_SETS[charSet] || CHAR_SETS.standard;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${scene.name || 'Scene'} — ASCII Engine</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: ${theme.bg};
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 100vh; font-family: 'Courier New', 'Fira Code', 'Consolas', monospace;
    }
    #frame {
      color: ${theme.fg};
      font-size: 14px;
      line-height: 1.15;
      white-space: pre;
      text-align: center;
      padding: 20px;
      min-height: 70vh;
      display: flex; align-items: center; justify-content: center;
    }
    #hud {
      position: fixed; bottom: 0; left: 0; right: 0;
      padding: 10px 20px;
      color: ${theme.dim};
      font-family: 'Courier New', monospace; font-size: 12px;
      background: linear-gradient(transparent, ${theme.bg});
      display: flex; justify-content: space-between;
    }
    .scanlines {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 2px,
        rgba(0,0,0,0.03) 2px,
        rgba(0,0,0,0.03) 4px
      );
      pointer-events: none; z-index: 10;
    }
    .vignette {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.4) 100%);
      pointer-events: none; z-index: 11;
    }
  </style>
</head>
<body>
<div id="frame"></div>
<div id="hud">
  <span>${scene.name || 'scene'} · ${mood} · ${tempo}BPM</span>
  <span>1-${ASCII_STYLES.length}:style &nbsp;P:pause &nbsp;R:reset &nbsp;←→:theme</span>
  <span id="hud-time">0:00 / ${durationDisplay}</span>
</div>
<div class="scanlines"></div>
<div class="vignette"></div>
<script>
// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const COLS = ${cols};
const ROWS = ${rows};
const DURATION = ${duration};
const BEAT_MS = ${beatMs};
const TEMPO = ${tempo};
const INTENSITY = ${intensity};
const SECTIONS = ${JSON.stringify(sectionList)};
const KEY_MOMENTS = ${JSON.stringify(keyMoments)};
const EFFECTS = ${JSON.stringify(effects)};
const CHARS = ${JSON.stringify(chars)};
const THEMES = ${JSON.stringify(THEMES)};
const STYLE_NAMES = ${JSON.stringify(ASCII_STYLES)};
const THEME_NAMES = Object.keys(THEMES);

let currentTheme = '${themeMap[mood] || 'green'}';
let currentStyle = 0; // index into STYLE_NAMES
let startTime, paused = false, pauseOffset = 0;
let frameBuffer = new Array(ROWS * COLS).fill(' ');

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════

const el = document.getElementById('frame');
const hudTime = document.getElementById('hud-time');
startTime = Date.now();

function tick() {
  if (!paused) {
    const t = ((Date.now() - startTime) / 1000) % DURATION;
    const progress = t / DURATION;
    const beat = Math.floor((t * 1000) / BEAT_MS);

    // Fill frame buffer
    switch (STYLE_NAMES[currentStyle]) {
      case 'landscape': renderLandscape(t, progress, beat); break;
      case 'abstract':  renderAbstract(t, progress, beat); break;
      case 'matrix':    renderMatrix(t, progress, beat); break;
      case 'tunnel':    renderTunnel(t, progress, beat); break;
      case 'bars':      renderBars(t, progress, beat); break;
      case 'glyphs':    renderGlyphs(t, progress, beat); break;
      default:          renderAbstract(t, progress, beat);
    }

    // Apply effects before display
    applyEffects();

    // Convert buffer to string
    let out = '';
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        out += frameBuffer[y * COLS + x];
      }
      if (y < ROWS - 1) out += '\\n';
    }
    el.textContent = out;
    el.style.color = THEMES[currentTheme].fg;

    // HUD
    hudTime.textContent = fmtTime(t) + ' / ' + fmtTime(DURATION);
    document.getElementById('hud').style.color = THEMES[currentTheme].dim;
  }
  requestAnimationFrame(tick);
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDERERS
// ═══════════════════════════════════════════════════════════════════════════

// Simple seeded random
let rngState = 1;
function rng() {
  rngState = (rngState * 16807) % 2147483647;
  return (rngState - 1) / 2147483646;
}

function charAt(brightness) {
  const idx = Math.floor(brightness * (CHARS.length - 1));
  return CHARS[Math.min(idx, CHARS.length - 1)] || ' ';
}

// ── Landscape ───────────────────────────────────────────────────────────

function renderLandscape(t, p, beat) {
  const speed = 0.4 * INTENSITY;
  const sectionName = getCurrentSection(beat);

  for (let y = 0; y < ROWS; y++) {
    const horizon = ROWS * 0.45 + Math.sin(t * 0.2) * (ROWS * 0.05);
    const isSky = y < horizon;

    for (let x = 0; x < COLS; x++) {
      if (isSky) {
        // Stars / sky
        const starDensity = y < horizon * 0.3 ? 0.03 : 0.01;
        const star = pseudoRandom(x * 1000 + y * 300 + Math.floor(t)) > 1 - starDensity;
        const cloud = noise2D(x * 0.08, y * 0.1 + t * 0.1) > 0.6;
        if (star) frameBuffer[y * COLS + x] = y < horizon * 0.2 ? '*' : '.';
        else if (cloud) frameBuffer[y * COLS + x] = charAt(0.3 + noise2D(x * 0.1, t * 0.05) * 0.3);
        else frameBuffer[y * COLS + x] = ' ';
      } else {
        // Ground
        const h = Math.abs(y - horizon) / (ROWS - horizon);
        const terrain = noise2D(x * 0.06 + t * speed, y * 0.07) * 1.5;
        const val = 0.2 + terrain * (1 - h * 0.6);
        frameBuffer[y * COLS + x] = charAt(Math.min(1, val));
      }
    }
  }

  // Add moon/sun
  const mx = Math.floor(COLS * 0.75 + Math.sin(t * 0.15) * COLS * 0.1);
  const my = Math.floor(ROWS * 0.15);
  drawCircle(mx, my, 4, '*');
  drawCircle(mx, my, 3, '@');

  // Section label
  const label = sectionName.toUpperCase();
  const lx = Math.floor(COLS / 2 - label.length / 2);
  for (let i = 0; i < label.length; i++) {
    setChar(lx + i, ROWS - 2, label[i]);
  }
}

// ── Abstract ────────────────────────────────────────────────────────────

function renderAbstract(t, p, beat) {
  const beatPhase = ((beat % 4) / 4);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const nx = x * 0.04;
      const ny = y * 0.06;
      const nz1 = t * 0.3;
      const nz2 = t * 0.5 + 100;
      const n1 = noise2D(nx + nz1, ny + Math.sin(nz1) * 0.3);
      const n2 = noise2D(nx + nz2, ny * 1.5, nz2);
      const val = n1 * 0.7 + n2 * 0.3 + beatPhase * 0.1;
      frameBuffer[y * COLS + x] = charAt(Math.min(1, val * 1.2));
    }
  }
}

// ── Matrix ──────────────────────────────────────────────────────────────

const matrixDrops = [];

function initMatrix() {
  matrixDrops.length = 0;
  for (let x = 0; x < COLS; x++) {
    matrixDrops.push({ x, y: Math.floor(rng() * ROWS), speed: 0.5 + rng() * 2 * INTENSITY, len: 3 + Math.floor(rng() * 15) });
  }
}
initMatrix();

function renderMatrix(t, p, beat) {
  // Clear to background
  for (let i = 0; i < frameBuffer.length; i++) frameBuffer[i] = ' ';

  for (const drop of matrixDrops) {
    for (let dy = 0; dy < drop.len; dy++) {
      const cy = Math.floor(drop.y - dy);
      if (cy >= 0 && cy < ROWS) {
        const bright = 1 - (dy / drop.len);
        const idx = cy * COLS + drop.x;
        const existing = frameBuffer[idx];
        // Only overwrite if brighter
        if (existing === ' ' || bright > 0.5) {
          frameBuffer[idx] = charAt(bright);
        }
      }
    }
    // Head bright
    const hy = Math.floor(drop.y);
    if (hy >= 0 && hy < ROWS) {
      frameBuffer[hy * COLS + drop.x] = '#';
    }

    drop.y += drop.speed * 0.3;
    if (drop.y - drop.len > ROWS) {
      drop.y = -drop.len;
      drop.speed = 0.5 + rng() * 2 * INTENSITY;
    }
  }
}

// ── Tunnel ──────────────────────────────────────────────────────────────

function renderTunnel(t, p, beat) {
  const cx = COLS / 2;
  const cy = ROWS / 2;
  const rotation = t * 0.5;
  const depth = 1 + Math.sin(t * 0.3) * 0.5;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      if (dist < 0.05) {
        frameBuffer[y * COLS + x] = '@';
      } else if (dist < 1) {
        const rings = 6;
        const ringVal = Math.sin(dist * rings * Math.PI * depth + rotation * 2) * 0.5 + 0.5;
        const angleVal = Math.sin(angle * 8 + rotation) * 0.5 + 0.5;
        const val = ringVal * 0.6 + angleVal * 0.3 + (1 - dist) * 0.1;
        frameBuffer[y * COLS + x] = charAt(Math.min(1, val));
      } else {
        frameBuffer[y * COLS + x] = ' ';
      }
    }
  }
}

// ── Bars (audio visualizer style) ───────────────────────────────────────

function renderBars(t, p, beat) {
  const numBars = 32;
  const barW = Math.floor(COLS / numBars);
  const beatPhase = ((beat % 4) / 4);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const barIdx = Math.floor(x / barW);
      if (barIdx >= numBars) { frameBuffer[y * COLS + x] = ' '; continue; }

      // Generate bar height
      const freq = (barIdx / numBars) * 6 + 0.5;
      const baseVal = Math.abs(Math.sin(t * freq * 2 + barIdx * 0.3));
      const beatBoost = barIdx < numBars / 4 ? beatPhase * 2 : 0;
      const barH = (baseVal * 0.7 + beatBoost * 0.3) * INTENSITY;

      const normalizedY = 1 - (y / ROWS);
      const barTop = ROWS * (1 - barH);

      if (y >= barTop) {
        const val = (y - barTop) / (ROWS - barTop);
        frameBuffer[y * COLS + x] = charAt(1 - val * 0.7);
      } else {
        frameBuffer[y * COLS + x] = ' ';
      }
    }
  }

  // Section label at bottom
  const label = getCurrentSection(beat).toUpperCase();
  const lx = Math.floor(COLS / 2 - label.length / 2);
  for (let i = 0; i < label.length; i++) setChar(lx + i, ROWS - 2, label[i]);
}

// ── Glyphs ──────────────────────────────────────────────────────────────

const glyphs = ['◈','◇','◆','◉','◎','●','○','◐','◑','◒','◓','◔','◕','◖','◗','◘','◙','◚','◛','◜','◝','◞','◟','◠','◡','◢','◣','◤','◥','✦','✧','✶','✷','✸','✹','✺'];

function renderGlyphs(t, p, beat) {
  const glyphCount = Math.floor(15 + INTENSITY * 30);

  for (let i = 0; i < frameBuffer.length; i++) frameBuffer[i] = ' ';

  for (let g = 0; g < glyphCount; g++) {
    // Use deterministic positions based on t + seed
    const gx = Math.floor(pseudoRandom(g * 10 + Math.floor(t * 2)) * COLS);
    const gy = Math.floor(pseudoRandom(g * 20 + Math.floor(t * 3) + 500) * ROWS);
    const gi = Math.floor(pseudoRandom(g * 30 + Math.floor(t)) * glyphs.length);

    if (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) {
      frameBuffer[gy * COLS + gx] = glyphs[gi];
    }

    // Trails
    if (rng() > 0.3) {
      const tx = gx + Math.floor(rng() * 3 - 1);
      const ty = gy + Math.floor(rng() * 3 - 1);
      if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS) {
        frameBuffer[ty * COLS + tx] = '·';
      }
    }
  }

  // Connecting lines between nearby glyphs
  if (INTENSITY > 0.4) {
    // Occasional connections
    for (let c = 0; c < 5; c++) {
      const x1 = Math.floor(rng() * COLS);
      const y1 = Math.floor(rng() * ROWS);
      const x2 = Math.floor(rng() * COLS);
      const y2 = Math.floor(rng() * ROWS);
      drawLine(x1, y1, x2, y2, '·');
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

function applyEffects() {
  if (EFFECTS.includes('noise')) {
    const amount = Math.floor(INTENSITY * 5);
    for (let i = 0; i < amount; i++) {
      const rx = Math.floor(rng() * COLS);
      const ry = Math.floor(rng() * ROWS);
      frameBuffer[ry * COLS + rx] = CHARS[Math.floor(rng() * CHARS.length)];
    }
  }
  if (EFFECTS.includes('glitch') && rng() > 0.9) {
    // Horizontal glitch strips
    const gy = Math.floor(rng() * ROWS);
    const gh = 1 + Math.floor(rng() * 3);
    const shift = Math.floor(rng() * 6 - 3);
    for (let y = gy; y < Math.min(gy + gh, ROWS); y++) {
      const row = frameBuffer.slice(y * COLS, (y + 1) * COLS);
      for (let x = 0; x < COLS; x++) {
        const sx = (x - shift + COLS) % COLS;
        frameBuffer[y * COLS + x] = row[sx];
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════════

function pseudoRandom(seed) {
  let s = seed;
  s = (s * 16807) % 2147483647;
  return (s - 1) / 2147483646;
}

// Simple 2D noise (value noise with interpolation)
const noiseCache = {};
function noise2D(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z || 0);
  const key = ix + ',' + iy + ',' + iz;
  if (noiseCache[key] !== undefined) return noiseCache[key];

  const fx = x - ix;
  const fy = y - iy;

  // Hash corners
  function hash(ax, ay) {
    const h = (ax * 374761393 + ay * 668265263 + iz * 19260817) & 0x7fffffff;
    return (h % 10000) / 10000;
  }

  const v00 = hash(ix, iy);
  const v10 = hash(ix + 1, iy);
  const v01 = hash(ix, iy + 1);
  const v11 = hash(ix + 1, iy + 1);

  // Smooth interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const val = v00 * (1 - sx) * (1 - sy) + v10 * sx * (1 - sy) + v01 * (1 - sx) * sy + v11 * sx * sy;

  // Cache with LRU-ish cleanup
  noiseCache[key] = val;
  if (Object.keys(noiseCache).length > 5000) {
    const keys = Object.keys(noiseCache);
    delete noiseCache[keys[0]];
  }

  return val;
}

function drawCircle(cx, cy, r, ch) {
  for (let y = Math.max(0, cy - r); y <= Math.min(ROWS - 1, cy + r); y++) {
    for (let x = Math.max(0, cx - r); x <= Math.min(COLS - 1, cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        frameBuffer[y * COLS + x] = ch;
      }
    }
  }
}

function drawLine(x1, y1, x2, y2, ch) {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1, y = y1;
  while (true) {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
      frameBuffer[y * COLS + x] = ch;
    }
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx)  { err += dx; y += sy; }
  }
}

function setChar(x, y, ch) {
  if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
    frameBuffer[y * COLS + x] = ch;
  }
}

function getCurrentSection(beat) {
  for (const sec of SECTIONS) {
    if (beat >= sec.start_beat && beat < sec.end_beat) return sec.name;
  }
  return '';
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARD
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'p') {
    e.preventDefault();
    paused = !paused;
    if (!paused) {
      startTime = Date.now() - pauseOffset;
    } else {
      pauseOffset = Date.now() - startTime;
    }
    return;
  }

  // Style switching (1-6)
  const n = parseInt(e.key);
  if (n >= 1 && n <= STYLE_NAMES.length) {
    currentStyle = n - 1;
    if (n === 3) initMatrix();
    return;
  }

  // Theme switching
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const idx = THEME_NAMES.indexOf(currentTheme);
    const next = e.key === 'ArrowRight'
      ? (idx + 1) % THEME_NAMES.length
      : (idx - 1 + THEME_NAMES.length) % THEME_NAMES.length;
    currentTheme = THEME_NAMES[next];
    return;
  }

  // Reset
  if (e.key === 'r' || e.key === 'R') {
    startTime = Date.now();
    pauseOffset = 0;
    if (paused) { paused = false; }
    return;
  }
});

// Start
tick();
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('ascii-engine.js — Generate ASCII art animations from Director scene specs');
    console.error('');
    console.error('Usage:');
    console.error('  node ascii-engine.js <scene-spec.json>');
    console.error('  node ascii-engine.js <scene-spec.json> --output ascii-scene.html');
    console.error('');
    console.error('Output: self-contained HTML file with pure ASCII animation (no p5.js)');
    process.exit(1);
  }

  let spec;
  const input = args[0];

  try {
    spec = JSON.parse(input);
  } catch {
    try {
      spec = JSON.parse(fs.readFileSync(input, 'utf8'));
    } catch (e) {
      console.error(`Error: Could not parse input: ${input}`);
      process.exit(1);
    }
  }

  const html = buildHTML(spec);

  const outIdx = args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) {
    fs.writeFileSync(args[outIdx + 1], html);
    console.error(`Written to: ${args[outIdx + 1]}`);
  } else {
    console.log(html);
  }
}

module.exports = { buildHTML };
