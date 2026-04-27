# Prompt-to-Scene · Hackathon Project Status

**Due:** May 3, 2026
**Tracks:** $15k Main + $5k Kimi
**Updated:** 2026-04-27

## Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Director Spec | `director/spec.md` | ✅ LOCKED v1.0 | JSON schema — all generators build against this |
| Director Agent | `director/agent.js` | ✅ Done | LLM client (minimax-m2.5 + kimi-k2.5-nim) → scene spec |
| p5.js Generator | `generators/p5js-scene.js` | ✅ Done | 8 visual styles, 6 effects, beat-synced, self-contained HTML |
| ASCII Engine | `generators/ascii-engine.js` | ✅ Done | 6 ASCII styles, 6 color themes, pure vanilla JS, no deps |
| Stitcher | `sync/stitcher.js` | ✅ Done | A/V sync with procedural audio fallback, Web Audio API |
| Demo UI | `ui/index.html` | ✅ Done | Scene catalog, generate pipeline, all generators, share, batch |
| Landing Page | `ui/landing.html` | ✅ Done | Marketing page with embedded demo iframe |
| Docker | `Dockerfile` + `docker-compose.yml` | ✅ Done | Self-contained image, healthcheck, one-command deploy |
| Health Endpoint | `server.js /health` | ✅ Done | `GET /health` → `{"status":"ok","port":7041}` |

## Visual Styles (8)

ascii · geometric · particles · waveform · glitch · minimal · retro · organic

## Effects (6)

scanlines · noise · bloom · chromatic · vignette · drift

## Infrastructure

- **Server:** `node server.js` on `:7041` — built-in Node.js modules, no npm install needed
- **Docker:** `docker build -t prompt-to-scene . && docker run -p 7041:7041 prompt-to-scene`
- **Health:** `curl http://localhost:7041/health`
- **Landing:** `curl http://localhost:7041/landing`

## Usage

```bash
# Start server
node server.js

# Or via Docker
docker run -p 7041:7041 prompt-to-scene

# Or via docker-compose
docker compose up

# Health check
curl http://localhost:7041/health
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Demo UI |
| GET | `/landing` | Marketing page |
| GET | `/health` | Health check |
| POST | `/api/generate` | Director agent → scene spec |
| POST | `/api/generate/p5js` | Spec → p5.js HTML |
| POST | `/api/generate/ascii` | Spec → ASCII HTML |
| POST | `/api/generate/ascii-enhanced` | Spec → 4-layer ASCII HTML |
| POST | `/api/generate/procedural-audio` | Spec → procedural audio HTML |
| POST | `/api/generate/stitch` | Spec → stitched A/V HTML |
| POST | `/api/batch` | Batch generate multiple prompts |

## Keyboard Controls (in output HTML)

| Key | Action |
|-----|--------|
| 1-8 | Switch visual style |
| P / Space | Pause/Play |
| S | Save screenshot |
| R | Reset |
| ← → | Change theme (ASCII engine) |
| ↑ ↓ | Adjust intensity |

## Remaining

- [ ] README.md for submission
- [ ] Image-to-Scene (upload photo → vision → scene spec)
- [ ] Scene history (localStorage persistence)
- [ ] Dark/light theme toggle
- [ ] Landing page → deploy to real domain (Railway/Render)