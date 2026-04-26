/**
 * p5.js Scene Generator
 *
 * Generates a self-contained HTML file with an embedded p5.js sketch
 * that visualizes a Director scene spec.
 *
 * Usage:
 *   node p5js-scene.js path/to/scene-spec.json > scene.html
 *   node p5js-scene.js path/to/scene-spec.json --output scene.html
 *
 * Consumes: visual.*, scene.mood, timing.*, timing.beat_interval_ms
 * Outputs: standalone HTML file with p5.js visualization
 */

const fs = require('fs');

// ─── Mood-to-palette defaults ────────────────────────────────────────────────

const MOOD_PALETTES = {
  energetic:     ['#ff3366','#ffcc00','#00ff88','#ffffff','#1a1a2e'],
  calm:          ['#a8e6cf','#dcedc1','#ffd3b6','#ffaaa5','#457b9d'],
  dark:          ['#0a0a0a','#1a1a2e','#e94560','#16213e','#0f3460'],
  uplifting:     ['#ffe66d','#4ecdc4','#ff6b6b','#ffffff','#292f36'],
  melancholic:   ['#2c3e50','#34495e','#7f8c8d','#bdc3c7','#ecf0f1'],
  chaotic:       ['#ff0000','#00ffff','#ffff00','#ff00ff','#000000'],
  meditative:    ['#1a1a2e','#16213e','#0f3460','#533483','#e94560'],
  nostalgic:     ['#f4a261','#e76f51','#264653','#2a9d8f','#e9c46a'],
};

const ASCII_CHAR_SETS = {
  standard: ' .:-=+*#%@',
  blocks:   ' ░▒▓█',
  detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
};

// ─── HTML template ──────────────────────────────────────────────────────────

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function buildHTML(spec) {
  const visual   = spec.visual  || {};
  const scene    = spec.scene   || {};
  const timing   = spec.timing  || {};
  const audio    = spec.audio   || {};
  const metadata = spec.metadata || {};
  const prompt   = JSON.stringify(spec.prompt || '');

  const mood      = scene.mood        || 'dark';
  const style     = visual.style      || 'geometric';
  const palette   = visual.color_palette && visual.color_palette.length >= 2
                      ? visual.color_palette
                      : MOOD_PALETTES[mood] || MOOD_PALETTES.dark;
  const effects   = visual.effects    || [];
  const intensity = visual.intensity  ?? 0.5;
  const charSet   = visual.ascii_char_set || 'standard';
  const res       = visual.resolution || { width: 1920, height: 1080 };
  const tempo     = scene.tempo        || 120;
  const duration  = scene.duration_seconds || 45;
  const durationDisplay = fmtTime(duration);
  const beatMs    = timing.beat_interval_ms || Math.round(60000 / tempo);
  const sections  = timing.sections   || [];
  const keyMoments= timing.key_moments|| [];
  const audioUrl  = ''; // could be populated from suno output

  const paletteJSON  = JSON.stringify(palette);
  const effectsJSON  = JSON.stringify(effects);
  const sectionsJSON = JSON.stringify(sections);
  const keyMomJSON   = JSON.stringify(keyMoments);
  const asciiChars   = ASCII_CHAR_SETS[charSet] || ASCII_CHAR_SETS.standard;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${scene.name || 'Scene'} — Prompt-to-Scene</title>
  <script>p5.disableFriendlyErrors = true;</script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/2.0.5/p5.min.js"></script>
  <script src="https://unpkg.com/p5.sound@0.3.0/dist/p5.sound.min.js"></script>
  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; background: #000; }
    canvas { display: block; }
    #hud {
      position: fixed; bottom: 0; left: 0; right: 0;
      padding: 12px 20px;
      font-family: 'Courier New', monospace; font-size: 13px;
      color: rgba(255,255,255,0.7);
      background: linear-gradient(transparent, rgba(0,0,0,0.8));
      display: flex; justify-content: space-between; align-items: center;
      z-index: 10; pointer-events: none;
    }
    #hud .left { display: flex; gap: 16px; }
    #hud .prompt { max-width: 40%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
<div id="hud">
  <div class="left">
    <span id="hud-scene">${scene.name || 'scene'}</span>
    <span id="hud-style">${style}</span>
    <span id="hud-section">—</span>
  </div>
  <div>
    <span id="hud-time">0:00</span> / <span>${durationDisplay}</span>
    &nbsp;·&nbsp; <span id="hud-beat">0</span>b
    &nbsp;·&nbsp; ${tempo}BPM
    &nbsp;·&nbsp; <span style="opacity:0.4;font-size:11px">1-8:style S:save P:pause</span>
  </div>
</div>
<script>
// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION (injected by generator)
// ═══════════════════════════════════════════════════════════════════════════

const SCENE = {
  name:      ${JSON.stringify(scene.name)},
  mood:      ${JSON.stringify(mood)},
  tempo:     ${tempo},
  duration:  ${duration},
  genre:     ${JSON.stringify(scene.genre)},
  prompt:    ${prompt},
};

const VISUAL = {
  style:       ${JSON.stringify(style)},
  palette:     ${paletteJSON},
  effects:     ${effectsJSON},
  intensity:   ${intensity},
  charSet:     ${JSON.stringify(charSet)},
  asciiChars:  ${JSON.stringify(asciiChars)},
};

