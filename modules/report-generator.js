/**
 * Report Generator — Beautiful HTML audit reports
 *
 * Takes audit results → self-contained dark-themed HTML report
 * No external dependencies (CSS inlined, no CDN)
 */

function generateReport(auditResult, repoUrl) {
  const { metadata, scores, findings, recommendations, strengths, risks, summary, verdict, architecture, statistics, generated_at } = auditResult;

  const scoreBar = (label, val, color) => `
    <div class="score-row">
      <div class="score-label">${label}</div>
      <div class="score-bar-bg">
        <div class="score-bar" data-width="${val}" style="background:${color}"></div>
      </div>
      <div class="score-val">${val}</div>
    </div>`;

  const scoreColor = (v) =>
    v >= 85 ? '#4ade80' : v >= 65 ? '#fbbf24' : v >= 45 ? '#fb923c' : '#f87171';

  const radarChart = (s) => {
    const keys = ['architecture', 'code_quality', 'security', 'documentation', 'maintainability'];
    const labels = ['Architecture', 'Code Quality', 'Security', 'Documentation', 'Maint\'ability'];
    const cx = 180, cy = 180, maxR = 140;
    const angle = (i) => (Math.PI / 180) * (-90 + i * 72);
    const point = (r, i) => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];

    // Grid rings (20, 40, 60, 80, 100)
    let rings = '';
    for (let r = 20; r <= 100; r += 20) {
      const pts = [];
      for (let i = 0; i < 5; i++) pts.push(point(r / 100 * maxR, i).join(','));
      rings += `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    }

    // Axes
    let axes = '';
    for (let i = 0; i < 5; i++) {
      const [x2, y2] = point(maxR, i);
      axes += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    }

    // Data polygon
    const dataPts = [];
    for (let i = 0; i < 5; i++) {
      const val = Math.min(Math.max(s?.[keys[i]] || 0, 0), 100);
      dataPts.push(point(val / 100 * maxR, i).join(','));
    }
    const avgScore = Math.round(keys.reduce((sum, k) => sum + (s?.[k] || 0), 0) / 5);
    const fillColor = scoreColor(avgScore);

    // Axis labels
    let labelTexts = '';
    for (let i = 0; i < 5; i++) {
      const [x, y] = point(maxR + 22, i);
      labelTexts += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.5)" font-size="11" font-family="Inter,sans-serif">${labels[i]}</text>`;
    }

    // Value labels at data points
    let valueTexts = '';
    for (let i = 0; i < 5; i++) {
      const val = Math.min(Math.max(s?.[keys[i]] || 0, 0), 100);
      const [x, y] = point(val / 100 * maxR + 16, i);
      valueTexts += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="${scoreColor(val)}" font-size="11" font-weight="600" font-family="Inter,sans-serif">${val}</text>`;
    }

    return `<div style="display:inline-block;padding:16px;">
      <div style="font-size:0.85rem;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em;">Health Radar</div>
      <svg width="360" height="380" viewBox="0 0 360 380" xmlns="http://www.w3.org/2000/svg">
        ${rings}
        ${axes}
        <polygon points="${dataPts.join(' ')}" fill="${fillColor}" fill-opacity="0.2" stroke="${fillColor}" stroke-width="2"/>
        ${dataPts.map((pt, i) => {
          const [x, y] = pt.split(',');
          return `<circle cx="${x}" cy="${y}" r="4" fill="${fillColor}" stroke="#06060e" stroke-width="2"/>`;
        }).join('')}
        ${labelTexts}
        ${valueTexts}
      </svg>
    </div>`;
  };

  const findingsHtml = (findings || []).map(f => {
    const severityColor = f.severity === 'CRITICAL' ? 'var(--red)' : f.severity === 'WARNING' ? 'var(--amber)' : 'var(--cyan)';
    return `<div class="finding" style="border-left:3px solid ${severityColor}">
      <div class="finding-header">
        <span class="finding-severity" style="color:${severityColor}">${f.severity}</span>
        <span class="finding-category">${f.category || ''}</span>
        <span class="finding-file">${f.file || ''}</span>
      </div>
      <div class="finding-title">${escHtml(f.title)}</div>
      <div class="finding-desc">${escHtml(f.description || '')}</div>
      ${f.suggestion ? `<div class="finding-suggestion">💡 ${escHtml(f.suggestion)}</div>` : ''}
    </div>`;
  }).join('\n');

  const recsHtml = (recommendations || []).map(r => `
    <div class="rec">
      <div class="rec-priority" style="color:${r.priority === 'high' ? 'var(--red)' : r.priority === 'medium' ? 'var(--amber)' : 'var(--cyan)'}">
        ${r.priority === 'high' ? '⚠️' : r.priority === 'medium' ? '📌' : '💡'} ${r.priority}
      </div>
      <div class="rec-action">${escHtml(r.action)}</div>
      <div class="rec-meta">${r.effort || ''} · ${r.impact || ''} impact</div>
    </div>
  `).join('\n');

  const strengthsHtml = (strengths || []).map(s => `<li>${escHtml(s)}</li>`).join('\n');
  const risksHtml = (risks || []).map(r => `<li class="risk">⚠️ ${escHtml(r)}</li>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Audit Report: ${escHtml(metadata?.full_name || 'Repository')}</title>
<style>
  :root {
    --bg: #080b14;
    --surface: rgba(255,255,255,0.04);
    --surface2: rgba(255,255,255,0.07);
    --border: rgba(255,255,255,0.08);
    --text: #e8eaf0;
    --muted: #8892a4;
    --accent: #7c5cfc;
    --green: #4ade80;
    --amber: #fbbf24;
    --red: #f87171;
    --cyan: #22d3ee;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
  }
  .container { max-width: 900px; margin: 0 auto; padding: 0 24px; }

  /* Header */
  .header {
    padding: 48px 0 32px;
    border-bottom: 1px solid var(--border);
  }
  .header .badge {
    display: inline-block; padding: 3px 10px; border-radius: 99px;
    background: rgba(124,92,252,0.15); border: 1px solid rgba(124,92,252,0.3);
    font-size: 0.72rem; color: var(--accent); letter-spacing: 0.06em;
    text-transform: uppercase; margin-bottom: 12px;
  }
  .header h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 8px; }
  .header .repo-meta { color: var(--muted); font-size: 0.9rem; }
  .header .repo-meta span { margin-right: 16px; }
  .header .summary { margin-top: 16px; font-size: 0.95rem; color: rgba(255,255,255,0.8); max-width: 700px; }

  /* Score Dashboard */
  .dashboard { padding: 32px 0; }
  .dashboard h2 { font-size: 1.2rem; font-weight: 700; margin-bottom: 20px; }
  .score-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }
  .score-card {
    padding: 20px; border-radius: 12px;
    background: var(--surface); border: 1px solid var(--border);
  }
  .score-card .score-title { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 8px; }
  .score-card .score-number {
    font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em;
  }
  .score-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .score-label { width: 130px; font-size: 0.85rem; color: var(--muted); flex-shrink: 0; }
  .score-bar-bg { flex: 1; height: 8px; background: var(--surface2); border-radius: 4px; overflow: hidden; }
  .score-bar { height: 100%; border-radius: 4px; width: 0; transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1); }
  .score-val { width: 30px; text-align: right; font-size: 0.85rem; font-weight: 600; color: var(--text); }

  /* Architecture */
  .arch-section { padding: 32px 0; border-top: 1px solid var(--border); }
  .arch-section h2 { font-size: 1.2rem; font-weight: 700; margin-bottom: 16px; }
  .arch-card {
    padding: 20px; border-radius: 12px;
    background: var(--surface); border: 1px solid var(--border);
    margin-bottom: 16px;
  }
  .arch-card h3 { font-size: 0.9rem; font-weight: 600; color: var(--accent); margin-bottom: 8px; }
  .arch-card p { font-size: 0.88rem; color: var(--muted); line-height: 1.7; }
  .arch-tags { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  .arch-tag {
    padding: 3px 10px; border-radius: 99px;
    background: rgba(124,92,252,0.1); border: 1px solid rgba(124,92,252,0.2);
    font-size: 0.75rem; color: var(--accent);
  }

  /* Findings */
  .findings-section { padding: 32px 0; border-top: 1px solid var(--border); }
  .findings-section h2 { font-size: 1.2rem; font-weight: 700; margin-bottom: 16px; }
  .findings-count {
    display: flex; gap: 16px; margin-bottom: 20px;
  }
  .findings-count .count-item {
    padding: 8px 16px; border-radius: 8px;
    background: var(--surface); border: 1px solid var(--border);
    font-size: 0.85rem;
  }
  .finding {
    padding: 16px; border-radius: 8px;
    background: var(--surface); border: 1px solid var(--border);
    margin-bottom: 10px;
  }
  .finding-header { display: flex; gap: 12px; margin-bottom: 6px; font-size: 0.75rem; }
  .finding-severity { font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
  .finding-category { color: var(--muted); }
  .finding-file { color: var(--muted); margin-left: auto; font-family: monospace; }
  .finding-title { font-weight: 600; font-size: 0.9rem; margin-bottom: 4px; }
  .finding-desc { font-size: 0.85rem; color: var(--muted); line-height: 1.5; }
  .finding-suggestion { font-size: 0.82rem; color: var(--cyan); margin-top: 6px; padding: 6px 10px; background: rgba(34,211,238,0.06); border-radius: 4px; }

  /* Recommendations */
  .recs-section { padding: 32px 0; border-top: 1px solid var(--border); }
  .recs-section h2 { font-size: 1.2rem; font-weight: 700; margin-bottom: 16px; }
  .rec {
    padding: 14px 16px; border-radius: 8px;
    background: var(--surface); border: 1px solid var(--border);
    margin-bottom: 8px;
    display: flex; align-items: flex-start; gap: 12px;
  }
  .rec-priority { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; white-space: nowrap; width: 70px; flex-shrink: 0; }
  .rec-action { flex: 1; font-size: 0.88rem; }
  .rec-meta { font-size: 0.75rem; color: var(--muted); white-space: nowrap; }

  /* Strengths & Risks */
  .sr-section { padding: 32px 0; border-top: 1px solid var(--border); }
  .sr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sr-box { padding: 20px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); }
  .sr-box h3 { font-size: 0.9rem; font-weight: 600; margin-bottom: 12px; }
  .sr-box li { font-size: 0.85rem; color: var(--muted); margin-bottom: 8px; list-style: none; }
  .sr-box .risk { color: var(--red); }

  /* Stats */
  .stats-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 16px 0; }
  .stat-chip {
    padding: 4px 12px; border-radius: 99px;
    background: var(--surface); border: 1px solid var(--border);
    font-size: 0.78rem; color: var(--muted);
  }

  /* Radar Chart */
  .radar-section { padding: 20px 0; text-align: center; border-top: 1px solid var(--border); }
  .radar-section svg { max-width: 360px; height: auto; }

  /* Footer */
  .footer {
    padding: 32px 0; border-top: 1px solid var(--border);
    text-align: center; font-size: 0.82rem; color: var(--muted);
  }

  @media (max-width: 640px) {
    .sr-grid { grid-template-columns: 1fr; }
    .score-grid { grid-template-columns: 1fr; }
    .rec { flex-direction: column; }
  }
