# Prompt-to-Scene

> Turn any text prompt, image, or audio track into a real-time generative visual scene — powered by AI.

**Hackathon submission · Due May 3, 2026**

## What It Does

Prompt-to-Scene takes a natural language description (or an image, or an audio file) and generates a real-time, interactive visual scene with synchronized audio. It's a creative tool that bridges AI understanding with generative art.

### Three Input Paths

| Path | Input | What Happens |
|------|-------|-------------|
| **Text → Scene** | Describe your scene in words | Director agent (LLM) generates a scene spec → p5.js / ASCII renderer |
| **Image → Scene** | Drop any image | Vision model (LLaMA 3.2 90B) analyzes colors, mood, style → generates matching scene |
| **Audio → Scene** | Drop an MP3/WAV | Beat detection + audio features → synced visual scene |

### Output Formats

- **p5.js Visual** — 8 styles (geometric, particles, waveform, glitch, minimal, retro, organic, ASCII), 6 effects (scanlines, noise, bloom, chromatic aberration, vignette, drift), beat-synced animation
- **ASCII Engine** — 6 ASCII styles, 6 color themes, pure vanilla JS
- **Procedural Audio** — Web Audio API synth with BPM-synced visualization
- **Stitched Final** — Audio + visuals combined in one view

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│  Input       │────▶│  Director     │────▶│  Generators       │
│  (text/img/  │     │  Agent (LLM)  │     │  (p5.js/ASCII/    │
│   audio)     │     │  → Scene Spec │     │   audio/stitcher) │
└─────────────┘     └──────────────┘     └──────────────────┘
```

**Director Agent** — Takes a prompt + optional image attributes → outputs a structured scene spec (JSON) with mood, tempo, palette, visual style, effects, sections, and timing.

**Vision Module** — Sends uploaded images to LLaMA 3.2 90B Vision (via NVIDIA NIMs) → extracts mood, color palette, visual style, effects, tempo, and genre.

**Generators** — Each takes a scene spec and produces a self-contained HTML file with real-time visuals.

## Tech Stack

| Layer | Tech |
|-------|------|
| Server | Node.js (zero npm deps — built-in `http` module) |
| LLM (default) | MiniMax M2.5 via OpenRouter |
| LLM (alt) | Kimi K2.5 via NVIDIA NIMs |
| Vision | LLaMA 3.2 90B Vision Instruct via NVIDIA NIMs |
| Visuals | p5.js 1.9.4 |
| Audio | Web Audio API (procedural synth) |
| ASCII | Pure vanilla JS (no deps) |
| AIFF detection | onset detection via Web Audio analyser node |
| Containerization | Docker + docker-compose |

## Judge Demo

**One-click auto-demo** (no interaction needed):
```
http://localhost:7041/?demo=1
```
This automatically generates a random scene with p5.js visuals, procedural audio, and a stitched final output.

| URL | What it does |
|-----|-------------|
| `/?demo=1` or `/?demo=full` | Full auto-demo: preset → p5js → audio → stitcher |
| `/?demo=quick` | Quick: just picks a preset and renders p5js |
| `/#demo` | Same as `?demo=1` |

## Quick Start

```bash
# Clone
git clone <repo-url> && cd prompt-to-scene

# Set up API keys
cp .env.example .env
# Edit .env — add your NVIDIA_API_KEY and/or OPENROUTER_API_KEY

# Start (no npm install needed)
node server.js

# Or via Docker
docker compose up

# Open
open http://localhost:7041
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Demo UI |
| `GET` | `/landing` | Marketing page |
| `GET` | `/health` | Health check (`{"status":"ok"}`) |
| `POST` | `/api/generate` | Text prompt → Director → scene spec |
| `POST` | `/api/generate-from-image` | Image data URL → Vision → scene spec |
| `POST` | `/api/generate/p5js` | Scene spec → p5.js HTML |
| `POST` | `/api/generate/ascii` | Scene spec → basic ASCII HTML |
| `POST` | `/api/generate/ascii-enhanced` | Scene spec → 4-layer ASCII HTML |
| `POST` | `/api/generate/procedural-audio` | Scene spec → procedural audio HTML |
| `POST` | `/api/generate/stitch` | Scene spec → stitched A/V HTML |
| `POST` | `/api/batch` | Batch generate multiple prompts |

## Features

- **20 built-in presets** — instant generation without API calls
- **3 AI backends** — MiniMax M2.5, Kimi K2.5, preset fallback
- **Image-to-Scene** — drag & drop any image, AI extracts visual attributes
- **Audio-to-Scene** — drop MP3/WAV, auto-visualizes with beat sync
- **Scene History** — localStorage persistence of full specs (30 entries), restore any past scene
- **Dark/Light Theme** — toggle with one click, preference persisted
- **Batch Generation** — generate multiple scenes from a list of prompts
- **Share URL** — encode scene spec in URL hash for sharing
- **Embed Code** — copy embeddable iframe code for any scene
- **Side-by-Side 4-Up** — compare 4 visual styles simultaneously
- **Download** — export any output as self-contained HTML
- **Demo Recording** — record 10s WebM video of any scene
- **Keyboard Controls** — 1-8 switch style, P pause, S screenshot, R reset

## Scene Spec Format

```json
{
  "scene": {
    "name": "neon-rain",
    "mood": "energetic",
    "tempo": 85,
    "duration_seconds": 45
  },
  "visual": {
    "style": "geometric",
    "palette": ["#c084fc", "#60a5fa", "#f472b6"],
    "effects": ["bloom", "scanlines"],
    "intensity": 0.7,
    "resolution": { "width": 1920, "height": 1080 }
  },
  "timing": {
    "beat_interval_ms": 705,
    "sections": [
      { "name": "intro", "start": 0, "end": 8 },
      { "name": "drop", "start": 8, "end": 32 },
      { "name": "outro", "start": 32, "end": 45 }
    ]
  },
  "audio": {
    "genre": "electronic",
    "key": "C minor",
    "layers": ["pad", "bass", "lead"]
  },
  "prompt": "A cyberpunk cityscape at night with rain and neon lights"
}
```

## Project Structure

```
├── server.js              # Node.js server (zero deps)
├── presets.js             # 20 built-in scene presets
├── .env                   # API keys (not committed)
├── .env.example           # Template
├── Dockerfile
├── docker-compose.yml
├── director/
│   ├── agent.js           # LLM client (OpenRouter + NVIDIA)
│   ├── spec.md            # Scene spec JSON schema (v1.0 LOCKED)
│   └── vision.js          # Image analysis via NVIDIA NIMs VLM
├── generators/
│   ├── p5js-scene.js      # p5.js generator (8 styles, 6 effects)
│   └── ascii-engine.js    # ASCII art generator (6 styles, 6 themes)
├── sync/
│   └── stitcher.js        # A/V sync + procedural audio + Web Audio
└── ui/
    ├── index.html         # Demo UI (all-in-one, zero build step)
    └── landing.html       # Marketing page
```

## License

MIT
