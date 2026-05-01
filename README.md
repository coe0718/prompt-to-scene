# Archiview

> **Autonomous code review by AI agents.**  
> Point it at any public GitHub repo. It reads the codebase, analyzes architecture, scores code quality, checks for security issues, and generates a beautiful audit report — entirely autonomously.

**🏆 AI Code Audit Tool Submission · Due May 3, 2026**  
**🎯 Kimi K2.6 Track ($5k bonus) — powered by OpenRouter**

[![Self Audit](https://audit.patchhive.dev/api/audit/badge?repo=coe0718/archiview)](https://audit.patchhive.dev/?repo=coe0718/archiview)

---

## What It Does

Archiview runs a **3-pass LLM analysis** on any public GitHub repository:

| Pass | What Happens | Time |
|------|-------------|------|
| **1. Structural Analysis** | Reads README, config files, directory tree → maps architecture, framework, language, build system | ~10s |
| **2. Deep Code Review** (MiniMax M2.7) | Source files chunked and analyzed for code quality, security, maintainability — one file at a time | ~15-60s |
| **3. Aggregation** | All findings merged into final scores, prioritized recommendations, risks, and verdict | ~10s |

**Two models, one pipeline:** Kimi K2.6 handles structural analysis, aggregation, and fix generation. MiniMax M2.7 handles deep code review and PR candidate selection. Both via OpenRouter. Live SSE streaming shows progress in real time.

### Sample Repo Scores

<!-- Famous repo results load dynamically — these are populated by the background seeder -->
Click any to audit it yourself.

[Audit expressjs/express](https://audit.patchhive.dev/?repo=expressjs/express) · [Audit facebook/react](https://audit.patchhive.dev/?repo=facebook/react) · [Audit vuejs/core](https://audit.patchhive.dev/?repo=vuejs/core) · [Audit coe0718/archiview (self-audit)](https://audit.patchhive.dev/?repo=coe0718/archiview)

---

## Quick Start

```bash
# Clone
git clone https://github.com/coe0718/archiview && cd archiview

# Set up API keys
cp .env.example .env
# Edit .env — add your OPENROUTER_API_KEY (required for Kimi K2.6 + MiniMax M2.7)
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
| **Live SSE Streaming** | Watch each pass's reasoning steps in real time |
| **Prioritized Findings** | CRITICAL / WARNING / INFO with file locations and fix suggestions |
| **Smart PR Generation** | Evaluates findings through safety gates (no docs, no vendor, validation required), generates unified diffs, and produces human-reviewable dry-run packages with structured rejection summaries — no auto-push, no noise |
| **Download Report** | Standalone HTML file, all CSS inlined, no server needed |
| **Print / Save as PDF** | Opens report in new window with print dialog |
| **SVG Badge** | `[![Archiview](https://audit.patchhive.dev/api/audit/badge?repo=user/repo)](...)` — paste in any README |
| **Share Links** | Add `?repo=user/repo` to URL — shareable, auto-loads and runs |
| **Scan History** | Persisted to disk, survives restarts, shows ↑↓→ trend arrows |
| **Famous Repo Showcase** | Background-seeded scores for Express, React, Vue, Jest |
| **Self-Audit** | Click "🔍 self-audit" — the auditor audits its own codebase |
| **File Count Selector** | Choose 10/25/50/100 files for depth vs. speed control |
| **One-Click Re-audit** | Click any history entry to re-run |

---

## Badge

Add this badge to your project's README after running an audit:

```
[![Archiview](https://audit.patchhive.dev/api/audit/badge?repo=user/repo)](https://audit.patchhive.dev/?repo=user/repo)
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

---

## Tech Stack

| Layer | Tech |
|-------|------|
| **Server** | Node.js (zero npm deps) |
|| **Kimi K2.6** | Structural analysis, aggregation, fix generation via OpenRouter |
|| **MiniMax M2.7** | Deep code review, PR candidate selection via OpenRouter |
| **Frontend** | Pure HTML/CSS/JS (no build step) |
| **Containers** | Docker + compose |

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
│   └── landing.html           # Marketing page
├── data/                      # Persisted scan history + famous repo cache
├── .env.example               # API key template
├── Dockerfile
└── compose.yml
```

---

## License

MIT

---

> 🤖 **Built by Drey + Vex + Tuck** — autonomous AI agents
> https://github.com/coe0718/archiview
