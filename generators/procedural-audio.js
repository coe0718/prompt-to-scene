/**
 * Procedural Audio Generator
 *
 * Generates a self-contained HTML file with Web Audio API synthesis.
 * No external dependencies — pure Web Audio API oscillators + filters.
 *
 * Usage:
 *   node procedural-audio.js path/to/scene-spec.json > audio-scene.html
 *   node procedural-audio.js path/to/scene-spec.json --output audio-scene.html
 *
 * Consumes: scene.tempo, scene.duration_seconds, timing.*, scene.mood
 * Outputs: standalone HTML file with Web Audio synthesis + p5.js visualizer
 */

const fs = require('fs');

// ─── HTML builder ──────────────────────────────────────────────────────────

function generate(spec) {
  const scene    = spec.scene    || {};
  const timing   = spec.timing   || {};
  const visual   = spec.visual   || {};
  const metadata = spec.metadata || {};

  const name       = JSON.stringify(scene.name || 'procedural');
  const tempo      = scene.tempo      || 120;
  const duration   = scene.duration_seconds || 45;
  const beatMs     = timing.beat_interval_ms || Math.round(60000 / tempo);
  const sections   = JSON.stringify(timing.sections || []);
  const keyMoments = JSON.stringify(timing.key_moments || []);
  const intensity  = visual.intensity ?? 0.7;
  const palette    = JSON.stringify(visual.color_palette || ['#ff6b6b','#feca57','#00d4ff','#2d1b69']);
  const mood       = JSON.stringify(scene.mood || 'energetic');
  const totalBeats = Math.floor((duration * 1000) / beatMs);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${scene.name || 'Procedural Audio'} — Prompt-to-Scene</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.4/p5.min.js"></script>
<style>
html,body{margin:0;padding:0;overflow:hidden;background:#0a0a0a;font-family:'Courier New',monospace}
canvas{display:block}
#hud{position:fixed;bottom:0;left:0;right:0;padding:12px 20px;font-size:12px;color:rgba(255,255,255,0.6);background:linear-gradient(transparent,rgba(0,0,0,0.85));display:flex;justify-content:space-between;z-index:10;pointer-events:none}
#start-overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:100;cursor:pointer;background:rgba(0,0,0,0.7)}
#start-overlay .btn{font-family:'Courier New',monospace;font-size:18px;color:#fff;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);padding:16px 40px;border-radius:4px;letter-spacing:3px;transition:all 0.3s}
#start-overlay .btn:hover{background:rgba(255,255,255,0.2);border-color:rgba(255,255,255,0.6)}
#waveform{position:fixed;top:16px;left:16px;right:16px;height:60px;z-index:10;pointer-events:none;opacity:0.6}
</style>
</head>
<body>
<div id="start-overlay"><div class="btn">▶ START</div></div>
<div id="hud">
  <div><span id="hud-name">${scene.name || 'procedural'}</span> · <span id="hud-sec">—</span></div>
  <div><span id="hud-time">0:00</span> / <span>${fmtTime(duration)}</span> · <span id="hud-beat">0</span>b · ${tempo}BPM</div>
</div>
<canvas id="waveform"></canvas>
<script>
// ═══ CONFIG ═══
const CFG={name:${name},tempo:${tempo},dur:${duration},bm:${beatMs},
  sections:${sections},keyMoments:${keyMoments},intensity:${intensity},
  palette:${palette},mood:${mood},totalBeats:${totalBeats}};

// ═══ AUDIO ENGINE ═══
let ac, masterGain, analyzer;
let oscs=[], gains=[], filters=[], noiseNode, noiseGain;
let started=false, startTime=0, currentBeat=-1;

function initAudio(){
  ac=new(window.AudioContext||window.webkitAudioContext)();
  masterGain=ac.createGain();
  masterGain.gain.value=0;
  masterGain.connect(ac.destination);

  analyzer=ac.createAnalyser();
  analyzer.fftSize=2048;
  analyzer.smoothingTimeConstant=0.7;
  analyzer.connect(masterGain);

  // Bass layer — sine, lowpass filtered
  const bassOsc=ac.createOscillator();
  bassOsc.type='sine';
  bassOsc.frequency.value=CFG.tempo/60*27.5; // sub-bass at 1/4 tempo freq
  const bassFilter=ac.createBiquadFilter();
  bassFilter.type='lowpass';
  bassFilter.frequency.value=200;
  bassFilter.Q.value=1;
  const bassGain=ac.createGain();
  bassGain.gain.value=0;
  bassOsc.connect(bassFilter);
  bassFilter.connect(bassGain);
  bassGain.connect(analyzer);
  bassOsc.start(0);
  oscs.push(bassOsc); gains.push({g:bassGain,layer:'bass'}); filters.push(bassFilter);

  // Mid layer — triangle, bandpass
  const midOsc=ac.createOscillator();
  midOsc.type='triangle';
  midOsc.frequency.value=CFG.tempo/60*55; // root
  const midFilter=ac.createBiquadFilter();
  midFilter.type='bandpass';
  midFilter.frequency.value=800;
  midFilter.Q.value=0.7;
  const midGain=ac.createGain();
  midGain.gain.value=0;
  midOsc.connect(midFilter);
  midFilter.connect(midGain);
  midGain.connect(analyzer);
  midOsc.start(0);
  oscs.push(midOsc); gains.push({g:midGain,layer:'mid'}); filters.push(midFilter);

  // Hi layer — square, highpassed
  const hiOsc=ac.createOscillator();
  hiOsc.type='square';
  hiOsc.frequency.value=CFG.tempo/60*110; // octave up
  const hiFilter=ac.createBiquadFilter();
  hiFilter.type='highpass';
  hiFilter.frequency.value=2000;
  hiFilter.Q.value=0.5;
  const hiGain=ac.createGain();
  hiGain.gain.value=0;
  hiOsc.connect(hiFilter);
  hiFilter.connect(hiGain);
  hiGain.connect(analyzer);
  hiOsc.start(0);
  oscs.push(hiOsc); gains.push({g:hiGain,layer:'hi'}); filters.push(hiFilter);

  // Noise layer — for texture
  const bufSize=ac.sampleRate*2;
  const noiseBuf=ac.createBuffer(1,bufSize,ac.sampleRate);
  const data=noiseBuf.getChannelData(0);
  for(let i=0;i<bufSize;i++)data[i]=Math.random()*2-1;
  noiseNode=ac.createBufferSource();
  noiseNode.buffer=noiseBuf;
  noiseNode.loop=true;
  noiseGain=ac.createGain();
  noiseGain.gain.value=0;
  const noiseFilter=ac.createBiquadFilter();
  noiseFilter.type='bandpass';
  noiseFilter.frequency.value=3000;
  noiseFilter.Q.value=0.3;
  noiseNode.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(analyzer);
  noiseNode.start(0);

  // Ramp master up
  masterGain.gain.setTargetAtTime(0.8,ac.currentTime,0.5);
}

function getSection(beat){
  for(const s of CFG.sections){
    if(beat>=s.start_beat && beat<s.end_beat)return s;
  }
  return null;
}

function updateAudio(t,beat){
  if(!started||!ac)return;
  const p=t/CFG.dur; // progress 0→1
  const sec=getSection(beat);
  const bp=(beat%4)/4; // beat phase within bar

  let sectionMul=0.3; // default quiet
  if(sec){
    switch(sec.name){
      case'intro':sectionMul=0.2+p*0.3;break;
      case'build':sectionMul=0.3+p*0.5;break;
      case'drop':sectionMul=0.7+bp*0.3;break;
      case'breakdown':sectionMul=0.3;break;
      case'outro':sectionMul=0.5*Math.max(0,1-(p>0.85?(p-0.85)/0.15:0));break;
      case'bridge':sectionMul=0.4+bp*0.2;break;
      case'chorus':sectionMul=0.6+bp*0.2;break;
      case'verse':sectionMul=0.4+bp*0.15;break;
      default:sectionMul=0.3+p*0.4;
    }
  }

  // Beat pulse — bump on each beat
  const beatPulse=1+0.3*Math.exp(-((t*1000)%CFG.bm)/CFG.bm*8);
  const mul=sectionMul*CFG.intensity*beatPulse;

  // Layer gains
  for(const g of gains){
    let lvl=0;
    switch(g.layer){
      case'bass':lvl=0.35*mul*(0.7+bp*0.3);break;
      case'mid': lvl=0.2*mul*(0.4+Math.sin(t*4)*0.3+0.3);break;
      case'hi':  lvl=0.1*mul*(0.3+bp*0.4);break;
    }
    g.g.gain.setTargetAtTime(lvl,ac.currentTime,0.03);
  }

  // Noise texture
  if(noiseGain){
    noiseGain.gain.setTargetAtTime(0.04*mul*(0.5+bp*0.5),ac.currentTime,0.05);
  }

  // Filter sweeps on drop sections
  if(sec&&sec.name==='drop'){
    for(const f of filters){
      const baseF=f.type==='lowpass'?300:f.type==='bandpass'?1200:2500;
      f.frequency.setTargetAtTime(baseF*(0.8+bp*0.4),ac.currentTime,0.1);
    }
  }

  // Key moments
  for(const km of CFG.keyMoments){
    if(beat===km.beat&&currentBeat!==km.beat){
      if(km.event==='drop'){
        masterGain.gain.setTargetAtTime(1.0,ac.currentTime,0.02);
        setTimeout(()=>masterGain.gain.setTargetAtTime(0.8,ac.currentTime,0.3),50);
      }else if(km.event==='fade'){
        masterGain.gain.setTargetAtTime(0.2,ac.currentTime,1.5);
      }
    }
  }
}

// ═══ P5.JS VISUALIZER ═══
let wfCanvas, wfCtx;
function setup(){
  const c=createCanvas(windowWidth,windowHeight);
  wfCanvas=document.getElementById('waveform');
  wfCanvas.width=windowWidth-32;
  wfCanvas.height=60;
  wfCtx=wfCanvas.getContext('2d');
  pixelDensity(1);
  colorMode(HSB,360,100,100,100);
}

function draw(){
  background(0,0,3);

  if(!started||!analyzer){
    // Idle animation
    const t=millis()/1000;
    fill(200,30,60,20);
    noStroke();
    for(let i=0;i<5;i++){
      ellipse(width*(0.1+i*0.2),height/2+sin(t*1.5+i)*30,80+sin(t+i)*20,80+sin(t+i)*20);
    }
    fill(0,0,100,50);
    textAlign(CENTER,CENTER);
    textSize(24);
    text('Click START to begin',width/2,height/2-60);
    return;
  }

  const t=(ac.currentTime-startTime)%CFG.dur;
  const p=t/CFG.dur;
  const beat=Math.floor(t*1000/CFG.bm);

  // Update audio params
  if(beat!==currentBeat){currentBeat=beat;updateAudio(t,beat);}

  // Frequency data
  const bufLen=analyzer.frequencyBinCount;
  const fData=new Uint8Array(bufLen);
  analyzer.getByteFrequencyData(fData);
  const avgFreq=fData.reduce((a,b)=>a+b,0)/bufLen/255;

  // ═══ VISUAL: Frequency rings ═══
  const cx=width/2,cy=height/2;
  const maxR=Math.min(cx,cy)*0.7;

  // Outer glow
  const glowR=maxR*(0.4+avgFreq*0.6);
  for(let r=glowR*1.4;r>glowR*0.6;r-=4){
    fill((p*120+180)%360,40,30,8);
    noStroke();
    ellipse(cx,cy,r*2,r*2);
  }

  // Frequency bands as concentric arcs
  const bands=12;
  noFill();
  for(let i=0;i<bands;i++){
    const bi=Math.floor(i*bufLen/bands);
    const val=fData[Math.min(bi,bufLen-1)]/255;
    const r=maxR*(0.15+i*0.07);
    const hue=((i/bands)*240+p*60)%360;
    strokeWeight(1.5+val*2);
    stroke(hue,70,80,40+val*60);
    const arcLen=PI*(0.3+val*0.7);
    const arcStart=p*TWO_PI+i*0.3;
    arc(cx,cy,r*2,r*2,arcStart,arcStart+arcLen);
  }

  // Beat pulse ring
  const beatPhase=((t*1000)%CFG.bm)/CFG.bm;
  if(beatPhase<0.3){
    const br=maxR*(0.1+beatPhase*0.9);
    strokeWeight(2*(1-beatPhase/0.3));
    stroke(0,0,100,80*(1-beatPhase/0.3));
    noFill();
    ellipse(cx,cy,br*2,br*2);
  }

  // Center dot
  fill(0,0,100,180+sin(t*8)*40);
  noStroke();
  ellipse(cx,cy,8+avgFreq*4,8+avgFreq*4);

  // ═══ HUD ═══
  const sec=getSection(beat);
  document.getElementById('hud-time').textContent=fm(t);
  document.getElementById('hud-beat').textContent=beat;
  document.getElementById('hud-sec').textContent=sec?sec.name:'—';

  // Waveform canvas
  if(wfCtx){
    const w=wfCanvas.width,h=wfCanvas.height;
    wfCtx.clearRect(0,0,w,h);
    const tData=new Uint8Array(bufLen);
    analyzer.getByteTimeDomainData(tData);

    wfCtx.strokeStyle='rgba(255,255,255,0.4)';
    wfCtx.lineWidth=1;
    wfCtx.beginPath();
    const step=tData.length/w;
    for(let i=0;i<w;i++){
      const v=tData[Math.floor(i*step)]/128-1;
      const y=h/2+v*h*0.4;
      if(i===0)wfCtx.moveTo(i,y);
      else wfCtx.lineTo(i,y);
    }
    wfCtx.stroke();
  }
}

function windowResized(){
  resizeCanvas(windowWidth,windowHeight);
  if(wfCanvas){wfCanvas.width=windowWidth-32;wfCanvas.height=60;}
}

function fm(s){
  const m=Math.floor(s/60),sec=Math.floor(s%60);
  return m+':'+(sec<10?'0':'')+sec;
}

// ═══ START / STOP ═══
document.getElementById('start-overlay').addEventListener('click',async()=>{
  if(!ac){initAudio();}
  if(ac.state==='suspended')await ac.resume();
  startTime=ac.currentTime;
  started=true;
  currentBeat=-1;
  document.getElementById('start-overlay').style.display='none';
});

// Click anywhere to start too
document.addEventListener('click',async(e)=>{
  if(e.target.closest('#start-overlay'))return;
  if(!started){
    if(!ac){initAudio();}
    if(ac.state==='suspended')await ac.resume();
    startTime=ac.currentTime;
    started=true;
    currentBeat=-1;
    document.getElementById('start-overlay').style.display='none';
  }
});
</script>
</body>
</html>`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('procedural-audio.js — Generate beat-synced procedural audio from Director specs');
    console.error('');
    console.error('Usage:');
    console.error('  node procedural-audio.js <scene-spec.json>');
    console.error('  node procedural-audio.js <scene-spec.json> --output audio-scene.html');
    console.error('');
    console.error('Output: self-contained HTML with Web Audio synthesis + p5.js visualizer');
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

  const html = generate(spec);

  const outIdx = args.indexOf('--output');
  if (outIdx !== -1 && args[outIdx + 1]) {
    fs.writeFileSync(args[outIdx + 1], html);
    console.error(`Written to: ${args[outIdx + 1]}`);
  } else {
    console.log(html);
  }
}

module.exports = { generate };