const TIMING = {
  beatIntervalMs: ${beatMs},
  barLengthBeats: ${timing.bar_length_beats || 4},
  sections:       ${sectionsJSON},
  keyMoments:     ${keyMomJSON},
};

const HAS_EFFECT = {
  scanlines:  ${effects.includes('scanlines')},
  noise:      ${effects.includes('noise')},
  bloom:      ${effects.includes('bloom')},
  chromatic:  ${effects.includes('chromatic')},
  vignette:   ${effects.includes('vignette')},
  drift:      ${effects.includes('drift')},
};

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════════

let offscreen;   // main offscreen buffer
let fxLayer;     // post-processing layer
let bgLayer;     // persistent background
let particles = [];
let startTime;
let currentSection = '';
let sectionProgress = 0;
let globalBeat = 0;
let asciiGraphics;
let lastBeatPulse = 0;

// Waveform data (simulated if no audio)
let waveformData = new Array(64).fill(0);

// ═══════════════════════════════════════════════════════════════════════════
// P5 SETUP
// ═══════════════════════════════════════════════════════════════════════════

function setup() {
  const w = windowWidth;
  const h = windowHeight;
  createCanvas(w, h);
  pixelDensity(1);

  colorMode(HSB, 360, 100, 100, 100);

  offscreen = createGraphics(w, h);
  fxLayer   = createGraphics(w, h);
  bgLayer   = createGraphics(w, h);
  asciiGraphics = createGraphics(
    VISUAL.style === 'ascii' ? 120 : 80,
    VISUAL.style === 'ascii' ? 60  : 40
  );
  asciiGraphics.pixelDensity(1);

  // Convert hex palette to HSB for easy manipulation
  window._palHSB = VISUAL.palette.map(hexToHSB);

  // Seed with scene name for reproducibility
  const seed = SCENE.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  randomSeed(seed);
  noiseSeed(seed);

  // Initialize style-specific state
  if (VISUAL.style === 'particles') {
    initParticles(300);
  }
  if (VISUAL.style === 'organic') {
    initOrganic();
  }

  startTime = millis();
  renderBackground(bgLayer);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  offscreen = createGraphics(windowWidth, windowHeight);
  fxLayer   = createGraphics(windowWidth, windowHeight);
  bgLayer   = createGraphics(windowWidth, windowHeight);
  renderBackground(bgLayer);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DRAW LOOP
// ═══════════════════════════════════════════════════════════════════════════

function draw() {
  const elapsed  = (millis() - startTime) / 1000;
  const looped   = elapsed % SCENE.duration;
  const progress = looped / SCENE.duration;

  globalBeat = Math.floor((looped * 1000) / TIMING.beatIntervalMs);

  // Determine current section
  updateSection(globalBeat);

  // Update beat-synced waveform (simulated)
  updateWaveform(looped);

  // Clear offscreen
  offscreen.clear();

  // ── Render current visual style ──
  switch (VISUAL.style) {
    case 'ascii':
      drawAscii(offscreen, looped, progress);
      break;
    case 'geometric':
      drawGeometric(offscreen, looped, progress);
      break;
    case 'particles':
      drawParticles(offscreen, looped, progress);
      break;
    case 'waveform':
      drawWaveform(offscreen, looped, progress);
      break;
    case 'glitch':
      drawGlitch(offscreen, looped, progress);
      break;
    case 'minimal':
      drawMinimal(offscreen, looped, progress);
      break;
    case 'retro':
      drawRetro(offscreen, looped, progress);
      break;
    case 'organic':
      drawOrganic(offscreen, looped, progress);
      break;
    default:
      drawGeometric(offscreen, looped, progress);
  }

  // ── Apply post-processing effects ──
  fxLayer.clear();
  fxLayer.image(offscreen, 0, 0, width, height);

  if (HAS_EFFECT.scanlines)  applyScanlines(fxLayer);
  if (HAS_EFFECT.noise)      applyNoise(fxLayer, progress);
  if (HAS_EFFECT.bloom)      applyBloom(fxLayer);
  if (HAS_EFFECT.chromatic)  applyChromatic(fxLayer);
  if (HAS_EFFECT.vignette)   applyVignette(fxLayer);
  if (HAS_EFFECT.drift)      applyDrift(fxLayer, looped);

  // Render to main canvas
  image(fxLayer, 0, 0);

  // Beat pulse flash on key moments
  checkKeyMoments(globalBeat);

  // HUD update
  updateHUD(looped, globalBeat);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION TRACKING
// ═══════════════════════════════════════════════════════════════════════════

function updateSection(beat) {
  if (!TIMING.sections.length) {
    currentSection = SCENE.mood;
    sectionProgress = 0;
    return;
  }
  for (const sec of TIMING.sections) {
    if (beat >= sec.start_beat && beat < sec.end_beat) {
      currentSection = sec.name;
      sectionProgress = (beat - sec.start_beat) / (sec.end_beat - sec.start_beat);
      return;
    }
  }
  currentSection = TIMING.sections[TIMING.sections.length - 1]?.name || '';
  sectionProgress = 1;
}

function checkKeyMoments(beat) {
  for (const km of TIMING.keyMoments) {
    if (beat === km.beat || (beat > 0 && beat % 16 === 0)) {
      lastBeatPulse = 1.0;
    }
  }
  lastBeatPulse *= 0.92;
}

// ═══════════════════════════════════════════════════════════════════════════
// WAVEFORM SIMULATION
// ═══════════════════════════════════════════════════════════════════════════

function updateWaveform(t) {
  const beatPhase = (t * 1000 / TIMING.beatIntervalMs) % 1;
  const bassBoost = sectionProgress < 0.2 ? 2.0
    : sectionProgress > 0.8 ? 1.2
    : 1.0;

  for (let i = 0; i < waveformData.length; i++) {
    const freq = (i / waveformData.length) * 8 + 0.5;
    const base  = Math.sin(t * freq * 2 + i * 0.3) * 0.5 + 0.5;
    const beat  = Math.abs(Math.sin(beatPhase * Math.PI)) * (i < 8 ? bassBoost : 0.3);
    let val = base * (0.2 + VISUAL.intensity * 0.8) + beat;
    // Spectral rolloff
    val *= 1 - (i / waveformData.length) * 0.7;
    waveformData[i] += (val - waveformData[i]) * 0.15;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL STYLES
// ═══════════════════════════════════════════════════════════════════════════

// ── ASCII ──────────────────────────────────────────────────────────────────

function drawAscii(g, t, p) {
  const aw = asciiGraphics.width;
  const ah = asciiGraphics.height;

  // Render a dynamic scene to asciiGraphics
  asciiGraphics.colorMode(HSB, 360, 100, 100, 100);
  asciiGraphics.background(0, 0, 0);

  // Animated noise field
  asciiGraphics.loadPixels();
  for (let y = 0; y < ah; y++) {
    for (let x = 0; x < aw; x++) {
      const nx = x * 0.05;
      const ny = y * 0.05;
      const nz = t * 0.3;
      const val = noise(nx + nz * 0.2, ny + Math.sin(nz) * 0.3, nz);
      const hue = ((x / aw) * 60 + t * 30 + val * 120) % 360;
      const bri = val * 80 * VISUAL.intensity + 10;
      const idx = 4 * (y * aw + x);
      const c = color(hue, 70, bri);
      asciiGraphics.pixels[idx]     = red(c);
      asciiGraphics.pixels[idx + 1] = green(c);
      asciiGraphics.pixels[idx + 2] = blue(c);
      asciiGraphics.pixels[idx + 3] = 255;
    }
  }
  asciiGraphics.updatePixels();

  // Draw the ASCII buffer to main g
  g.background(0, 0, 5);
  g.noStroke();
  g.textAlign(CENTER, CENTER);

  const charW = g.width / aw;
  const charH = g.height / ah;
  const chars = VISUAL.asciiChars;
  g.textSize(charW * 1.2);

  asciiGraphics.loadPixels();
  for (let y = 0; y < ah; y++) {
    for (let x = 0; x < aw; x++) {
      const idx = 4 * (y * aw + x);
      const r = asciiGraphics.pixels[idx];
      const gv = asciiGraphics.pixels[idx + 1];
      const b = asciiGraphics.pixels[idx + 2];
      const brightness = (r + gv + b) / 3;
      const charIdx = Math.floor((brightness / 255) * (chars.length - 1));
      const ch = chars[charIdx] || ' ';

      const hCol = color(
        ((x / aw) * 60 + t * 30) % 360,
        60 + brightness * 0.15,
        40 + brightness * 0.25
      );
      g.fill(hCol);
      g.text(ch, x * charW + charW / 2, y * charH + charH / 2);
    }
  }
}

// ── GEOMETRIC ──────────────────────────────────────────────────────────────

function drawGeometric(g, t, p) {
  const cx = g.width / 2;
  const cy = g.height / 2;
  const pal = window._palHSB;

  // Dark gradient background
  for (let y = 0; y < g.height; y += 2) {
    const grad = (y / g.height);
    g.stroke(
      (pal[0]?.h || 240) + grad * 20,
      40,
      8 + grad * 12
    );
    g.strokeWeight(2);
    g.line(0, y, g.width, y);
  }

  // Pulsing central geometry
  const numShapes = 5;
  const baseRadius = Math.min(cx, cy) * 0.35;
  const pulse = Math.sin(t * 0.8) * 0.3 + 0.7;

  g.push();
  g.translate(cx, cy);
  g.rotate(t * 0.2);

  for (let i = 0; i < numShapes; i++) {
    const angle = (i / numShapes) * TWO_PI + t * 0.15;
    const r = baseRadius * (0.5 + i * 0.15) * pulse * VISUAL.intensity;

    g.push();
    g.rotate(angle);

    // Draw polygon
    const sides = 3 + i * 2;
    const h = pal[i % pal.length] || { h: (i * 50) % 360, s: 80, b: 90 };
    g.stroke(h.h, h.s, h.b, 70);
    g.strokeWeight(1.5 + i * 0.3);
    g.noFill();

    g.beginShape();
    for (let s = 0; s < sides; s++) {
      const sa = (s / sides) * TWO_PI;
      const sr = r + Math.sin(sa * 3 + t) * 20 * VISUAL.intensity;
      g.vertex(Math.cos(sa) * sr, Math.sin(sa) * sr);
    }
    g.endShape(CLOSE);

    // Connecting lines between vertices
    g.stroke(h.h, h.s, h.b, 20);
    g.strokeWeight(0.5);
    for (let s = 0; s < sides; s++) {
      const sa = (s / sides) * TWO_PI;
      const rad = r * 0.4;
      g.line(
        Math.cos(sa) * rad, Math.sin(sa) * rad,
        Math.cos(sa + TWO_PI / sides) * rad, Math.sin(sa + TWO_PI / sides) * rad
      );
    }
    g.pop();
  }

  // Orbiting dots
  g.fill(pal[0]?.h || 0, 30, 100);
  g.noStroke();
  const numDots = 12;
  for (let i = 0; i < numDots; i++) {
    const da = (i / numDots) * TWO_PI + t * 0.5;
    const dr = baseRadius * (1.1 + Math.sin(i * 0.7 + t) * 0.2);
    const ds = 3 + Math.sin(i + t * 2) * 2;
    g.circle(Math.cos(da) * dr, Math.sin(da) * dr, ds);
  }
  g.pop();

  // Beat-responsive corner accents
  const accentSize = 40 + lastBeatPulse * 20;
  g.noFill();
  g.stroke(pal[1]?.h || 180, pal[1]?.s || 70, pal[1]?.b || 80, 50);
  g.strokeWeight(1);
  g.line(accentSize, accentSize, accentSize, accentSize + 30);
  g.line(accentSize, accentSize, accentSize + 30, accentSize);
  g.line(g.width - accentSize, accentSize, g.width - accentSize, accentSize + 30);
  g.line(g.width - accentSize, accentSize, g.width - accentSize - 30, accentSize);
}

// ── PARTICLES ──────────────────────────────────────────────────────────────

function initParticles(count) {
  particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      vx: random(-1, 1),
      vy: random(-1, 1),
      hue: random(360),
      size: random(1, 4),
      life: random(0.3, 1),
      trail: [],
    });
  }
}

function drawParticles(g, t, p) {
  const pal = window._palHSB;

  // Dark base with subtle noise
  g.colorMode(HSB, 360, 100, 100, 100);
  g.background(0, 0, 4);

  // Flow field
  const speed = VISUAL.intensity * 0.8 + 0.2;
  const zone  = sectionProgress;
  const fieldStrength = 0.3 + zone * 0.7; // stronger in later sections

  for (const pt of particles) {
    // Flow field lookup
    const nx = pt.x * 0.003;
    const ny = pt.y * 0.003;
    const nz = t * 0.1;
    const angle = noise(nx, ny, nz) * TWO_PI * 4;

    // Attract toward center during build/drop
    const cx = width / 2;
    const cy = height / 2;
    const dx = cx - pt.x;
    const dy = cy - pt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const attract = zone > 0.3 && zone < 0.9 ? (dist > 1 ? (dx / dist) * 0.1 : 0) : 0;

    pt.vx += Math.cos(angle) * fieldStrength * 0.2 + attract;
    pt.vy += Math.sin(angle) * fieldStrength * 0.2 + attract;

    // Damping
    pt.vx *= 0.97;
    pt.vy *= 0.97;

    // Speed clamp
    const spd = Math.sqrt(pt.vx * pt.vx + pt.vy * pt.vy);
    if (spd > 4) {
      pt.vx *= 4 / spd;
      pt.vy *= 4 / spd;
    }

    pt.x += pt.vx * speed;
    pt.y += pt.vy * speed;

    // Wrap
    if (pt.x < 0) pt.x = width;
    if (pt.x > width) pt.x = 0;
    if (pt.y < 0) pt.y = height;
    if (pt.y > height) pt.y = 0;

    // Trail
    pt.trail.push({ x: pt.x, y: pt.y });
    if (pt.trail.length > 8) pt.trail.shift();
  }

  // Draw trails
  g.noFill();
  for (const pt of particles) {
    if (pt.trail.length < 2) continue;
    const h = pt.hue;
    for (let i = 1; i < pt.trail.length; i++) {
      const alpha = (i / pt.trail.length) * 60 * pt.life;
      g.stroke(h, 70, 90, alpha);
      g.strokeWeight(pt.size * (i / pt.trail.length));
      g.line(pt.trail[i - 1].x, pt.trail[i - 1].y, pt.trail[i].x, pt.trail[i].y);
    }
  }

  // Draw particle heads
  g.noStroke();
  for (const pt of particles) {
    const h = pt.hue;
    g.fill(h, 30, 100, 150);
    g.circle(pt.x, pt.y, pt.size * 2.5);
    // Bright core
    g.fill(h, 10, 100, 200);
    g.circle(pt.x, pt.y, pt.size);
  }

  // Attractor center glow
  if (sectionProgress > 0.3) {
    const glowAlpha = 15 + lastBeatPulse * 15;
    g.noStroke();
    for (let r = 100; r > 0; r -= 10) {
      const a = glowAlpha * (r / 100);
      g.fill(pal[0]?.h || 0, 30, 80, a);
      g.circle(width / 2, height / 2, r * 3);
    }
  }
}

// ── WAVEFORM ───────────────────────────────────────────────────────────────

function drawWaveform(g, t, p) {
  const pal = window._palHSB;

  // Deep background
  g.background(0, 0, 4);

  const cx = g.width / 2;
  const barW = g.width / waveformData.length;
  const maxH = g.height * 0.8;

  // Mirror: bottom half for reflection
  const baseY = g.height * 0.7;

  // Bars
  for (let i = 0; i < waveformData.length; i++) {
    const val = waveformData[i];
    const barH = val * maxH;
    const x = i * barW;
    const hue = ((i / waveformData.length) * 120 + t * 20) % 360;

    // Gradient bar
    const steps = Math.floor(barH / 4);
    for (let sy = 0; sy < steps; sy++) {
      const frac = sy / steps;
      const alpha = (1 - frac) * 80;
      const bright = 70 + frac * 30;
      g.fill(hue, 60, bright, alpha);
      g.noStroke();
      g.rect(x + 1, baseY - sy * 4, barW - 2, -4);
    }

    // Top glow
    g.fill(hue, 40, 100, 180);
    g.rect(x + 1, baseY - barH, barW - 2, 3);

    // Reflection
    g.fill(hue, 50, 30, 30);
    g.rect(x + 1, baseY + 2, barW - 2, barH * 0.3);
  }

  // Center line
  g.stroke(pal[0]?.h || 0, 20, 70, 50);
  g.strokeWeight(1);
  g.line(0, baseY, g.width, baseY);

  // Beat marker
  const beatPhase = (t * 1000 / TIMING.beatIntervalMs) % 1;
  g.fill(pal[0]?.h || 0, 10, 100, 150 * (1 - beatPhase));
  g.noStroke();
  g.circle(cx, baseY, 10 + beatPhase * 6);
}

// ── GLITCH ─────────────────────────────────────────────────────────────────

function drawGlitch(g, t, p) {
  const pal = window._palHSB;
  g.background(0, 0, 2);

  const cx = g.width / 2;
  const cy = g.height / 2;

  // Base geometric layer
  g.push();
  g.translate(cx, cy);
  g.rotate(t * 0.1);

  const rings = 8;
  for (let i = 0; i < rings; i++) {
    const r = 50 + i * 50 + Math.sin(t * 2 + i) * 15;
    const h = pal[i % pal.length] || { h: i * 40, s: 70, b: 80 };

    g.stroke(h.h, h.s, h.b, 40);
    g.strokeWeight(1 + Math.random() * 2);
    g.noFill();

    g.beginShape();
    const pts = 60;
    for (let j = 0; j <= pts; j++) {
      const angle = (j / pts) * TWO_PI;
      const noiseVal = noise(angle * 2, i * 0.3, t * 0.5) * 20;
      g.vertex(Math.cos(angle) * (r + noiseVal), Math.sin(angle) * (r + noiseVal));
    }
    g.endShape(CLOSE);
  }
  g.pop();

  // Glitch displacement strips
  const numStrips = Math.floor(8 + VISUAL.intensity * 12);
  for (let i = 0; i < numStrips; i++) {
    const y = random(g.height);
    const stripH = random(2, 30);
    const offsetX = random(-40, 40) * VISUAL.intensity;
    const srcX = random(g.width - Math.abs(offsetX));

    // Copy a horizontal strip with RGB shift
    g.push();
    g.blendMode(BLEND);
    const hueShift = random(20, 60) * (random() > 0.5 ? 1 : -1);
    g.fill((pal[0]?.h || 0) + hueShift, random(40, 80), random(60, 100), random(30, 80));
    g.noStroke();
    g.rect(srcX, y, random(100, 300), stripH);
    g.pop();
  }

  // Random character fragments
  if (frameCount % 3 === 0) {
    g.fill(pal[2]?.h || 0, 10, 100, 100);
    g.textAlign(LEFT, TOP);
    g.textSize(random(8, 24));
    const chars = '01▌▐▄▀■□▪▫●○◉◎';
    g.text(chars[Math.floor(random(chars.length))], random(g.width), random(g.height));
  }

  // CRT style horizontal lines
  for (let y = 0; y < g.height; y += 4) {
    g.stroke(0, 0, 0, 15);
    g.strokeWeight(1);
    g.line(0, y, g.width, y);
  }
}

// ── MINIMAL ────────────────────────────────────────────────────────────────

function drawMinimal(g, t, p) {
  const pal = window._palHSB;
  const bg = pal[0] || { h: 220, s: 20, b: 20 };

  // Subtle gradient background
  for (let y = 0; y < g.height; y++) {
    const frac = y / g.height;
    g.stroke(bg.h, bg.s, bg.b - 5 + frac * 8);
    g.strokeWeight(1);
    g.line(0, y, g.width, y);
  }

  const cx = g.width / 2;
  const cy = g.height / 2;
  const sz = Math.min(cx, cy) * 0.6;

  // Single large circle - breathing
  const breathe = Math.sin(t * 0.3) * 0.15 + 0.85;
  const radius = sz * breathe;

  g.noFill();
  g.strokeWeight(1.5);

  // Multiple concentric rings
  for (let i = 5; i >= 0; i--) {
    const r = radius * (1 - i * 0.12);
    const alpha = 80 - i * 12;
    const h = pal[i % pal.length] || { h: (bg.h + 40) % 360, s: 30, b: 90 };
    g.stroke(h.h, h.s, h.b, alpha);
    g.circle(cx, cy, r * 2);
  }

  // Horizontal line that rises
  const lineY = cy + Math.sin(t * 0.25) * cy * 0.5;
  g.stroke(pal[1]?.h || bg.h + 60, pal[1]?.s || 40, pal[1]?.b || 90, 40);
  g.strokeWeight(0.8);
  g.line(cx - sz * 0.9, lineY, cx + sz * 0.9, lineY);

  // Vertical line that swings
  const swingAngle = Math.sin(t * 0.35) * 0.3;
  g.push();
  g.translate(cx, cy);
  g.rotate(swingAngle);
  g.line(0, -sz * 0.9, 0, sz * 0.9);
  g.pop();

  // Small accent dot at intersection
  g.fill(pal[2]?.h || 180, 30, 100, 200);
  g.noStroke();
  g.circle(cx, lineY, 6 + Math.sin(t * 2) * 2);

  // Corner marks
  g.stroke(pal[0]?.h || bg.h, 20, 70, 40);
  g.strokeWeight(0.5);
  const m = 30;
  g.line(m, m, m, m + 20);    g.line(m, m, m + 20, m);
  g.line(g.width - m, m, g.width - m, m + 20);  g.line(g.width - m, m, g.width - m - 20, m);
  g.line(m, g.height - m, m, g.height - m - 20); g.line(m, g.height - m, m + 20, g.height - m);
  g.line(g.width - m, g.height - m, g.width - m, g.height - m - 20);
  g.line(g.width - m, g.height - m, g.width - m - 20, g.height - m);
}

// ── RETRO ──────────────────────────────────────────────────────────────────

function drawRetro(g, t, p) {
  const pal = window._palHSB;
  const scale = 4; // pixel size

  g.background(0, 0, 5);

  // Pixel grid
  g.stroke(0, 0, 8, 10);
  g.strokeWeight(0.5);
  for (let x = 0; x < g.width; x += scale) {
    g.line(x, 0, x, g.height);
  }
  for (let y = 0; y < g.height; y += scale) {
    g.line(0, y, g.width, y);
  }

  // Large pixel art sun/moon
  const sunX = g.width * 0.2 + Math.sin(t * 0.2) * g.width * 0.1;
  const sunY = g.height * 0.3;
  const sunSz = 10 * scale;

  g.noStroke();
  const sunH = pal[2]?.h || 40;
  g.fill(sunH, 80, 90, 200);
  g.rect(sunX - sunSz / 2, sunY - sunSz / 2, sunSz, sunSz, 3);

  // Retro landscape
  const groundY = g.height * 0.7;
  const hillH = 8 * scale;

  for (let x = 0; x < g.width; x += scale) {
    const h = Math.sin(x * 0.004 + t * 0.15) * hillH + hillH * 0.5;
    g.fill(pal[0]?.h || 240, 50, 50, 180);
    g.rect(x, groundY - h, scale, h + g.height - groundY);
  }

  // Scanline overlay
  for (let y = 0; y < g.height; y += 3) {
    g.stroke(0, 0, 0, 15);
    g.strokeWeight(1);
    g.line(0, y, g.width, y);
  }

  // "PIXEL" text in corner
  g.fill(pal[1]?.h || 120, 60, 90, 40);
  g.textAlign(LEFT, TOP);
  g.textSize(7 * scale);
  g.text('PX', g.width * 0.05, g.height * 0.05);

  // Twinkling stars
  for (let i = 0; i < 20; i++) {
    const sx = (noise(i * 10, t * 0.5) * g.width) | 0;
    const sy = (noise(i * 10 + 100, t * 0.5) * groundY) | 0;
    const bright = noise(i, t) > 0.5;
    g.fill(0, 0, bright ? 100 : 20, bright ? 180 : 40);
    g.rect((sx / scale | 0) * scale, (sy / scale | 0) * scale, scale, scale);
  }
}

// ── ORGANIC ────────────────────────────────────────────────────────────────

let organicNodes = [];
let organicConnections = [];

function initOrganic() {
  const numNodes = 40;
  organicNodes = [];
  for (let i = 0; i < numNodes; i++) {
    organicNodes.push({
      x: random(width),
      y: random(height),
      baseX: random(width),
      baseY: random(height),
      size: random(2, 8),
      hue: random(360),
      phase: random(TWO_PI),
      freq: random(0.3, 1.5),
    });
  }
  // Random connections between nearby nodes
  organicConnections = [];
  for (let i = 0; i < numNodes; i++) {
    for (let j = i + 1; j < numNodes; j++) {
      const dx = organicNodes[i].baseX - organicNodes[j].baseX;
      const dy = organicNodes[i].baseY - organicNodes[j].baseY;
      if (Math.sqrt(dx * dx + dy * dy) < width * 0.25) {
        organicConnections.push({ a: i, b: j });
      }
    }
  }
}

function drawOrganic(g, t, p) {
  const pal = window._palHSB;

  // Warm dark background
  g.background(0, 0, 3);

  // Update node positions with organic noise drift
  for (const node of organicNodes) {
    const angle = noise(node.baseX * 0.002, node.baseY * 0.002, t * 0.2) * TWO_PI * 3;
    const dist  = noise(node.baseX * 0.003, node.baseY * 0.003, t * 0.15 + 100) * 120 * VISUAL.intensity;

    node.x = node.baseX + Math.cos(angle) * dist + Math.sin(t * node.freq + node.phase) * 40;
    node.y = node.baseY + Math.sin(angle) * dist + Math.cos(t * node.freq * 0.7 + node.phase) * 40;
  }

  // Draw connections (vein-like)
  g.strokeWeight(0.8);
  for (const conn of organicConnections) {
    const a = organicNodes[conn.a];
    const b = organicNodes[conn.b];
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const hue = (a.hue + b.hue) / 2;

    // Draw as bezier for organic feel
    const perpX = -dy / len * len * 0.3;
    const perpY = dx / len * len * 0.3;

    g.noFill();
    g.stroke(hue, 50, 70, 20);
    g.bezier(a.x, a.y,
      a.x + perpX, a.y + perpY,
      b.x + perpX, b.y + perpY,
      b.x, b.y);

    // Thin inner line
    g.stroke(hue, 30, 90, 10);
    g.strokeWeight(0.3);
    g.bezier(a.x, a.y,
      a.x + perpX * 0.5, a.y + perpY * 0.5,
      b.x + perpX * 0.5, b.y + perpY * 0.5,
      b.x, b.y);
  }

  // Draw nodes with glow
  for (const node of organicNodes) {
    const hue = node.hue;
    // Outer glow
    g.noStroke();
    for (let r = node.size * 3; r > 0; r -= node.size * 0.4) {
      const alpha = 20 * (r / (node.size * 3));
      g.fill(hue, 40, 80, alpha);
      g.circle(node.x, node.y, r * 2);
    }
    // Core
    g.fill(hue, 20, 100, 220);
    g.circle(node.x, node.y, node.size * 0.7);
  }

  // Slow color wash overlay
  g.blendMode(OVERLAY);
  const washHue = (t * 10) % 360;
  g.fill(washHue, 15, 20, 4);
  g.noStroke();
  g.rect(0, 0, g.width, g.height);
  g.blendMode(BLEND);
}

// ═══════════════════════════════════════════════════════════════════════════
// POST-PROCESSING EFFECTS
// ═══════════════════════════════════════════════════════════════════════════

function applyScanlines(g) {
  g.loadPixels();
  const px = g.pixels;
  for (let y = 0; y < g.height; y++) {
    if (y % 3 === 0) continue;
    for (let x = 0; x < g.width; x++) {
      const idx = 4 * (y * g.width + x);
      px[idx + 3] = Math.floor(px[idx + 3] * 0.8);
    }
  }
  g.updatePixels();
}

function applyNoise(g, progress) {
  g.loadPixels();
  const px = g.pixels;
  const amount = 15 * VISUAL.intensity;
  for (let i = 0; i < px.length; i += 4) {
    const noise = (Math.random() - 0.5) * amount;
    px[i]     = constrain(px[i]     + noise, 0, 255);
    px[i + 1] = constrain(px[i + 1] + noise, 0, 255);
    px[i + 2] = constrain(px[i + 2] + noise, 0, 255);
  }
  g.updatePixels();
}

function applyBloom(g) {
  // Simple bloom: overlay with blurred bright spots
  g.loadPixels();
  const px = g.pixels;
  const brightness = [];
  for (let i = 0; i < px.length; i += 4) {
    brightness[i / 4] = (px[i] + px[i + 1] + px[i + 2]) / 3;
  }
  for (let y = 5; y < g.height - 5; y++) {
    for (let x = 5; x < g.width - 5; x++) {
      const idx = 4 * (y * g.width + x);
      let sum = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          sum += brightness[((y + dy) * g.width + (x + dx))];
        }
      }
      const avg = sum / 25;
      if (avg > 40) {
        const boost = (avg - 40) / 215 * 0.2;
        px[idx]     = constrain(px[idx]     + avg * boost, 0, 255);
        px[idx + 1] = constrain(px[idx + 1] + avg * boost, 0, 255);
        px[idx + 2] = constrain(px[idx + 2] + avg * boost, 0, 255);
      }
    }
  }
  g.updatePixels();
}

