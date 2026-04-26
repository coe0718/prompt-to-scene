# Director Output Format Specification

## Version: 1.0
## Status: LOCKED

The Director agent interprets a user prompt and outputs a structured JSON spec that all generators consume. This format is final — generators build against it, not around it.

---

## Output Structure

```json
{
  "version": "1.0",
  "prompt": "original user prompt",
  "scene": { ... },
  "audio": { ... },
  "visual": { ... },
  "timing": { ... },
  "metadata": { ... }
}
```

---

## `scene` — Core Scene Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✓ | Short scene identifier (e.g., "neon-rain", "desert-dusk") |
| `mood` | string | ✓ | Primary mood: `energetic`, `calm`, `dark`, `uplifting`, `melancholic`, `chaotic`, `meditative`, `nostalgic` |
| `tempo` | number | ✓ | BPM (40-220) |
| `duration_seconds` | number | ✓ | Target length in seconds (15-300) |
| `genre` | string | ✓ | Music genre for Suno: `pop`, `electronic`, `rock`, `ambient`, `jazz`, `classical`, `hip-hop`, `folk`, `metal`, `experimental` |
| `tags` | string[] | | Additional descriptors (max 5) |

**Example:**
```json
"scene": {
  "name": "neon-rain",
  "mood": "melancholic",
  "tempo": 85,
  "duration_seconds": 45,
  "genre": "electronic",
  "tags": ["synthwave", "retro", "cinematic"]
}
```

---

## `audio` — Suno Generation Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | string | ✓ | Suno-compatible music prompt (max 200 chars) |
| `instrumental` | boolean | | True for no vocals (default: true) |
| `model` | string | | `chirp-3-5`, `chirp-4`, `chirp-4-5` (default: chirp-4) |
| `seed` | number | | Optional seed for reproducibility |
| `custom_mode` | boolean | | Use lyrics/melody tags (default: false) |

**Example:**
```json
"audio": {
  "prompt": "Synthwave electronic with retro 80s synths, slow build, melancholic atmosphere, pulsing bass, dreamy pads",
  "instrumental": true,
  "model": "chirp-4"
}
```

---

## `visual` — p5.js Generator Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `style` | string | ✓ | Visual style: `ascii`, `geometric`, `particles`, `waveform`, `glitch`, `minimal`, `retro`, `organic` |
| `color_palette` | string[] | | Hex colors (2-5) — overrides mood-based defaults |
| `effects` | string[] | | Visual effects: `scanlines`, `noise`, `bloom`, `chromatic`, `vignette`, `scanlines`, `drift` |
| `intensity` | number | | 0.0-1.0, maps to animation speed/complexity (default: 0.5) |
| `ascii_char_set` | string | | Custom char set or `standard`, `blocks`, `detailed` (default: standard) |
| `resolution` | object | | `{ width: number, height: number }` (default: 80x40 for ASCII) |

**Example:**
```json
"visual": {
  "style": "ascii",
  "color_palette": ["#ff00ff", "#00ffff", "#1a1a2e"],
  "effects": ["scanlines", "bloom"],
  "intensity": 0.7,
  "ascii_char_set": "standard",
  "resolution": { "width": 80, "height": 40 }
}
```

---

## `timing` — Sync Layer Data

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `beat_interval_ms` | number | ✓ | ms per beat (60000 / tempo) |
| `bar_length_beats` | number | | Beats per bar (default: 4) |
| `sections` | object[] | | `{ name: string, start_beat: number, end_beat: number }` |
| `key_moments` | object[] | | `{ beat: number, event: string }` — drops, transitions, etc. |

**Example:**
```json
"timing": {
  "beat_interval_ms": 705,
  "bar_length_beats": 4,
  "sections": [
    { "name": "intro", "start_beat": 0, "end_beat": 8 },
    { "name": "build", "start_beat": 8, "end_beat": 24 },
    { "name": "drop", "start_beat": 24, "end_beat": 40 },
    { "name": "outro", "start_beat": 40, "end_beat": 48 }
  ],
  "key_moments": [
    { "beat": 24, "event": "drop" },
    { "beat": 40, "event": "fade" }
  ]
}
```

---

## `metadata` — Processing Info

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `director_model` | string | ✓ | LLM used (e.g., "minimax-m2.5", "kimi-k2.5-nim") |
| `generated_at` | ISO8601 | ✓ | Timestamp |
| `generation_time_ms` | number | | How long Director took |

**Example:**
```json
"metadata": {
  "director_model": "minimax-m2.5",
  "generated_at": "2026-04-25T18:00:00Z",
  "generation_time_ms": 1200
}
```

---

## Validation Rules

1. All `required` fields must be present
2. `tempo` must be 40-220
3. `duration_seconds` must be 15-300
4. `visual.intensity` must be 0.0-1.0
5. `visual.color_palette` max 5 colors
6. `audio.prompt` max 200 characters
7. `scene.tags` max 5 items

---

## Generator Contract

- **Suno**: consumes `audio.*`, `scene.tempo`, `scene.duration_seconds`, `timing.*`
- **p5.js**: consumes `visual.*`, `scene.mood`, `timing.*`, `timing.beat_interval_ms`
- **ASCII Engine**: consumes `visual.style`, `visual.ascii_char_set`, `visual.effects`, `timing.beat_interval_ms`
- **Stitcher**: consumes `timing.*` for A/V sync

---

## Example Full Output

```json
{
  "version": "1.0",
  "prompt": "A cyberpunk cityscape at night with rain and neon lights",
  "scene": {
    "name": "neon-rain",
    "mood": "melancholic",
    "tempo": 85,
    "duration_seconds": 45,
    "genre": "electronic",
    "tags": ["synthwave", "retro", "cinematic"]
  },
  "audio": {
    "prompt": "Synthwave electronic with retro 80s synths, slow build, melancholic atmosphere, pulsing bass, dreamy pads",
    "instrumental": true,
    "model": "chirp-4"
  },
  "visual": {
    "style": "ascii",
    "color_palette": ["#ff00ff", "#00ffff", "#1a1a2e"],
    "effects": ["scanlines", "bloom"],
    "intensity": 0.7,
    "ascii_char_set": "standard",
    "resolution": { "width": 80, "height": 40 }
  },
  "timing": {
    "beat_interval_ms": 705,
    "bar_length_beats": 4,
    "sections": [
      { "name": "intro", "start_beat": 0, "end_beat": 8 },
      { "name": "build", "start_beat": 8, "end_beat": 24 },
      { "name": "drop", "start_beat": 24, "end_beat": 40 },
      { "name": "outro", "start_beat": 40, "end_beat": 48 }
    ],
    "key_moments": [
      { "beat": 24, "event": "drop" },
      { "beat": 40, "event": "fade" }
    ]
  },
  "metadata": {
    "director_model": "minimax-m2.5",
    "generated_at": "2026-04-25T18:00:00Z",
    "generation_time_ms": 1200
  }
}
```