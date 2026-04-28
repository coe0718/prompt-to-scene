/**
 * Vision module — analyzes images via NVIDIA NIMs VLM.
 * Extracts scene attributes that seed the Director agent.
 */

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const VLM_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const VLM_MODEL = 'meta/llama-3.2-90b-vision-instruct';

const ANALYSIS_PROMPT = `You are a creative director analyzing an image for generative art generation.

Analyze the provided image and respond ONLY with a valid JSON object containing these exact fields:
{
  "mood": "one-word emotional tone (e.g., serene, chaotic, nostalgic, electric, melancholic)",
  "color_palette": ["#hex1", "#hex2", "#hex3"], (3-5 dominant colors as hex)
  "visual_style": "artistic style (e.g., geometric, organic, neon, vintage, minimal, abstract, cosmic, rustic)",
  "effects": ["effect1", "effect2"], (1-3 visual effects, e.g., glow, blur, grain, parallax, pulse, scanline)
  "tempo": "estimated BPM for music that would fit (e.g., 80, 120, 160)",
  "genre": "music genre that fits the scene (e.g., ambient, electronic, orchestral, lo-fi, techno, cinematic)",
  "intensity": 0.0-1.0, (visual energy level)
  "tags": ["tag1", "tag2", "tag3", "tag4"] (descriptive keywords)
}

Be specific and creative. The JSON is passed directly to a generative art system. Respond with ONLY the JSON object, no markdown, no explanation.`;

async function analyzeImage(imageDataUrl) {
  if (!NVIDIA_API_KEY) {
    throw new Error('NVIDIA_API_KEY not set');
  }

  // Extract base64 data (remove data:image/...;base64, prefix)
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const binaryData = Buffer.from(base64Data, 'base64');

  // Detect image mime type from data URL
  const mimeMatch = imageDataUrl.match(/^data:image\/(\w+);base64,/);
  const mimeType = mimeMatch ? `image/${mimeMatch[1]}` : 'image/jpeg';

  // Build multi-part message (OpenAI Vision-compatible)
  const payload = {
    model: VLM_MODEL,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: ANALYSIS_PROMPT,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Data}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  };

  const response = await fetch(VLM_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NVIDIA NIMs VLM error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('No content in VLM response');
  }

  // Strip markdown code fences if present
  const jsonStr = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse VLM JSON: ${jsonStr.slice(0, 200)}`);
  }
}

module.exports = { analyzeImage };