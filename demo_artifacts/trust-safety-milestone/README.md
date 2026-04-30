# Trust & Safety Milestone

**Date:** 2026-04-28
**Commit range:** `30f3e29..d78b726` (4 commits)

## What changed

The PR generator gained judgment — the ability to say "no" with a structured explanation instead of either (a) generating a low-quality patch, or (b) failing with a stack trace.

## Gate architecture

```
┌─ Audit Output ──────────────────────────────────────┐
│  125 findings                                        │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Gate 1: Upstream filter ───────────────────────────┐
│  Removes docs/**, *.mdx, examples/** from deep       │
│  analysis input. Doc files never reach the LLM.      │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Gate 2: Selector prompt (LLM-level) ───────────────┐
│  HARD REJECT:  docs, generated, vendor, lockfiles,   │
│                test fixtures, coverage               │
│  PREFERRED:    src/**, lib/**, app/**, crates/**     │
│  Structured rejection output when no candidate passes│
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Gate 3a: Post-extraction (code-level) ─────────────┐
│  Regex match on file path:                           │
│  - .md, .mdx, .txt, .rst                             │
│  - dist/, build/, target/, vendor/, node_modules/    │
│  - *.lock, *.min.js                                  │
│  - fixtures/, __snapshots__/, coverage/              │
│  - Soft warn on test/ paths                          │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Step 2: Fetch file ─────────────────────────────────┐
│  GitHub API with tree-search 404 fallback             │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Gate 3b: Post-fixer (code-level) ──────────────────┐
│  Reject if:                                           │
│  - No test_command, lint_command, or static_validation│
│  - Output matches original (no-op fix)                │
└──────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ Output ─────────────────────────────────────────────┐
│  Success: dry_run with patch + PR draft              │
│  Rejection: { status: "no_safe_candidate", ... }     │
│             Exit code 0. Intentional.                 │
└──────────────────────────────────────────────────────┘
```

## Rejection output structure

```json
{
  "status": "no_safe_candidate",
  "decision": "No dry-run PR package generated because all candidates failed first-demo safety gates.",
  "audited_findings": 125,
  "evaluated_count": 41,
  "explicit_rejection_count": 55,
  "selected_count": 0,
  "safety_gates": [
    "single code file only",
    "non-doc source change",
    "validation command required",
    "patch must apply",
    "low blast radius",
    "non-speculative finding"
  ],
  "rejection_summary": {
    "docs_only": 12,
    "generated_or_vendor": 4,
    "test_only": 7,
    "multi_file_required": 3,
    "missing_validation": 9,
    "speculative_or_low_confidence": 18,
    "patch_failed_apply_check": 2
  },
  "human_summary": "The agent audited 125 findings and deeply evaluated 41 candidate findings. Those candidates triggered 55 total safety-gate failures across categories. No candidate met the full first-demo PR bar."
}
```

## Commit narrative

| Commit | Message |
|--------|---------|
| `30f3e29` | Add 3 gates + structured rejection to PR selector |
| `26c99f5` | Test script: friendly rejection output, no exception paths |
| `e109c10` | Structured rejection output: metrics over vibes |
| `d78b726` | Fix rejection wording: 55 = gate failures across candidates |

## Why this matters

A system that says "no" with receipts is ten times more trustworthy than one that confidently mails garbage to maintainers. This milestone establishes that the agent has **brakes** — not just steering.

## Next

Run against a repo with a known code-level bug to demonstrate the success path alongside the no-op path.