</style>
</head>
<body>

<div class="container">

  <!-- Header -->
  <div class="header">
    <div class="badge">🤖 Hermes Repo Auditor</div>
    <h1>${escHtml(metadata?.full_name || 'Repository Audit')}</h1>
    <div class="repo-meta">
      <span>⭐ ${metadata?.stars || 0}</span>
      <span>🔤 ${metadata?.language || 'Unknown'}</span>
      <span>📁 ${statistics?.analyzed_files || 0} files analyzed</span>
      <span>📐 ${statistics?.total_lines || 0} lines</span>
    </div>
    <div class="summary">${escHtml(summary || '')}</div>
  </div>

  <!-- Stats -->
  ${(findings || []).length > 0 ? `<div class="stats-row">
    <span class="stat-chip" style="color:var(--red);border-color:rgba(248,113,113,0.2);background:rgba(248,113,113,0.06);">🔴 ${statistics?.critical_count || 0} critical</span>
    <span class="stat-chip" style="color:var(--amber);border-color:rgba(251,191,36,0.2);background:rgba(251,191,36,0.06);">🟡 ${statistics?.warning_count || 0} warnings</span>
    <span class="stat-chip" style="color:var(--cyan);border-color:rgba(34,211,238,0.2);background:rgba(34,211,238,0.06);">🔵 ${statistics?.info_count || 0} info</span>
    <span class="stat-chip">⏱ ${((statistics?.analysis_time_ms || 0) / 1000).toFixed(0)}s</span>
  </div>` : ''}

  <!-- Scores -->
  <div class="dashboard">
    <h2>Score Dashboard</h2>
    <div style="padding:8px 0;">
      ${scoreBar('Architecture', scores?.architecture || 0, scoreColor(scores?.architecture || 0))}
      ${scoreBar('Code Quality', scores?.code_quality || 0, scoreColor(scores?.code_quality || 0))}
      ${scoreBar('Security', scores?.security || 0, scoreColor(scores?.security || 0))}
      ${scoreBar('Documentation', scores?.documentation || 0, scoreColor(scores?.documentation || 0))}
      ${scoreBar('Maintainability', scores?.maintainability || 0, scoreColor(scores?.maintainability || 0))}
      ${scoreBar('Overall', scores?.overall || 0, '#7c5cfc')}
    </div>
  </div>

  <!-- Radar Chart -->
  <div class="radar-section">
    ${radarChart(scores)}
  </div>

  <!-- Verdict -->
  <div style="padding:20px;border-radius:12px;background:rgba(124,92,252,0.06);border:1px solid rgba(124,92,252,0.2);margin-bottom:16px;">
    <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent);margin-bottom:6px;">Verdict</div>
    <div style="font-size:1rem;color:rgba(255,255,255,0.9);">${escHtml(verdict || '')}</div>
  </div>

  <!-- Architecture -->
  ${architecture ? `<div class="arch-section">
    <h2>Architecture</h2>
    <div class="arch-card">
      <h3>Overview</h3>
      <p>${escHtml(architecture.summary || '')}</p>
      <div class="arch-tags">
        ${architecture.framework ? `<span class="arch-tag">${escHtml(architecture.framework)}</span>` : ''}
        ${architecture.language ? `<span class="arch-tag">${escHtml(architecture.language)}</span>` : ''}
        ${architecture.pattern ? `<span class="arch-tag">${escHtml(architecture.pattern)}</span>` : ''}
        ${architecture.build_system ? `<span class="arch-tag">${escHtml(architecture.build_system)}</span>` : ''}
      </div>
    </div>
  </div>` : ''}

  <!-- Findings -->
  ${findings && findings.length > 0 ? `<div class="findings-section">
    <h2>Findings (${findings.length})</h2>
    <div class="findings-count">
      <div class="count-item" style="color:var(--red);border-color:rgba(248,113,113,0.2);">🔴 ${statistics?.critical_count || 0} Critical</div>
      <div class="count-item" style="color:var(--amber);border-color:rgba(251,191,36,0.2);">🟡 ${statistics?.warning_count || 0} Warnings</div>
      <div class="count-item" style="color:var(--cyan);border-color:rgba(34,211,238,0.2);">🔵 ${statistics?.info_count || 0} Info</div>
    </div>
    ${findingsHtml}
  </div>` : ''}

  <!-- Recommendations -->
  ${recommendations && recommendations.length > 0 ? `<div class="recs-section">
    <h2>Recommendations</h2>
    ${recsHtml}
  </div>` : ''}

  <!-- Strengths & Risks -->
  ${(strengths?.length || risks?.length) ? `<div class="sr-section">
    <div class="sr-grid">
      <div class="sr-box">
        <h3 style="color:var(--green);">✅ Strengths</h3>
        <ul>${strengthsHtml}</ul>
      </div>
      <div class="sr-box">
        <h3 style="color:var(--red);">⚠️ Risks</h3>
        <ul>${risksHtml}</ul>
      </div>
    </div>
  </div>` : ''}

  <!-- Footer -->
  <div class="footer">
    <p>Generated by <strong>Hermes Repo Auditor</strong> — part of the Hermes Agent ecosystem</p>
    <p style="margin-top:4px;">${generated_at ? new Date(generated_at).toLocaleString() : ''} · ${metadata?.full_name || ''}</p>
    <p style="margin-top:8px;opacity:0.5;">Built for the Hermes Creative Hackathon · Autonomous AI Agent Network</p>
  </div>

</div>
<script>
(function(){var b=document.querySelectorAll('.score-bar');b.forEach(function(el,i){var w=parseInt(el.getAttribute('data-width'),10);setTimeout(function(){el.style.width=w+'%';},i*80);});})();
</script>
</body>
</html>`;
}

function escHtml(s) {
  if (typeof s !== 'string') return String(s || '');
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { generateReport };