function applyChromatic(g) {
  g.loadPixels();
  const px = g.pixels;
  const shift = 3 * VISUAL.intensity;
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const idx = 4 * (y * g.width + x);
      // Red channel shift left
      const rx = constrain(x - Math.floor(shift), 0, g.width - 1);
      const rIdx = 4 * (y * g.width + rx);
      // Blue channel shift right
      const bx = constrain(x + Math.floor(shift), 0, g.width - 1);
      const bIdx = 4 * (y * g.width + bx);
      const gVal = px[idx + 1];
      px[idx]     = (px[rIdx] * 0.5 + px[idx] * 0.5);
      px[idx + 2] = (px[bIdx + 2] * 0.5 + px[idx + 2] * 0.5);
    }
  }
  g.updatePixels();
}

function applyVignette(g) {
  g.loadPixels();
  const px = g.pixels;
  const cx = g.width / 2;
  const cy = g.height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  const strength = 0.5;

  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const vignette = 1 - Math.pow(dist, 2.5) * strength;

      const idx = 4 * (y * g.width + x);
      px[idx]     = px[idx]     * vignette;
      px[idx + 1] = px[idx + 1] * vignette;
      px[idx + 2] = px[idx + 2] * vignette;
    }
  }
  g.updatePixels();
}

function applyDrift(g, t) {
  // Slow vertical drift/wobble
  g.loadPixels();
  const px = g.pixels;
  const amp = 4 * VISUAL.intensity;
  const copy = new Uint8ClampedArray(px);

  for (let y = 0; y < g.height; y++) {
    const offset = Math.sin(y * 0.02 + t * 0.5) * amp;
    const srcY = constrain(y + Math.floor(offset), 0, g.height - 1);
    for (let x = 0; x < g.width; x++) {
      const dstIdx = 4 * (y * g.width + x);
      const srcIdx = 4 * (srcY * g.width + x);
      px[dstIdx]     = copy[srcIdx];
      px[dstIdx + 1] = copy[srcIdx + 1];
      px[dstIdx + 2] = copy[srcIdx + 2];
      px[dstIdx + 3] = copy[srcIdx + 3];
    }
  }
  g.updatePixels();
}

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARD CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

