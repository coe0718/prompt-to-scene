/**
 * Director Agent
 * 
 * Interprets user prompt → outputs structured scene spec (JSON)
 * Consumed by: Suno, p5.js, ASCII Engine, Stitcher
 * 
 * Usage:
 *   node agent.js "A cyberpunk cityscape at night with rain and neon lights"
 *   node agent.js --model kimi-k2.5-nim "upbeat summer beach party"
 */

const DEFAULT_MODEL = 'minimax-m2.5';
const DEFAULT_DURATION = 45;

// Mood to visual style defaults
const MOOD_PALETTES = {
  energetic:   { colors: ['#ff6b6b', '#feca57', '#ffffff'], effects: ['bloom', 'drift'] },
  calm:        { colors: ['#a8e6cf', '#dcedc1', '#ffd3a5'], effects: ['vignette'] },
  dark:        { colors: ['#0d0d0d', '#1a1a2e', '#16213e'], effects: ['vignette', 'noise'] },
  uplifting:   { colors: ['#f8b500', '#ff6f91', '#c44569'], effects: ['bloom'] },
  melancholic:{ colors: ['#2c3e50', '#3498db', '#1abc9c'], effects: ['scanlines'] },
  chaotic:     { colors: ['#ff0000', '#00ff00', '#0000ff'], effects: ['glitch', 'chromatic'] },
  meditative:  { colors: ['#1a1a1a', '#2d2d2d', '#404040'], effects: ['drift'] },
  nostalgic:   { colors: ['#f4a460', '#d2691e', '#8b4513'], effects: ['scanlines', 'vignette'] }
};

// Genre to BPM defaults
const GENRE_BPM = {
  pop: 120, electronic: 128, rock: 130, ambient: 60,
  jazz: 100, classical: 70, 'hip-hop': 90, folk: 110, metal: 150, experimental: 80
};

const SYSTEM_PROMPT = `You are the Director — a creative AI that interprets user prompts and outputs a structured scene specification for audio-visual generation.

Output ONLY valid JSON matching this exact schema. No markdown, no explanation.

Schema:
{
  "version": "1.0",
  "prompt": "original user prompt",
  "scene": {
    "name": "short-identifier",
    "mood": "energetic|calm|dark|uplifting|melancholic|chaotic|meditative|nostalgic",
    "tempo": 40-220,
    "duration_seconds": 15-300,
    "genre": "pop|electronic|rock|ambient|jazz|classical|hip-hop|folk|metal|experimental",
    "tags": ["descriptor1", ...]
  },
  "audio": {
    "prompt": "Suno-compatible music prompt (max 200 chars)",
    "instrumental": boolean,
    "model": "chirp-3-5|chirp-4|chirp-4-5"
  },
  "visual": {
    "style": "ascii|geometric|particles|waveform|glitch|minimal|retro|organic",
    "color_palette": ["#hex1", ...],
    "effects": ["scanlines|noise|bloom|chromatic|vignette|drift"],
    "intensity": 0.0-1.0,
    "ascii_char_set": "standard|blocks|detailed",
    "resolution": { "width": number, "height": number }
  },
  "timing": {
    "beat_interval_ms": number,
    "bar_length_beats": 4,
    "sections": [{ "name": string, "start_beat": number, "end_beat": number }],
    "key_moments": [{ "beat": number, "event": string }]
  },
  "metadata": {
    "director_model": string,
    "generated_at": "ISO8601",
    "generation_time_ms": number
  }
}

Rules:
- tempo must match genre conventions
- visual.style should match scene mood
- visual.color_palette should match mood (use mood palettes as base)
- timing.sections should divide the track into intro/build/drop/outro
- timing.key_moments mark drops, transitions, fades
- audio.prompt must be Suno-compatible (describe instruments, mood, structure)
- duration_seconds determines track length, calculate sections accordingly

Respond with ONLY the JSON object.`;

