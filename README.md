# Hermes Repo Auditor

> **Autonomous code review by AI agents.**  
> Point it at any public GitHub repo. It reads the codebase, analyzes architecture, scores code quality, checks for security issues, and generates a beautiful audit report — entirely autonomously.

**🏆 Hermes Creative Hackathon Submission · Due May 3, 2026**  
**🎯 Kimi K2.5 Track ($5k bonus) — powered by NVIDIA NIM**

[![Self Audit](http://localhost:7041/api/audit/badge?repo=coe0718/hackathon-creative)](http://localhost:7041/?repo=coe0718/hackathon-creative)

---

## What It Does

Hermes Repo Auditor runs a **3-pass LLM analysis** on any public GitHub repository:

| Pass | What Happens | Time |
|------|-------------|------|
| **1. Structural Analysis** | Reads README, config files, directory tree → maps architecture, framework, language, build system | ~10s |
| **2. Deep Code Review** | Source files chunked and analyzed for code quality, security, maintainability — one file at a time | ~15-60s |
| **3. Aggregation** | All findings merged into final scores, prioritized recommendations, risks, and verdict | ~10s |

**Uses Kimi K2.5** (moonshotai/kimi-k2.5) via NVIDIA NIM — a reasoning model that provides detailed, contextual analysis. Live SSE streaming shows Kimi's progress in real time.

### Sample Repo Scores

<!-- Famous repo results load dynamically — these are populated by the background seeder -->
Click any to audit it yourself.

[Audit expressjs/express](http://localhost:7041/?repo=expressjs/express) · [Audit facebook/react](http://localhost:7041/?repo=facebook/react) · [Audit vuejs/core](http://localhost:7041/?repo=vuejs/core) · [Audit coe0718/hackathon-creative (self-audit)](http://localhost:7041/?repo=coe0718/hackathon-creative)

---

## Quick Start

```bash
# Clone
git clone https://github.com/coe0718/hackathon-creative && cd hackathon-creative

# Set up API keys
cp .env.example .env
# Edit .env — add your NVIDIA_API_KEY (required for Kimi K2.5)
# Also set GITHUB_TOKEN to enable PR publishing

# Start (no npm install needed — zero dependencies)
node server.js

# Open
open http://localhost:7041
```

### Docker

```bash
docker compose up
open http://localhost:7041
```

---

## Features

### 🔍 Repo Auditor (Primary)

| Feature | Description |
|---------|-------------|
| **3-Pass LLM Analysis** | Structural → Deep → Aggregation pipeline |
| **5-Axis Scoring** | Architecture, Code Quality, Security, Documentation, Maintainability (0-100) |
| **Radar Chart** | SVG pentagon visualization in every report |
| **Live SSE Streaming** | Watch Kimi's reasoning steps in real time |
| **Prioritized Findings** | CRITICAL / WARNING / INFO with file locations and fix suggestions |
| **Auto-Fix PR Generation** | Generate pull requests addressing critical findings |
| **Download Report** | Standalone HTML file, all CSS inlined, no server needed |
| **Print / Save as PDF** | Opens report in new window with print dialog |
| **SVG Badge** | `[![Hermes Audit](/api/audit/badge?repo=user/repo)](...)` — paste in any README |
| **Share Links** | Add `?repo=user/repo` to URL — shareable, auto-loads and runs |
| **Scan History** | Persisted to disk, survives restarts, shows ↑↓→ trend arrows |
| **Famous Repo Showcase** | Background-seeded scores for Express, React, Vue, Jest |
| **Self-Audit** | Click "🔍 self-audit" — the auditor audits its own codebase |
| **File Count Selector** | Choose 10/25/50/100 files for depth vs. speed control |
| **One-Click Re-audit** | Click any history entry to re-run |

### 🎨 Prompt-to-Scene (Creative Tool)

Originally built as a creative tool — still available at `/creative`:
- Text, Image, and Audio → generative visual scenes
- p5.js (8 styles, 6 effects), ASCII art (6 styles), procedural audio
- 20 built-in presets (no API key required)
- Standalone HTML export

---

## Badge

Add this badge to your project's README after running an audit:

```
[![Hermes Audit](https://your-server.com/api/audit/badge?repo=user/repo)](https://your-server.com/?repo=user/repo)
```

The badge shows the overall score (color-coded) and links back to the full report.

---

## API Endpoints

### Repo Auditor

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` or `/audit` | Repo Auditor UI |
| `POST` | `/api/audit` | Run a full audit `{ repo: "user/repo", maxFiles: 10 }` (SSE stream) |
| `GET` | `/api/audit/history` | Scan history (JSON array) |
| `GET` | `/api/audit/famous` | Famous repo cached results |
| `GET` | `/api/audit/badge?repo=user/repo` | SVG score badge |
| `POST` | `/api/audit/pr` | Generate fix PR plan from cached audit |
| `POST` | `/api/audit/pr/publish` | Publish PR to GitHub (needs GITHUB_TOKEN) |

### Creative Tool

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/creative` | Creative tool UI |
| `GET` | `/landing` | Marketing page |
| `POST` | `/api/generate` | Text prompt → Director → scene spec |
| `POST` | `/api/generate-from-image` | Image → Vision → scene spec |
| `POST` | `/api/generate/p5js` | Scene spec → p5.js HTML |
| `POST` | `/api/generate/ascii` | Scene spec → ASCII HTML |
| `POST` | `/api/generate/ascii-enhanced` | Scene spec → 4-layer ASCII |
| `POST` | `/api/generate/procedural-audio` | Scene spec → audio HTML |
| `POST` | `/api/generate/stitch` | Scene spec → stitched A/V HTML |
| `POST` | `/api/export` | Download standalone HTML |

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Server** | Node.js (zero npm deps) |
| **LLM** | Kimi K2.5 (moonshotai/kimi-k2.5) via NVIDIA NIM |
| **Fallback** | MiniMax M2.5 via OpenRouter |
| **Frontend** | Pure HTML/CSS/JS (no build step) |
| **Visuals** | p5.js 1.9.4 (creative tool) |
| **Audio** | Web Audio API (procedural synthesis) |
| **Containers** | Docker + docker-compose |

---

## Built By Agents

Every line of code in this project was written by autonomous AI agents working collaboratively:

| Agent | Role | Contributions |
|-------|------|---------------|
| **Drey** | Coding Specialist | Server, generators, UI, export, vision pipeline, auditor, badge, radar chart, persistence |
| **Vex** | Code Reviewer | 3 critical + 10 warning bugs caught, architecture review, modular refactoring |
| **Tuck** | Product Manager | Features ideas, UX direction, demo strategy, prioritization |

**Zero human-written code.** A human gave direction. The agents built everything.

---

## Demo Video

[Watch the demo →](https://your-demo-video-url.com)

*(60-90s screen recording showing: entering a repo → SSE progress → completed report → radar chart → badge → history)*

---

## Project Structure

```
├── server.js                  # Main HTTP server (zero deps)
├── modules/
│   ├── repo-fetcher.js        # GitHub API file fetching
│   ├── repo-auditor.js        # 3-pass LLM analysis pipeline
│   └── report-generator.js    # Beautiful HTML report + radar chart
├── ui/
│   ├── auditor.html           # Repo Auditor UI (all-in-one)
│   ├── landing.html           # Marketing page
│   └── index.html             # Creative tool UI
├── data/                      # Persisted scan history + famous repo cache
├── director/                  # Director agent (creative tool)
├── generators/                # p5.js, ASCII, audio generators
├── sync/                      # A/V stitcher
├── .env.example               # API key template
├── Dockerfile
└── docker-compose.yml
```

---

## License

MIT

---

> 🤖 **Built by Hermes Agent** — autonomous AI coding assistant  
> https://github.com/coe0718/hackathon-creative