function keyPressed() {
  if (key === ' ' || key === 'p') {
    if (isLooping()) {
      noLoop();
      document.getElementById('hud-section').textContent = 'PAUSED';
    } else {
      loop();
      startTime += millis() - (startTime + (millis() - startTime)); // crude resume
      startTime = millis() - (startTime > 0 ? startTime : 0);
    }
  }

  // Style switching (1-8)
  const styles = ['ascii', 'geometric', 'particles', 'waveform', 'glitch', 'minimal', 'retro', 'organic'];
  const numKey = parseInt(key);
  if (numKey >= 1 && numKey <= 8) {
    VISUAL.style = styles[numKey - 1];
    document.getElementById('hud-style').textContent = VISUAL.style;
    if (VISUAL.style === 'particles' && particles.length === 0) initParticles(300);
    if (VISUAL.style === 'organic' && organicNodes.length === 0) initOrganic();
    const seed = millis();
    randomSeed(seed);
    noiseSeed(seed);
  }

  // Save screenshot
  if (key === 's' || key === 'S') saveCanvas(SCENE.name + '-frame', 'png');

  // Reset timeline
  if (key === 'r' || key === 'R') startTime = millis();

  // Intensity up/down
  if (key === 'ArrowUp')   VISUAL.intensity = Math.min(1, VISUAL.intensity + 0.05);
  if (key === 'ArrowDown') VISUAL.intensity = Math.max(0.05, VISUAL.intensity - 0.05);
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND RENDERER (one-time)
// ═══════════════════════════════════════════════════════════════════════════

function renderBackground(g) {
  g.colorMode(HSB, 360, 100, 100, 100);
  const pal = window._palHSB || [{ h: 220, s: 60, b: 10 }];
  g.background(pal[0]?.h || 220, pal[0]?.s || 60, pal[0]?.b || 10);
}

// ═══════════════════════════════════════════════════════════════════════════
// HUD
// ═══════════════════════════════════════════════════════════════════════════

function updateHUD(seconds, beat) {
  const el = document.getElementById('hud-time');
  const sec = document.getElementById('hud-section');
  const bt  = document.getElementById('hud-beat');
  if (el) el.textContent = formatTime(seconds % SCENE.duration);
  if (sec) sec.textContent = currentSection || '—';
  if (bt) bt.textContent = beat;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════════

function hexToHSB(hex) {
  let r, g, b;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  } else {
    r = parseInt(hex.slice(1, 2) + hex.slice(1, 2), 16);
    g = parseInt(hex.slice(2, 3) + hex.slice(2, 3), 16);
    b = parseInt(hex.slice(3, 4) + hex.slice(3, 4), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max * 100;
  if (max !== min) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h: Math.round(h) % 360, s: Math.round(s * 100), b: Math.round(v) };
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function constrain(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
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
    console.error('p5js-scene.js — Generate p5.js visualizations from Director scene specs');
    console.error('');
    console.error('Usage:');
    console.error('  node p5js-scene.js <scene-spec.json>');
    console.error('  node p5js-scene.js <scene-spec.json> --output scene.html');
    console.error("  node p5js-scene.js '{\"visual\":{...},\"scene\":{...}}' > scene.html");
    console.error('');
    console.error('Output: self-contained HTML file with embedded p5.js visualization');
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

  // Determine output
  const outIdx = args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) {
    fs.writeFileSync(args[outIdx + 1], html);
    console.error(`Written to: ${args[outIdx + 1]}`);
  } else {
    console.log(html);
  }
}

module.exports = { buildHTML };
