/**
 * Preset Scene Specs — 20 hand-crafted scenes that work without an LLM
 * 
 * Covers all 8 moods × all 8 visual styles
 * Used by: Surprise Me button, preset slots (Shift+1-8), LLM fallback
 */

const PRESETS = [
  // ═══ ENERGETIC ═══
  {
    version: "1.0",
    prompt: "A neon-drenched cyberpunk rave",
    scene: {
      name: "neon-rave",
      mood: "energetic",
      tempo: 140,
      duration_seconds: 45,
      genre: "electronic",
      tags: ["cyberpunk", "rave", "neon"]
    },
    audio: {
      prompt: "High-energy cyberpunk electronic rave, pounding 140bpm four-on-floor kick, aggressive synth stabs, glitchy arpeggios, massive drops",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "glitch",
      color_palette: ["#ff00ff", "#00ffff", "#ff6600", "#1a0033"],
      effects: ["chromatic", "bloom", "noise"],
      intensity: 0.9,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 429,
      bar_length_beats: 4,
      sections: [
        { name: "build", start_beat: 0, end_beat: 16 },
        { name: "drop", start_beat: 16, end_beat: 48 },
        { name: "breakdown", start_beat: 48, end_beat: 64 },
        { name: "final-drop", start_beat: 64, end_beat: 80 }
      ],
      key_moments: [
        { beat: 16, event: "drop" },
        { beat: 48, event: "breakdown" },
        { beat: 64, event: "drop" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Summer festival main stage",
    scene: {
      name: "festival-fire",
      mood: "energetic",
      tempo: 128,
      duration_seconds: 60,
      genre: "pop",
      tags: ["festival", "summer", "anthem"]
    },
    audio: {
      prompt: "Euphoric festival anthem, big room house beat at 128bpm, soaring vocal chops, uplifting supersaw chords, confetti-drop energy",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "particles",
      color_palette: ["#ff6b6b", "#feca57", "#ff9ff3", "#54a0ff", "#ffffff"],
      effects: ["bloom", "drift"],
      intensity: 0.85,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 469,
      bar_length_beats: 4,
      sections: [
        { name: "intro", start_beat: 0, end_beat: 16 },
        { name: "build", start_beat: 16, end_beat: 32 },
        { name: "drop", start_beat: 32, end_beat: 64 },
        { name: "outro", start_beat: 64, end_beat: 80 }
      ],
      key_moments: [
        { beat: 32, event: "drop" },
        { beat: 64, event: "fade" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  // ═══ CALM ═══
  {
    version: "1.0",
    prompt: "Gentle ocean waves at sunset",
    scene: {
      name: "ocean-sunset",
      mood: "calm",
      tempo: 70,
      duration_seconds: 60,
      genre: "ambient",
      tags: ["ocean", "sunset", "meditation"]
    },
    audio: {
      prompt: "Peaceful ambient soundscape with soft pads, gentle ocean wave textures, warm lo-fi tones, slow evolving chords, calming atmosphere",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "organic",
      color_palette: ["#ff9a76", "#fbc2eb", "#a8edea", "#fed6e3"],
      effects: ["drift", "vignette"],
      intensity: 0.3,
      ascii_char_set: "detailed",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 857,
      bar_length_beats: 4,
      sections: [
        { name: "drift", start_beat: 0, end_beat: 32 },
        { name: "swell", start_beat: 32, end_beat: 48 },
        { name: "drift", start_beat: 48, end_beat: 72 }
      ],
      key_moments: [
        { beat: 32, event: "swell" },
        { beat: 48, event: "fade" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Morning dew in a Japanese garden",
    scene: {
      name: "zen-garden",
      mood: "calm",
      tempo: 60,
      duration_seconds: 45,
      genre: "classical",
      tags: ["zen", "garden", "morning"]
    },
    audio: {
      prompt: "Delicate solo piano with Japanese koto, gentle rain sounds, meditative sparse arrangement, morning tranquility",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "minimal",
      color_palette: ["#d4f1c5", "#a8e6cf", "#dcedc1", "#ffd3b6"],
      effects: ["vignette"],
      intensity: 0.25,
      ascii_char_set: "blocks",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 1000,
      bar_length_beats: 4,
      sections: [
        { name: "intro", start_beat: 0, end_beat: 8 },
        { name: "flow", start_beat: 8, end_beat: 40 }
      ],
      key_moments: [
        { beat: 8, event: "begin" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  // ═══ DARK ═══
  {
    version: "1.0",
    prompt: "Cyberpunk city at 3am in the rain",
    scene: {
      name: "neon-rain",
      mood: "dark",
      tempo: 85,
      duration_seconds: 45,
      genre: "electronic",
      tags: ["cyberpunk", "rain", "noir"]
    },
    audio: {
      prompt: "Dark synthwave with pulsing bass, rain ambience, retro 80s synths, slow cinematic build, melancholic and atmospheric",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "ASCII",
      color_palette: ["#ff00ff", "#00ffff", "#1a1a2e", "#0d0d0d"],
      effects: ["scanlines", "noise", "vignette"],
      intensity: 0.6,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 705,
      bar_length_beats: 4,
      sections: [
        { name: "intro", start_beat: 0, end_beat: 8 },
        { name: "build", start_beat: 8, end_beat: 24 },
        { name: "drop", start_beat: 24, end_beat: 40 },
        { name: "outro", start_beat: 40, end_beat: 48 }
      ],
      key_moments: [
        { beat: 24, event: "drop" },
        { beat: 40, event: "fade" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Abandoned industrial factory at night",
    scene: {
      name: "dark-factory",
      mood: "dark",
      tempo: 100,
      duration_seconds: 45,
      genre: "metal",
      tags: ["industrial", "abandoned", "horror"]
    },
    audio: {
      prompt: "Heavy industrial metal with distorted machinery sounds, dark ambient drones, aggressive percussion, ominous atmosphere",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "glitch",
      color_palette: ["#ff0000", "#1a0000", "#330000", "#660000"],
      effects: ["noise", "chromatic", "scanlines"],
      intensity: 0.8,
      ascii_char_set: "blocks",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 600,
      bar_length_beats: 4,
      sections: [
        { name: "creep", start_beat: 0, end_beat: 16 },
        { name: "assault", start_beat: 16, end_beat: 48 },
        { name: "decay", start_beat: 48, end_beat: 60 }
      ],
      key_moments: [
        { beat: 16, event: "assault" },
        { beat: 48, event: "breakdown" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  // ═══ UPLIFTING ═══
  {
    version: "1.0",
    prompt: "Sunrise over mountain peaks",
    scene: {
      name: "mountain-dawn",
      mood: "uplifting",
      tempo: 110,
      duration_seconds: 45,
      genre: "folk",
      tags: ["mountains", "sunrise", "adventure"]
    },
    audio: {
      prompt: "Uplifting folk with acoustic guitar, swelling strings, gentle percussion, hopeful melody, sunrise warmth, cinematic build",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "geometric",
      color_palette: ["#f8b500", "#ff6f91", "#c44569", "#fff3cd"],
      effects: ["bloom", "drift"],
      intensity: 0.65,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 545,
      bar_length_beats: 4,
      sections: [
        { name: "dawn", start_beat: 0, end_beat: 16 },
        { name: "ascent", start_beat: 16, end_beat: 40 },
        { name: "peak", start_beat: 40, end_beat: 56 }
      ],
      key_moments: [
        { beat: 16, event: "rise" },
        { beat: 40, event: "peak" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Colorful hot air balloons at dawn",
    scene: {
      name: "balloon-fest",
      mood: "uplifting",
      tempo: 95,
      duration_seconds: 45,
      genre: "pop",
      tags: ["balloons", "festival", "colorful"]
    },
    audio: {
      prompt: "Whimsical indie pop with glockenspiel, bouncy bass, handclaps, joyful melody, colorful and bright, parade energy",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "organic",
      color_palette: ["#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#1dd1a1"],
      effects: ["bloom", "drift"],
      intensity: 0.7,
      ascii_char_set: "detailed",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 632,
      bar_length_beats: 4,
      sections: [
        { name: "lift", start_beat: 0, end_beat: 16 },
        { name: "float", start_beat: 16, end_beat: 48 },
        { name: "land", start_beat: 48, end_beat: 60 }
      ],
      key_moments: [
        { beat: 16, event: "float" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  // ═══ MELANCHOLIC ═══
  {
    version: "1.0",
    prompt: "Empty train station in the rain",
    scene: {
      name: "rain-station",
      mood: "melancholic",
      tempo: 75,
      duration_seconds: 60,
      genre: "ambient",
      tags: ["rain", "lonely", "cinematic"]
    },
    audio: {
      prompt: "Melancholic ambient with distant piano, rain sounds, warm pads, slow emotional build, cinematic sorrow, empty spaces",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "minimal",
      color_palette: ["#2c3e50", "#3498db", "#1abc9c", "#34495e"],
      effects: ["vignette", "scanlines"],
      intensity: 0.35,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 800,
      bar_length_beats: 4,
      sections: [
        { name: "arrival", start_beat: 0, end_beat: 8 },
        { name: "waiting", start_beat: 8, end_beat: 32 },
        { name: "departure", start_beat: 32, end_beat: 48 }
      ],
      key_moments: [
        { beat: 32, event: "depart" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Last light through autumn leaves",
    scene: {
      name: "autumn-dusk",
      mood: "melancholic",
      tempo: 80,
      duration_seconds: 45,
      genre: "jazz",
      tags: ["autumn", "nostalgia", "golden-hour"]
    },
    audio: {
      prompt: "Mellow jazz with brushed drums, warm double bass, soft saxophone, autumn melancholy, golden hour nostalgia",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "retro",
      color_palette: ["#f4a460", "#d2691e", "#8b4513", "#deb887"],
      effects: ["vignette", "scanlines"],
      intensity: 0.4,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 750,
      bar_length_beats: 4,
      sections: [
        { name: "dusk", start_beat: 0, end_beat: 16 },
        { name: "golden", start_beat: 16, end_beat: 40 },
        { name: "twilight", start_beat: 40, end_beat: 48 }
      ],
      key_moments: [
        { beat: 16, event: "shift" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  // ═══ CHAOTIC ═══
  {
    version: "1.0",
    prompt: "Digital glitch storm, reality breaking",
    scene: {
      name: "glitch-storm",
      mood: "chaotic",
      tempo: 180,
      duration_seconds: 30,
      genre: "experimental",
      tags: ["glitch", "chaos", "digital"]
    },
    audio: {
      prompt: "Chaotic experimental electronic, 180bpm breakcore, glitched drums, harsh noise bursts, data corruption sounds, aggressive and intense",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "glitch",
      color_palette: ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"],
      effects: ["glitch", "chromatic", "noise"],
      intensity: 1.0,
      ascii_char_set: "blocks",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 333,
      bar_length_beats: 4,
      sections: [
        { name: "corrupt", start_beat: 0, end_beat: 16 },
        { name: "cascade", start_beat: 16, end_beat: 48 },
        { name: "meltdown", start_beat: 48, end_beat: 72 },
        { name: "void", start_beat: 72, end_beat: 80 }
      ],
      key_moments: [
        { beat: 16, event: "cascade" },
        { beat: 48, event: "meltdown" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Exploding supernova, cosmic chaos",
    scene: {
      name: "supernova",
      mood: "chaotic",
      tempo: 160,
      duration_seconds: 30,
      genre: "electronic",
      tags: ["space", "explosion", "cosmic"]
    },
    audio: {
      prompt: "Cosmic electronic chaos, 160bpm, distorted synths, massive explosions, stuttering beats, space-time distortion, overwhelming energy",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "particles",
      color_palette: ["#ffffff", "#ffdd00", "#ff6600", "#ff0000", "#6600ff"],
      effects: ["bloom", "drift"],
      intensity: 1.0,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 375,
      bar_length_beats: 4,
      sections: [
        { name: "implode", start_beat: 0, end_beat: 8 },
        { name: "explode", start_beat: 8, end_beat: 40 },
        { name: "expand", start_beat: 40, end_beat: 64 }
      ],
      key_moments: [
        { beat: 8, event: "explode" },
        { beat: 40, event: "expand" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  // ═══ MEDITATIVE ═══
  {
    version: "1.0",
    prompt: "Deep space meditation, floating through nebulae",
    scene: {
      name: "cosmic-float",
      mood: "meditative",
      tempo: 50,
      duration_seconds: 90,
      genre: "ambient",
      tags: ["space", "meditation", "nebula"]
    },
    audio: {
      prompt: "Deep space ambient, floating drone, slow evolving textures, distant star sounds, meditative bass frequencies, infinite vastness",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "organic",
      color_palette: ["#2d1b69", "#5b2c8e", "#8b5cf6", "#c4b5fd", "#1a0033"],
      effects: ["drift", "vignette"],
      intensity: 0.2,
      ascii_char_set: "detailed",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 1200,
      bar_length_beats: 4,
      sections: [
        { name: "emerge", start_beat: 0, end_beat: 16 },
        { name: "drift", start_beat: 16, end_beat: 64 },
        { name: "dissolve", start_beat: 64, end_beat: 80 }
      ],
      key_moments: [
        { beat: 16, event: "drift" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Tibetan singing bowls in a mountain temple",
    scene: {
      name: "temple-bowls",
      mood: "meditative",
      tempo: 45,
      duration_seconds: 60,
      genre: "classical",
      tags: ["temple", "meditation", "sacred"]
    },
    audio: {
      prompt: "Sacred meditation with singing bowls, temple bells, deep harmonic overtones, gentle wind, ancient mountain atmosphere, pure resonance",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "minimal",
      color_palette: ["#1a1a1a", "#2d2d2d", "#404040", "#f5deb3"],
      effects: ["vignette", "drift"],
      intensity: 0.15,
      ascii_char_set: "blocks",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 1333,
      bar_length_beats: 4,
      sections: [
        { name: "strike", start_beat: 0, end_beat: 4 },
        { name: "resonate", start_beat: 4, end_beat: 32 },
        { name: "fade", start_beat: 32, end_beat: 40 }
      ],
      key_moments: [
        { beat: 4, event: "resonance" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  // ═══ NOSTALGIC ═══
  {
    version: "1.0",
    prompt: "VHS memories of summer 1985",
    scene: {
      name: "vhs-summer",
      mood: "nostalgic",
      tempo: 90,
      duration_seconds: 45,
      genre: "pop",
      tags: ["80s", "summer", "retro"]
    },
    audio: {
      prompt: "80s synth-pop with warm analog synths, gated reverb drums, nostalgic melody, VHS warmth, summer vibes, cassette tape saturation",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "retro",
      color_palette: ["#f4a460", "#d2691e", "#8b4513", "#ffd700"],
      effects: ["scanlines", "vignette", "noise"],
      intensity: 0.55,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 667,
      bar_length_beats: 4,
      sections: [
        { name: "rewind", start_beat: 0, end_beat: 8 },
        { name: "memory", start_beat: 8, end_beat: 40 },
        { name: "fade-out", start_beat: 40, end_beat: 48 }
      ],
      key_moments: [
        { beat: 8, event: "memory" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Old film projector in an empty cinema",
    scene: {
      name: "old-cinema",
      mood: "nostalgic",
      tempo: 70,
      duration_seconds: 60,
      genre: "jazz",
      tags: ["cinema", "vintage", "film-noir"]
    },
    audio: {
      prompt: "Vintage cinema jazz, warm crackling vinyl, soft brush drums, smoky saxophone, film projector ambiance, golden age nostalgia",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "waveform",
      color_palette: ["#deb887", "#d2b48c", "#8b7355", "#3c1414"],
      effects: ["scanlines", "vignette"],
      intensity: 0.45,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 857,
      bar_length_beats: 4,
      sections: [
        { name: "flicker", start_beat: 0, end_beat: 8 },
        { name: "feature", start_beat: 8, end_beat: 40 },
        { name: "credits", start_beat: 40, end_beat: 48 }
      ],
      key_moments: [
        { beat: 8, event: "begin" },
        { beat: 40, event: "end" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  // ═══ BONUS: CROSS-GENRE ═══
  {
    version: "1.0",
    prompt: "Underwater rave with bioluminescent sea creatures",
    scene: {
      name: "abyss-rave",
      mood: "energetic",
      tempo: 135,
      duration_seconds: 45,
      genre: "electronic",
      tags: ["underwater", "bioluminescent", "deep-sea"]
    },
    audio: {
      prompt: "Deep sea electronic, 135bpm, filtered underwater bass, bubbling textures, bioluminescent synth sparkles, aquatic drops, murky atmosphere",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "organic",
      color_palette: ["#00ffcc", "#0066ff", "#6600ff", "#00ff88", "#003366"],
      effects: ["bloom", "drift"],
      intensity: 0.75,
      ascii_char_set: "detailed",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 444,
      bar_length_beats: 4,
      sections: [
        { name: "descent", start_beat: 0, end_beat: 16 },
        { name: "deep-rave", start_beat: 16, end_beat: 48 },
        { name: "surface", start_beat: 48, end_beat: 64 }
      ],
      key_moments: [
        { beat: 16, event: "drop" },
        { beat: 48, event: "rise" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Desert highway at midnight, lone rider",
    scene: {
      name: "desert-ride",
      mood: "dark",
      tempo: 95,
      duration_seconds: 60,
      genre: "rock",
      tags: ["desert", "highway", "western"]
    },
    audio: {
      prompt: "Desert rock with gritty guitar, steady driving beat at 95bpm, cinematic western atmosphere, lonesome harmonica, dusty open road",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "geometric",
      color_palette: ["#c0392b", "#e67e22", "#f39c12", "#1a0a00"],
      effects: ["vignette", "drift"],
      intensity: 0.6,
      ascii_char_set: "standard",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 632,
      bar_length_beats: 4,
      sections: [
        { name: "ride-out", start_beat: 0, end_beat: 16 },
        { name: "chase", start_beat: 16, end_beat: 48 },
        { name: "horizon", start_beat: 48, end_beat: 64 }
      ],
      key_moments: [
        { beat: 16, event: "chase" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  },

  {
    version: "1.0",
    prompt: "Cherry blossoms falling in spring breeze",
    scene: {
      name: "sakura-fall",
      mood: "uplifting",
      tempo: 88,
      duration_seconds: 45,
      genre: "folk",
      tags: ["sakura", "spring", "peaceful"]
    },
    audio: {
      prompt: "Gentle Japanese folk with shamisen and shakuhachi, soft taiko pulse, cherry blossom breeze, peaceful spring atmosphere, warm sunshine",
      instrumental: true,
      model: "chirp-4"
    },
    visual: {
      style: "waveform",
      color_palette: ["#ffb7c5", "#ffd1dc", "#fff0f5", "#ff69b4", "#ff1493"],
      effects: ["bloom", "drift"],
      intensity: 0.5,
      ascii_char_set: "detailed",
      resolution: { width: 80, height: 40 }
    },
    timing: {
      beat_interval_ms: 682,
      bar_length_beats: 4,
      sections: [
        { name: "breeze", start_beat: 0, end_beat: 16 },
        { name: "petals", start_beat: 16, end_beat: 48 },
        { name: "settle", start_beat: 48, end_beat: 56 }
      ],
      key_moments: [
        { beat: 16, event: "bloom" }
      ]
    },
    metadata: {
      director_model: "preset",
      generated_at: new Date().toISOString(),
      generation_time_ms: 0
    }
  }
];

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRESETS };
}
