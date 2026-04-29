# Prompt-to-Scene: A Creative Tool Built by Autonomous AI Agents

**Submission for [Hackathon Name] — $20,000 Prize Track**

> Every line of code in this repository was written by autonomous AI agents.
> A human provided direction. The agents designed, built, reviewed, and shipped the entire system.

---

## The Core Idea

Most generative art tools are built by humans using AI as a component. This project flips that: **an AI agent network built the entire creative tool** — architecture, implementation, testing, deployment, documentation.

The tool itself generates beat-synced visual scenes (p5.js animations, ASCII art, procedural audio) from text prompts or uploaded images. That's the output. But the **submission is the process** — proof that autonomous agents can architect and ship production-quality creative software.

---

## The Agent Network

This project was built by a network of four specialized AI agents:

### Drey — Coding Specialist

**Role:** Implementation. Writes all code — server, generators, UI, tooling.

Key contributions:
- Node.js HTTP server with 12 API endpoints
- p5.js scene generator (8 visual styles, beat-synced animation)
- 4-layer ASCII art engine with temporal shimmer
- Procedural audio generator (Web Audio API synthesis)
- Image-to-Scene pipeline (NVIDIA vision LLM → Director agent)
- Standalone HTML export with CDN inlining
- Dockerfile and deployment config

### Vex — Code Reviewer

**Role:** Quality control. Reviews every pull request, catches bugs, enforces standards.

Key contributions:
- Full code review: identified 3 CRITICAL and 10 WARNING issues
- Fixed: canvas rendering bugs, HTML escaping issues, async error handling
- Validated: p5.js 2.0 compatibility across all 6 generators
- Enforced: proper error boundaries, memory leak prevention (blob URL cleanup)

### Echo — Scout / Researcher

**Role:** Discovery. Explorers APIs, tests CDNs, validates library compatibility.

Key contributions:
- Tested p5.js CDN paths across jsdelivr, cdnjs, unpkg
- Identified p5.sound 0.3.0 CDN availability (unpkg only, others timed out)
- Validated p5.js 2.0 API breakages and provided migration guidance
- Tested NVIDIA NIM endpoint with llama-3.2-90b-vision for Image-to-Scene
- Discovered stitcher GIF export via gif.js library + canvas captureStream

### Herald — Documentation

**Role:** Communication. Writes README, landing page, submission materials.

Key contributions:
- README.md with full architecture documentation
- Landing page with live demo embed
- STATUS.md tracking project completeness
- This AGENTS.md submission document

---

## Development Timeline

```
Day 1 — Architecture & Foundation
  └── Echo: Scouts creative tool landscape, recommends p5.js + Web Audio
  └── Drey: Builds Director agent, HTTP server, presets system

Day 2 — Core Generators  
  └── Drey: p5.js scene renderer (8 visual styles)
  └── Drey: ASCII art engine (4-layer, temporal shimmer)
  └── Drey: Procedural audio (Web Audio synthesis)
  └── Drey: Stitcher (GIF + video export)

Day 3 — UI & Integration
  └── Drey: Full UI with sidebar, tabs, generators, preview panels
  └── Drey: Image-to-Scene (vision LLM → Director)
  └── Drey: Scene history, theme toggle

Day 4 — Review & Polish
  └── Vex: Full code review — 13 issues found
  └── Drey: Fixed all critical and warning-level issues
  └── Vex: Re-verified all fixes, confirmed green status

Day 5 — Ship
  └── Drey: Standalone export (CDN inlining)
  └── Drey: Auto-demo, keyboard shortcuts
  └── Herald: Landing page, AGENTS.md, README
  └── All: Final submission packaging
```

**Total: 5 days, 0 lines written by humans.**

---

## Architecture

```
                        ┌──────────────────┐
  Prompt / Image /       │   Director Agent  │
  Audio Upload ─────────▶│   (LLM-powered)   │
                        └────────┬─────────┘
                                 │
                          Scene Spec (JSON)
                          mood, tempo, style,
                          palette, timing
                                 │
            ┌────────────────────┼──────────────────┐
            ▼                    ▼                   ▼
    ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
    │ p5.js Scene  │   │ ASCII Art   │   │ Procedural Audio │
    │ 8 styles     │   │ 4-layer     │   │ Web Audio API    │
    │ beat-synced  │   │ dynamic     │   │ beat-reactive    │
    └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘
           │                  │                     │
           └──────────────────┼─────────────────────┘
                              ▼
                     ┌──────────────────┐
                     │    Stitcher      │
                     │   GIF + Video    │
                     └──────────────────┘
```

### Data Flow

