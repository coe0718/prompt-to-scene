# Prompt-to-Scene · Hackathon Project Status

**Due:** May 3, 2026
**Tracks:** $15k Main + $5k Kimi
**Updated:** 2026-04-28

## All Components ✅

| Component | File | Status |
|-----------|------|--------|
| Director Spec | `director/spec.md` | ✅ LOCKED v1.0 |
| Director Agent | `director/agent.js` | ✅ Done |
| Vision Module | `director/vision.js` | ✅ Done |
| p5.js Generator | `generators/p5js-scene.js` | ✅ Done (8 styles, 6 effects) |
| ASCII Engine | `generators/ascii-engine.js` | ✅ Done (6 styles, 6 themes) |
| Stitcher | `sync/stitcher.js` | ✅ Done |
| Demo UI | `ui/index.html` | ✅ Done |
| Landing Page | `ui/landing.html` | ✅ Done |
| Docker | `Dockerfile` + `docker-compose.yml` | ✅ Done |
| Health Endpoint | `server.js /health` | ✅ Done |
| Image-to-Scene | `POST /api/generate-from-image` | ✅ Done |
| Scene History | localStorage (30 entries) | ✅ Done |
| Dark/Light Theme | Toggle + persist | ✅ Done |
| README | `README.md` | ✅ Done |

## Remaining (deployment only)

- [ ] Deploy landing page to Railway/Render

## Quick Start

```bash
node server.js          # http://localhost:7041
docker compose up       # same, containerized
```
