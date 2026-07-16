import puppeteer from 'puppeteer';

interface AnalysisData {
  competitor_name: string;
  website_url: string;
  created_at: string;
  processing_time_ms: number;
  executive_brief: any;
  extracted_patterns: any;
  psychological_profile: any;
  strategic_options: any;
  snapshot_diff: any;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkdownBasic(md: string): string {
  if (!md) return '';
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

export async function generateReportPdf(analysis: AnalysisData): Promise<Buffer> {
  const brief = analysis.executive_brief || {};
  const patterns = analysis.extracted_patterns || {};
  const psychology = analysis.psychological_profile || {};
  const strategy = analysis.strategic_options || {};
  const diff = analysis.snapshot_diff || {};

  const riskColors: Record<string, string> = {
    low: '#10b981', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
  };
  const riskColor = riskColors[brief.riskRating] || '#f59e0b';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a2e; line-height: 1.6; font-size: 14px; }

    .header { background: linear-gradient(135deg, #0f0f1a, #1a1a2e); color: white; padding: 48px 40px; }
    .header h1 { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
    .header .subtitle { color: #94a3b8; font-size: 16px; }
    .header .meta { display: flex; gap: 24px; margin-top: 16px; color: #64748b; font-size: 12px; }
    .header .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${riskColor}22; color: ${riskColor}; border: 1px solid ${riskColor}44; }

    .content { padding: 32px 40px; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-title { font-size: 18px; font-weight: 800; color: #0f0f1a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }

    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .card-accent { border-left: 4px solid #7c3aed; }
    .card-success { border-left: 4px solid #10b981; background: #f0fdf4; }
    .card-warning { border-left: 4px solid #f59e0b; background: #fffbeb; }
    .card-danger { border-left: 4px solid #ef4444; background: #fef2f2; }

    .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    .stat-box { background: #f1f5f9; border-radius: 8px; padding: 12px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: 800; color: #7c3aed; }
    .stat-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }

    .change-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: white; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; }
    .change-old { text-decoration: line-through; color: #94a3b8; }
    .change-new { font-weight: 700; color: #0f0f1a; }
    .change-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; }
    .badge-up { background: #fef2f2; color: #ef4444; }
    .badge-down { background: #f0fdf4; color: #10b981; }

    .tag { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin: 2px; }
    .tag-added { background: #f0fdf4; color: #10b981; border: 1px solid #bbf7d0; }
    .tag-removed { background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; }

    .strategy-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 12px; }
    .strategy-card.recommended { border-color: #7c3aed; box-shadow: 0 0 0 1px #7c3aed; }
    .strategy-title { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
    .strategy-meta { font-size: 12px; color: #64748b; margin-bottom: 8px; }
    .strategy-field { margin-bottom: 6px; }
    .strategy-label { font-weight: 600; color: #475569; font-size: 12px; }

    ul { padding-left: 20px; margin-bottom: 12px; }
    li { margin-bottom: 4px; }
    p { margin-bottom: 12px; }

    .footer { text-align: center; padding: 24px 40px; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;justify-content:space-between;align-items:start;">
      <div>
        <h1>${escapeHtml(brief.headline || `${analysis.competitor_name} Analysis`)}</h1>
        <div class="subtitle">${escapeHtml(brief.subtitle || '')}</div>
      </div>
      <span class="risk-badge">${brief.riskRating || 'medium'} RISK</span>
    </div>
    <div class="meta">
      <span>Competitor: ${escapeHtml(analysis.competitor_name)}</span>
      <span>URL: ${escapeHtml(analysis.website_url)}</span>
      <span>Date: ${new Date(analysis.created_at).toLocaleDateString()}</span>
      <span>Analyzed in ${(analysis.processing_time_ms / 1000).toFixed(1)}s</span>
      ${brief.urgencyScore ? `<span>Urgency: ${brief.urgencyScore}/10</span>` : ''}
    </div>
  </div>

  <div class="content">
    ${diff.hasPreviousSnapshot ? `
    <div class="section">
      <div class="section-title">What Changed</div>
      <div class="card card-accent">
        <p style="font-size:15px;font-weight:600;margin-bottom:8px;">${escapeHtml(diff.overallChangeSummary)}</p>
        <p style="font-size:12px;color:#64748b;">Compared to previous analysis (${new Date(diff.previousSnapshotDate).toLocaleDateString()})</p>
      </div>
      ${diff.pricingChanges?.length > 0 ? `
      <div style="margin-top:12px;">
        <p style="font-weight:700;margin-bottom:8px;">Pricing Changes</p>
        ${diff.pricingChanges.map((c: any) => `
        <div class="change-row">
          <span>${escapeHtml(c.tier)}</span>
          <div>
            <span class="change-old">${escapeHtml(c.oldPrice)}</span>
            <span style="margin:0 8px;">→</span>
            <span class="change-new">${escapeHtml(c.newPrice)}</span>
            ${c.changePercent !== null ? `<span class="change-badge ${c.changePercent > 0 ? 'badge-up' : 'badge-down'}">${c.changePercent > 0 ? '+' : ''}${c.changePercent}%</span>` : ''}
          </div>
        </div>`).join('')}
      </div>` : ''}
      ${(diff.featureChanges?.added?.length > 0 || diff.featureChanges?.removed?.length > 0) ? `
      <div style="margin-top:12px;">
        <p style="font-weight:700;margin-bottom:8px;">Feature Changes</p>
        ${diff.featureChanges.added?.map((f: string) => `<span class="tag tag-added">+ ${escapeHtml(f)}</span>`).join('') || ''}
        ${diff.featureChanges.removed?.map((f: string) => `<span class="tag tag-removed">- ${escapeHtml(f)}</span>`).join('') || ''}
      </div>` : ''}
    </div>` : `
    <div class="section">
      <div class="section-title">First Analysis</div>
      <div class="card">
        <p>This is the first analysis for ${escapeHtml(analysis.competitor_name)}. No previous data to compare against. Run another analysis later to see changes.</p>
      </div>
    </div>`}

    <div class="section">
      <div class="section-title">Executive Brief</div>
      ${brief.fullReport ? `<div class="card card-accent">${renderMarkdownBasic(brief.fullReport)}</div>` : `
        ${brief.realityCheck ? `<div class="card card-warning"><strong>The Reality:</strong> ${escapeHtml(brief.realityCheck)}</div>` : ''}
        ${brief.psychologicalBlindspot ? `<div class="card card-danger"><strong>Psychological Blindspot:</strong> ${escapeHtml(brief.psychologicalBlindspot)}</div>` : ''}
        ${brief.strategicPlaybook ? `<div class="card card-success"><strong>Strategic Playbook:</strong><br>${escapeHtml(brief.strategicPlaybook).replace(/\n/g, '<br>')}</div>` : ''}
      `}
      ${brief.oneLiner ? `<div class="card" style="text-align:center;font-style:italic;font-size:16px;font-weight:600;color:#7c3aed;">"${escapeHtml(brief.oneLiner)}"</div>` : ''}
    </div>

    <div class="section">
      <div class="section-title">Data Patterns</div>
      ${patterns.hardChanges?.length > 0 ? `<div class="card"><strong>Hard Changes</strong><ul>${patterns.hardChanges.map((c: string) => `<li>${escapeHtml(c)}</li>`).join('')}</ul></div>` : ''}
      ${patterns.pricingShift ? `<div class="card card-warning"><strong>Pricing Shift:</strong> ${escapeHtml(patterns.pricingShift)}</div>` : ''}
      ${patterns.featureEvolution ? `<div class="card"><strong>Feature Evolution:</strong> ${escapeHtml(patterns.featureEvolution)}</div>` : ''}
      ${patterns.sentimentSignal ? `<div class="card"><strong>Sentiment:</strong> ${escapeHtml(patterns.sentimentSignal)}</div>` : ''}
      ${patterns.anomalies?.length > 0 ? `<div class="card card-danger"><strong>Anomalies</strong><ul>${patterns.anomalies.map((a: string) => `<li>${escapeHtml(a)}</li>`).join('')}</ul></div>` : ''}
    </div>

    <div class="section">
      <div class="section-title">Psychological Profile</div>
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-value">${escapeHtml(psychology.competitorMindset || '—')}</div><div class="stat-label">Mindset</div></div>
        <div class="stat-box"><div class="stat-value">${escapeHtml(psychology.motiveType || '—')}</div><div class="stat-label">Motive</div></div>
        <div class="stat-box"><div class="stat-value">${psychology.confidenceScore ? Math.round(psychology.confidenceScore * 100) + '%' : '—'}</div><div class="stat-label">Confidence</div></div>
      </div>
      ${psychology.coreVulnerability ? `<div class="card card-danger"><strong>Core Vulnerability:</strong> ${escapeHtml(psychology.coreVulnerability)}</div>` : ''}
      ${psychology.cognitiveBiasesExploited?.length > 0 ? `<div class="card"><strong>Cognitive Biases Exploited:</strong><br>${psychology.cognitiveBiasesExploited.map((b: string) => `<span class="tag" style="background:#f3e8ff;color:#7c3aed;">${escapeHtml(b)}</span>`).join(' ')}</div>` : ''}
    </div>

    <div class="section">
      <div class="section-title">Strategy Options</div>
      ${strategy.options?.map((opt: any) => `
      <div class="strategy-card ${strategy.recommendedOption === opt.id ? 'recommended' : ''}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span class="strategy-title">${escapeHtml(opt.title)}</span>
          <span style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:12px;background:${opt.riskLevel === 'low' ? '#f0fdf4' : opt.riskLevel === 'high' ? '#fef2f2' : '#fffbeb'};color:${opt.riskLevel === 'low' ? '#10b981' : opt.riskLevel === 'high' ? '#ef4444' : '#f59e0b'};">${opt.riskLevel} risk</span>
        </div>
        ${strategy.recommendedOption === opt.id ? '<div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:8px;">★ RECOMMENDED</div>' : ''}
        <div class="strategy-field"><span class="strategy-label">Action:</span> ${escapeHtml(opt.action)}</div>
        <div class="strategy-field"><span class="strategy-label">Expected Outcome:</span> ${escapeHtml(opt.expectedOutcome)}</div>
        <div class="strategy-field"><span class="strategy-label">Competitor Response:</span> ${escapeHtml(opt.competitorResponse)}</div>
        <div class="strategy-field"><span class="strategy-label">2 Moves Ahead:</span> ${escapeHtml(opt.twoMovesAhead)}</div>
        <div class="strategy-meta">⏱ ${escapeHtml(opt.timeframe)} · 📦 ${escapeHtml(opt.resourceRequirement)}</div>
      </div>`).join('') || ''}
      ${strategy.firstPrinciplesInsight ? `<div class="card card-accent"><strong>First Principles Insight:</strong> ${escapeHtml(strategy.firstPrinciplesInsight)}</div>` : ''}
    </div>
  </div>

  <div class="footer">
    Generated by StratScope · Competitive Intelligence Decoded · ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: 'new' as any,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
