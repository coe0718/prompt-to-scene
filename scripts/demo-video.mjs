/**
 * Demo Video Generator for Hermes Repo Auditor
 *
 * Uses Playwright + ffmpeg to create a 60-90s demo video.
 * Captures screenshots of key steps and stitches them into a video
 * with captions and transitions.
 *
 * Usage: node scripts/demo-video.mjs
 * Output: /home/coemedia/projects/hackathon-creative/demo.mp4
 */

import { chromium } from 'playwright';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'demo-frames');
const FINAL_VIDEO = path.join(__dirname, '..', 'demo.mp4');
const BASE_URL = 'http://localhost:7041';

const STEPS = [
  {
    name: '01-hero',
    url: '/',
    caption: 'Hermes Repo Auditor — Autonomous code review by AI agents',
    wait: 1000,
  },
  {
    name: '02-examples',
    url: '/',
    caption: 'Click any example repo or enter your own (user/repo or full URL)',
    wait: 500,
  },
  {
    name: '03-audit-start',
    url: '/',
    caption: 'Kimi K2.5 reasoning model analyzes architecture, code quality, security',
    wait: 2000,
  },
  {
    name: '04-sse-progress',
    url: '/',
    caption: 'Live SSE updates show what Kimi is doing in real time',
    wait: 5000,
  },
  {
    name: '05-report-loaded',
    url: '/?repo=expressjs/express',
    caption: 'Beautiful dark-themed report with scores, findings, and recommendations',
    wait: 1000,
  },
  {
    name: '06-scores',
    url: '/?repo=expressjs/express',
    caption: 'Five dimensions scored 0-100: architecture, code quality, security, docs, maintainability',
    wait: 1000,
  },
  {
    name: '07-findings',
    url: '/?repo=expressjs/express',
    caption: 'Prioritized findings with severity, file locations, and fix suggestions',
    wait: 1000,
  },
  {
    name: '08-toolbar',
    url: '/?repo=expressjs/express',
    caption: 'Download standalone HTML report or Save as PDF — share with anyone',
    wait: 1000,
  },
  {
    name: '09-pr',
    url: '/?repo=expressjs/express',
    caption: 'Auto-generate fix PRs — AI writes the code, you review and merge',
    wait: 1000,
  },
  {
    name: '10-history',
    url: '/?repo=expressjs/express',
    caption: 'Scan history sidebar — click any past result to re-audit instantly',
    wait: 1000,
  },
  {
    name: '11-footer',
    url: '/?repo=expressjs/express',
    caption: 'Built by Drey + Vex + Tuck — zero human-written code',
    wait: 500,
  },
];

async function takeScreenshots() {
  console.log('Starting Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Create output dir
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    const filePath = path.join(OUTPUT_DIR, `${String(i).padStart(2, '0')}-${step.name}.png`);
    console.log(`  [${i + 1}/${STEPS.length}] ${step.name}: ${step.caption}`);

    try {
      await page.goto(BASE_URL + step.url, { waitUntil: 'networkidle', timeout: 10000 });
      await page.waitForTimeout(step.wait);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`    → saved ${filePath}`);
    } catch (e) {
      console.error(`    ✗ failed: ${e.message}`);
    }
  }

  await browser.close();
  console.log('Screenshots done.');
}

async function renderVideo() {
  console.log('Rendering video with ffmpeg...');

  const frames = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith('.png'))
    .sort();

  if (frames.length === 0) {
    console.error('No frames found!');
    return;
  }

  // Calculate durations: 5 seconds per frame + transitions
  const frameDuration = 4; // seconds per frame
  const transitionDuration = 1; // seconds crossfade

  // Create a concat file for ffmpeg
  const concatLines = [];
  for (const frame of frames) {
    concatLines.push(`file '${path.join(OUTPUT_DIR, frame)}'`);
    concatLines.push(`duration ${frameDuration}`);
  }

  // Write concat file
  const concatPath = path.join(OUTPUT_DIR, 'concat.txt');
  fs.writeFileSync(concatPath, concatLines.join('\n') + '\n');

  // Create subtitle file (ASS format for styled captions)
  let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 800
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Inter,44,&H40FFFFFF,&H00FFFFFF,&H40000000,&H80000000,0,0,1,2,8,40,40,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let currentTime = 0;
  for (let i = 0; i < STEPS.length; i++) {
    const startSec = currentTime;
    const endSec = startSec + frameDuration;
    const startStr = `${Math.floor(startSec / 60)}:${String(Math.floor(startSec % 60)).padStart(2, '0')}.00`;
    const endStr = `${Math.floor(endSec / 60)}:${String(Math.floor(endSec % 60)).padStart(2, '0')}.00`;
    assContent += `Dialogue: 0,${startStr},${endStr},Caption,,0,0,0,,${STEPS[i].caption}\n`;
    currentTime = endSec - 0.5; // slight overlap
  }

  const assPath = path.join(OUTPUT_DIR, 'captions.ass');
  fs.writeFileSync(assPath, assContent);

  // Crossfade between each pair of frames using ffmpeg filter
  // Better approach: use individual images as video inputs with crossfade
  // Actually simplest: concat with crossfade using the concat demuxer

  // Use the concat demuxer approach — each frame becomes a video segment
  // Then crossfade between them

  // Simpler: just make a slideshow with captions
  const filterComplex = frames.map((f, i) => {
    const idx = `[${i}:v]`;
    const scaled = `scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:color=#06060e`;
    // Add caption overlay
    return `${idx}${scaled}[v${i}];`;
  }).join('');

  // Concat all frames
  const concatFilter = frames.map((_, i) => `[v${i}]`).join('') +
    `concat=n=${frames.length}:v=1:a=0,format=yuv420p[v]`;

  const inputArgs = frames.flatMap(f => [
    '-loop', '1', '-i', path.join(OUTPUT_DIR, f),
    '-t', String(frameDuration),
  ]);

  // Use a simpler approach: image -> video with showwaves or similar
  // Actually the simplest that works reliably:
  // Take all images as inputs, concat them

  const inputs = frames.map(f => `-loop 1 -i "${path.join(OUTPUT_DIR, f)}" -t ${frameDuration}`).join(' ');

  const ffmpegCmd = `ffmpeg -y ${inputs} ` +
    `-filter_complex "` +
    frames.map((_, i) => `[${i}:v]scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:color=#06060e,setsar=1,fps=30[v${i}];`).join('') +
    frames.map((_, i) => `[v${i}]`).join('') +
    `concat=n=${frames.length}:v=1:a=0,format=yuv420p[v]" ` +
    `-map "[v]" ` +
    `-vf "subtitles=${assPath}:fontsdir=${__dirname}" ` +
    `-c:v libx264 -preset medium -crf 22 -pix_fmt yuv420p ` +
    `"${FINAL_VIDEO}"`;

  console.log('Running:', ffmpegCmd.replace(/\s+/g, ' '));
  execSync(ffmpegCmd, { stdio: 'inherit', timeout: 120000 });

  console.log(`\nVideo saved to: ${FINAL_VIDEO}`);
}

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Hermes Repo Auditor — Demo Video       ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Step 1: Take screenshots
  await takeScreenshots();

  // Step 2: Render video
  await renderVideo();

  // Cleanup
  // fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  console.log('\nDone!');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
