# Prompt-to-Scene · Hackathon Project Status

**Due:** May 3, 2026
**Tracks:** $15k Main + $5k Kimi

## Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Director Spec | `director/spec.md` | ✅ LOCKED v1.0 | JSON schema — all generators build against this |
| Director Agent | `director/agent.js` | ✅ Done | LLM client (minimax-m2.5 + kimi-k2.5-nim) → scene spec |
| Suno Generator | `generators/suno.js` | ✅ Done | Suno API client + mock mode fallback |
| p5.js Generator | `generators/p5js-scene.js` | ✅ Done | 8 visual styles, 6 effects, beat-synced, self-contained HTML |
| ASCII Engine | `generators/ascii-engine.js` | ✅ Done | 6 ASCII styles, 6 color themes, pure vanilla JS, no deps |
| Stitcher | `sync/stitcher.js` | ✅ Done | A/V sync with procedural audio fallback, Web Audio API |
| Demo UI | `ui/index.html` | ✅ Done | 4 pre-built scenes, live style switching, iframe previews |

## Visual Styles (8)

ascii · geometric · particles · waveform · glitch · minimal · retro · organic

## ASCII Styles (6)

landscape · abstract · matrix · tunnel · bars · glyphs

## Effects (6)

scanlines · noise · bloom · chromatic · vignette · drift

## Usage

```bash
# Generate p5.js visualization
node generators/p5js-scene.js scene-spec.json --output scene.html

# Generate ASCII art animation
node generators/ascii-engine.js scene-spec.json --output ascii.html

# Generate final stitched output (procedural audio)
node sync/stitcher.js scene-spec.json --output final.html

# Generate with real audio
node sync/stitcher.js scene-spec.json --audio song.mp3 --output final.html

# Open the demo UI
open ui/index.html
```

## Keyboard Controls (in output HTML)

| Key | Action |
|-----|--------|
| 1-8 | Switch visual style |
| P / Space | Pause/Play |
| S | Save screenshot |
| R | Reset |
| ← → | Change theme (ASCII engine) |
| ↑ ↓ | Adjust intensity |

## Remaining (pre-submission)

- [ ] Procedural audio generator (`generators/procedural-audio.js`) — standalone Web Audio synthesizer
- [ ] Video export pipeline (Puppeteer + FFmpeg)
- [ ] README.md for submission
- [ ] Demo video recording