1. **Input:** User prompt (text), uploaded image (vision), or Surprise Me (preset)
2. **Director Agent:** LLM parses the prompt → structured JSON scene spec
3. **Generators:** Each renderer interprets the spec independently
4. **Viewer:** Tabbed UI with p5.js / ASCII / Audio / Stitched panels
5. **Export:** Single self-contained HTML file with all dependencies inlined

---

## Proof of Autonomy

Every commit in this repository (16 total) was written by an AI agent. The agent network communicated via natural language, reviewed each other's code, and iterated until the system was complete.

### Selected Commits

| Commit | What Happened |
|--------|--------------|
| `c09b356` | Drey built the core: Director agent, p5.js enhanced renderer, 20 presets, .env config |
| `ff1de76` | Drey added procedural audio generator + 4-layer ASCII enhanced renderer |
| `e4b8768` | Vex identified p5.js 2.0 breaking changes; Drey fixed endShape, background, HTML escaping |
| `5bc9292` | Vex code audit → 6 bugs fixed by Drey (bloom effects, blob URL leaks, async error handling) |
| `0e1d7be` | Vex caught stitcher CDN failure + recursion bug; Drey fixed both |
| `926bb89` | Echo tested NVIDIA vision LLM endpoint; Drey wired Image-to-Scene pipeline |
| `b313b32` | Drey built export + Herald wrote landing page → final submission packaging |

### How the Agent Workflow Worked

```
Jeremy: "Build a tool that generates visual scenes from text prompts"
    │
    ▼
Echo: Scouts p5.js, Web Audio, CDN availability → reports findings
    │
    ▼
Drey: Implements Director agent + HTTP server + first generator
    │
    ▼
Vex: Reviews code → reports 13 issues (3 CRITICAL, 10 WARNING)
    │
    ▼
Drey: Fixes all issues, commits
    │
    ▼
Vex: Re-reviews → verifies fixes, signs off
    │
    ▼
[Drey + Vex iterate on each new feature]
    │
    ▼
Herald: Documents everything → README, landing page, submission
```

No human wrote, debugged, or reviewed a single line of code. Jeremy provided direction and high-level requirements. The agents handled everything else.

---

## Features (Built by Agents)

- **AI Scene Director:** LLM parses prompts into structured scene specs (mood, tempo, palette, timing)
- **p5.js Animations:** 8 visual styles — geometric, organic, particles, waveform, glitch, minimal, retro, cosmic
- **ASCII Art Engine:** 4-layer rendering with dynamic density, contrast, and temporal shimmer
- **Procedural Audio:** Beat-synced synthesis via Web Audio API — no audio files needed
- **Image-to-Scene:** Upload any image → NVIDIA vision LLM analyzes it → Director generates a matching scene
- **Stitcher:** Chain scenes together with synchronized GIF/video export
- **Standalone Export:** Download any scene as a single self-contained HTML file with all assets inlined
- **20 Built-in Presets:** Work instantly without any API key
- **Dark/Light Theme:** Persisted preference
- **Scene History:** localStorage-based, full restore, relative timestamps

---

## What's Working

All features tested and verified in browser:

- ✅ Server (Node.js, port 7041, 12 API endpoints)
- ✅ p5.js enhanced renderer — all 8 visual styles, zero JS errors
- ✅ Procedural audio — Web Audio synthesis, rainbow visualization
- ✅ ASCII enhanced — 4-layer rendering with effects
- ✅ Image-to-Scene — NVIDIA vision → Director pipeline
- ✅ Stitcher — GIF export from canvas frames
- ✅ UI — Tabbed panels, scene catalog, share URLs, embed code
- ✅ Auto-demo — One-click generation of full pipeline
- ✅ Standalone export — CDN-inlined single-file HTML
- ✅ Landing page — Live demo embed
- ✅ Keyboard shortcuts, theme toggle, scene history

---

## Try It

The live demo runs on port 7041:

- **http://localhost:7041/landing** — Landing page
- **http://localhost:7041/?demo=1** — Auto-play demo

Or deploy anywhere:
```bash
docker build -t prompt-to-scene .
docker run -p 7041:7041 prompt-to-scene
```

---

## The Bottom Line

This project was not built *with* AI. It was built *by* AI.

Four autonomous agents — a coder, a reviewer, a researcher, and a documentarian — collaborated over 5 days to design, implement, test, and ship a complete creative tool. They made architectural decisions, caught each other's bugs, and delivered production-quality output.

**The tool generates scenes. The submission proves AI agents can build tools.**

---

*Built by autonomous AI agents — a collaborative agent network*
*https://github.com/coe0718/hackathon-creative*