async function callLLM(prompt, model = DEFAULT_MODEL) {
  const startTime = Date.now();
  
  // Build the request based on model
  let url, headers, body;
  
  if (model === 'minimax-m2.5' || model.startsWith('minimax')) {
    // OpenRouter API (current provider)
    url = 'https://openrouter.ai/api/v1/chat/completions';
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || ''}`,
      'HTTP-Referer': 'https://hackathon-creative.local',
      'X-Title': 'Director Agent'
    };
    body = {
      model: 'minimax/minimax-m2.5:free',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 2000
    };
  } else if (model === 'kimi-k2.5-nim') {
    // NVIDIA NIMs Kimi K2.5 (free)
    url = 'https://integrate.api.nvidia.com/v1/chat/completions';
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.NVIDIA_API_KEY || ''}`
    };
    body = {
      model: 'nvidia/kimi-k2.5',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 2000
    };
  } else {
    throw new Error(`Unknown model: ${model}`);
  }

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} ${error}`);
  }
  
  const data = await response.json();
  const generationTime = Date.now() - startTime;
  
  return {
    content: data.choices[0].message.content,
    model: data.model || model,
    generationTime
  };
}

function parseJSONResponse(text) {
  // Extract JSON from response (handle potential markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S*\}{1,2}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }
  
  let jsonStr = jsonMatch[0];
  
  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '');
  }
  
  // Find the complete JSON object
  let braceCount = 0;
  let endIndex = 0;
  for (let i = 0; i < jsonStr.length; i++) {
    if (jsonStr[i] === '{') braceCount++;
    if (jsonStr[i] === '}') braceCount--;
    if (braceCount === 0) {
      endIndex = i + 1;
      break;
    }
  }
  
  jsonStr = jsonStr.substring(0, endIndex);
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse JSON:', jsonStr.substring(0, 500));
    throw e;
  }
}

function validateSpec(spec) {
  const errors = [];
  
  // Required fields
  if (!spec.scene?.name) errors.push('Missing scene.name');
  if (!spec.scene?.mood) errors.push('Missing scene.mood');
  if (!spec.scene?.tempo) errors.push('Missing scene.tempo');
  if (!spec.audio?.prompt) errors.push('Missing audio.prompt');
  if (!spec.visual?.style) errors.push('Missing visual.style');
  if (!spec.timing?.beat_interval_ms) errors.push('Missing timing.beat_interval_ms');
  
  // Range validation
  if (spec.scene?.tempo && (spec.scene.tempo < 40 || spec.scene.tempo > 220)) {
    errors.push('tempo must be 40-220');
  }
  if (spec.scene?.duration_seconds && (spec.scene.duration_seconds < 15 || spec.scene.duration_seconds > 300)) {
    errors.push('duration_seconds must be 15-300');
  }
  if (spec.visual?.intensity && (spec.visual.intensity < 0 || spec.visual.intensity > 1)) {
    errors.push('intensity must be 0.0-1.0');
  }
  
  // Valid enum values
  const validMoods = ['energetic', 'calm', 'dark', 'uplifting', 'melancholic', 'chaotic', 'meditative', 'nostalgic'];
  if (spec.scene?.mood && !validMoods.includes(spec.scene.mood)) {
    errors.push(`Invalid mood: ${spec.scene.mood}`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
  
  return true;
}

async function generateSpec(userPrompt, options = {}) {
  const model = options.model || DEFAULT_MODEL;
  const duration = options.duration || DEFAULT_DURATION;
  
  console.error(`Director: Generating spec for "${userPrompt}"`);
  console.error(`Using model: ${model}, duration: ${duration}s`);
  
  const { content, model: usedModel, generationTime } = await callLLM(userPrompt, model);
  
  let spec = parseJSONResponse(content);
  
  // Apply defaults and overrides
  spec.version = '1.0';
  spec.prompt = userPrompt;
  spec.scene.duration_seconds = spec.scene.duration_seconds || duration;
  spec.timing.beat_interval_ms = spec.timing?.beat_interval_ms || Math.round(60000 / spec.scene.tempo);
  
  // Ensure metadata
  spec.metadata = {
    director_model: usedModel,
    generated_at: new Date().toISOString(),
    generation_time_ms: generationTime
  };
  
  validateSpec(spec);
  
  return spec;
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node agent.js [options] "prompt"');
    console.error('Options:');
    console.error('  --model <name>    LLM to use (default: minimax-m2.5)');
    console.error('  --duration <sec>  Track duration (default: 45)');
    console.error('  --kimi            Use Kimi K2.5 NIM (for Kimi track)');
    process.exit(1);
  }
  
  let prompt = '';
  let model = DEFAULT_MODEL;
  let duration = DEFAULT_DURATION;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--model' && args[i + 1]) {
      model = args[i + 1];
      i++;
    } else if (args[i] === '--duration' && args[i + 1]) {
      duration = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--kimi') {
      model = 'kimi-k2.5-nim';
    } else if (!args[i].startsWith('--')) {
      prompt = args[i];
    }
  }
  
  if (!prompt) {
    console.error('Error: No prompt provided');
    process.exit(1);
  }
  
  generateSpec(prompt, { model, duration })
    .then(spec => {
      console.log(JSON.stringify(spec, null, 2));
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { generateSpec, validateSpec, parseJSONResponse };