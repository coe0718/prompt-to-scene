/**
 * Suno Generator
 * 
 * Generates music from scene spec (JSON from Director)
 * Outputs: audio file URL + timing data for sync layer
 * 
 * Usage:
 *   node suno.js path/to/scene-spec.json
 *   node suno.js '{"audio": {"prompt": "..."}, "scene": {"tempo": 120, "duration_seconds": 45}}'
 */

const fs = require('fs');
const https = require('https');

// Suno API configuration
const SUNO_API_BASE = process.env.SUNO_API_URL || 'https://api.suno.ai';
const SUNO_API_KEY = process.env.SUNO_API_KEY;
const SUNO_USER_ID = process.env.SUNO_USER_ID;

// Polling config
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 120; // 6 minutes max

/**
 * Call Suno API
 */
async function sunoRequest(endpoint, method = 'POST', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, SUNO_API_BASE);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUNO_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(`Suno API error ${res.statusCode}: ${JSON.stringify(json)}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Suno response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Generate music from scene spec
 */
async function generate(spec) {
  const audio = spec.audio || {};
  const scene = spec.scene || {};
  const timing = spec.timing || {};

  console.error(`Suno: Generating "${scene.name}" - ${scene.genre}, ${scene.tempo}BPM, ${scene.duration_seconds}s`);

  // Build Suno prompt from spec
  const prompt = audio.prompt || '';
  const instrumental = audio.instrumental !== false;
  const model = audio.model || 'chirp-4';

  // Calculate target duration in seconds (Suno uses 25s chunks)
  const targetDuration = scene.duration_seconds || 45;
  const numClips = Math.ceil(targetDuration / 25);

  // Build generation request
  const generationBody = {
    prompt,
    instrumental,
    model,
    duration: targetDuration,
    tags: scene.tags?.join(', ') || scene.genre,
    title: scene.name,
    callback_url: null // Could add webhook for async notification
  };

  // Submit generation
  console.error(`Suno: Submitting generation request...`);
  
  let taskId;
  try {
    const response = await sunoRequest('/api/generate/v1', 'POST', generationBody);
    taskId = response.id || response.task_id;
    console.error(`Suno: Task submitted: ${taskId}`);
  } catch (err) {
    // Fallback: try alternative endpoint
    console.error(`Suno: Primary endpoint failed, trying alternative...`);
    const altResponse = await sunoRequest('/generate', 'POST', {
      ...generationBody,
      user_id: SUNO_USER_ID
    });
    taskId = altResponse.id || altResponse.task_id;
    console.error(`Suno: Task submitted (alt): ${taskId}`);
  }

  // Poll for completion
  let attempts = 0;
  let result = null;

  while (attempts < MAX_POLL_ATTEMPTS) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    attempts++;

    try {
      const statusResponse = await sunoRequest(`/api/generate/v1/${taskId}`, 'GET');
      
      if (statusResponse.status === 'complete' || statusResponse.status === 'completed') {
        result = statusResponse;
        console.error(`Suno: Generation complete after ${attempts} polls`);
        break;
      } else if (statusResponse.status === 'failed' || statusResponse.status === 'error') {
        throw new Error(`Generation failed: ${statusResponse.error || 'Unknown error'}`);
      } else {
        const progress = statusResponse.progress || 0;
        if (attempts % 10 === 0) {
          console.error(`Suno: Still generating... ${Math.round(progress * 100)}%`);
        }
      }
    } catch (pollErr) {
      // Try alternative status endpoint
      try {
        const altStatus = await sunoRequest(`/task/${taskId}`, 'GET');
        if (altStatus.status === 'complete') {
          result = altStatus;
          console.error(`Suno: Generation complete (alt endpoint)`);
          break;
        }
      } catch (e) {
        // Continue polling
      }
    }
  }

  if (!result) {
    throw new Error(`Generation timed out after ${MAX_POLL_ATTEMPTS} attempts`);
  }

  // Extract audio URLs and metadata
  const clips = result.clips || result.audio || [];
  const audioUrls = clips.map(clip => clip.audio_url || clip.url).filter(Boolean);
  
  if (audioUrls.length === 0) {
    throw new Error('No audio URLs in generation result');
  }

  // Extract timing data for sync layer
  const timingData = extractTiming(result, scene, timing);

  return {
    audioUrls,
    primaryUrl: audioUrls[0],
    taskId,
    timing: timingData,
    metadata: {
      model: result.model || model,
      duration: result.duration || targetDuration,
      instrumental,
      generatedAt: result.created_at || new Date().toISOString()
    }
  };
}

/**
 * Extract timing data from generation result for sync layer
 */
function extractTiming(generationResult, scene, providedTiming) {
  const tempo = scene.tempo || 120;
  const duration = scene.duration_seconds || 45;
  const beatIntervalMs = 60000 / tempo;

  // Try to get actual audio analysis from Suno if available
  const analysis = generationResult.audio_analysis || generationResult.analysis || {};
  
  // Build timing structure for sync layer
  const timing = {
    beat_interval_ms: providedTiming?.beat_interval_ms || Math.round(beatIntervalMs),
    bar_length_beats: providedTiming?.bar_length_beats || 4,
    tempo,
    duration_ms: duration * 1000,
    total_beats: Math.floor((duration * 1000) / beatIntervalMs),
    sections: providedTiming?.sections || generateDefaultSections(duration, tempo),
    key_moments: providedTiming?.key_moments || []
  };

  // If Suno provided beat data, use it
  if (analysis.beats) {
    timing.detected_beats = analysis.beats;
  }
  if (analysis.bars) {
    timing.detected_bars = analysis.bars;
  }
  if (analysis.segments) {
    timing.segments = analysis.segments.map(seg => ({
      start_ms: seg.start,
      end_ms: seg.end,
      confidence: seg.confidence
    }));
  }

  // Add waveform data if available
  if (analysis.waveform) {
    timing.waveform = analysis.waveform;
  }

  return timing;
}

/**
 * Generate default section boundaries based on duration
 */
function generateDefaultSections(durationSeconds, tempo) {
  const beatInterval = 60000 / tempo;
  const totalBeats = Math.floor((durationSeconds * 1000) / beatInterval);
  
  // Standard structure: intro (8 beats), build (16), drop (16), outro (8)
  const ratios = {
    intro: 0.15,
    build: 0.35,
    drop: 0.35,
    outro: 0.15
  };

  let currentBeat = 0;
  const sections = [];

  for (const [name, ratio] of Object.entries(ratios)) {
    const sectionBeats = Math.round(totalBeats * ratio);
    sections.push({
      name,
      start_beat: currentBeat,
      end_beat: currentBeat + sectionBeats
    });
    currentBeat += sectionBeats;
  }

  return sections;
}

/**
 * Simple generation for quick testing (no actual API call)
 */
async function generateMock(spec) {
  const scene = spec.scene || {};
  const timing = spec.timing || {};
  
  console.error(`Suno (MOCK): Generating "${scene.name}" - ${scene.genre}, ${scene.tempo}BPM`);
  
  // Simulate generation delay
  await new Promise(r => setTimeout(r, 1000));
  
  return {
    audioUrls: ['https://example.com/mock-audio.mp3'],
    primaryUrl: 'https://example.com/mock-audio.mp3',
    taskId: 'mock-task-' + Date.now(),
    timing: extractTiming({}, scene, timing),
    metadata: {
      model: 'mock',
      duration: scene.duration_seconds || 45,
      instrumental: true,
      generatedAt: new Date().toISOString()
    }
  };
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node suno.js <scene-spec.json>');
    console.error('  or: node suno.js \'{"audio": {...}, "scene": {...}}\'');
    console.error('');
    console.error('Environment:');
    console.error('  SUNO_API_KEY     - Your Suno API key');
    console.error('  SUNO_API_URL     - API base URL (default: https://api.suno.ai)');
    console.error('  SUNO_USER_ID     - Your Suno user ID');
    process.exit(1);
  }

  let spec;
  const input = args[0];

  // Try to parse as JSON, or read from file
  try {
    spec = JSON.parse(input);
  } catch {
    // Try as file path
    try {
      const fileContent = fs.readFileSync(input, 'utf8');
      spec = JSON.parse(fileContent);
    } catch (e) {
      console.error(`Error: Could not parse input as JSON or file: ${input}`);
      process.exit(1);
    }
  }

  // Check for mock mode
  const mockMode = process.env.MOCK_SUNO === 'true' || !SUNO_API_KEY;

  if (mockMode) {
    console.error('Note: Running in MOCK mode (no actual Suno API call)');
    generateMock(spec)
      .then(result => {
        console.log(JSON.stringify(result, null, 2));
      })
      .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
      });
  } else {
    generate(spec)
      .then(result => {
        console.log(JSON.stringify(result, null, 2));
      })
      .catch(err => {
        console.error('Error:', err.message);
        process.exit(1);
      });
  }
}

module.exports = { generate, generateMock, extractTiming };