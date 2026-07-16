import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Brain, ArrowLeft, Loader2, AlertTriangle, Target, Shield, Eye, BarChart3, Clock, Zap, Download, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import api from '../utils/api';
import MeshBackground from '../components/MeshBackground';

interface AnalysisData {
  id: string; competitor_name: string; website_url: string; status: string;
  extracted_patterns: any; psychological_profile: any; strategic_options: any;
  executive_brief: any; snapshot_diff: any; processing_time_ms: number; created_at: string;
}

export default function Report() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'brief' | 'changes' | 'patterns' | 'psychology' | 'strategy'>('brief');
  const [exporting, setExporting] = useState(false);

  useEffect(() => { loadAnalysis(); }, [id]);

  const loadAnalysis = async () => {
    try { const { data } = await api.get(`/analyses/${id}`); setAnalysis(data.analysis); } catch {}
    finally { setLoading(false); }
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const response = await api.get(`/analyses/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${analysis?.competitor_name || 'report'}-analysis.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded!');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center relative">
      <MeshBackground />
      <div className="relative z-10 flex flex-col items-center gap-4" style={{ animation: 'blur-in 0.6s ease-out' }}>
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        <p className="text-slate-500 text-sm font-light">Loading report...</p>
      </div>
    </div>
  );

  if (!analysis) return (
    <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center text-center relative">
      <MeshBackground />
      <div className="relative z-10">
        <AlertTriangle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">Analysis not found</p>
        <Link to="/dashboard" className="text-violet-400 text-sm mt-2 block font-medium hover:text-violet-300 transition">Back to Dashboard</Link>
      </div>
    </div>
  );

  const brief = analysis.executive_brief || {};
  const patterns = analysis.extracted_patterns || {};
  const psychology = analysis.psychological_profile || {};
  const strategy = analysis.strategic_options || {};

  const tabs = [
    { id: 'brief' as const, label: 'Executive Brief', icon: Zap },
    { id: 'changes' as const, label: 'Changes', icon: TrendingUp },
    { id: 'patterns' as const, label: 'Data Patterns', icon: BarChart3 },
    { id: 'psychology' as const, label: 'Psychology', icon: Eye },
    { id: 'strategy' as const, label: 'Strategy', icon: Target },
  ];

  const riskColors: Record<string, string> = {
    low: 'text-emerald-400', medium: 'text-amber-400', high: 'text-orange-400', critical: 'text-red-400',
  };
  const riskBg: Record<string, string> = {
    low: 'rgba(16,185,129,0.1)', medium: 'rgba(245,158,11,0.1)', high: 'rgba(249,115,22,0.1)', critical: 'rgba(239,68,68,0.1)',
  };
  const riskBorder: Record<string, string> = {
    low: 'rgba(16,185,129,0.2)', medium: 'rgba(245,158,11,0.2)', high: 'rgba(249,115,22,0.2)', critical: 'rgba(239,68,68,0.2)',
  };

  return (
    <div className="min-h-screen bg-[#0c0c14] relative">
      <MeshBackground />

      {/* Nav */}
      <nav className="relative z-50 border-b border-white/[0.04] px-8 py-4 flex items-center justify-between bg-[#0c0c14]/60 backdrop-blur-2xl sticky top-0">
        <div className="flex items-center gap-5">
          <Link to="/dashboard" className="text-slate-400 hover:text-white transition"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white font-display">StratScope</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white font-medium">{analysis.competitor_name}</span>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${riskColors[brief.riskRating] || riskColors.medium}`}
                style={{ background: riskBg[brief.riskRating] || riskBg.medium, border: `1px solid ${riskBorder[brief.riskRating] || riskBorder.medium}` }}>
            {brief.riskRating || 'medium'} risk
          </span>
          <button onClick={exportPdf} disabled={exporting}
                  className="flex items-center gap-1.5 btn-glass text-white text-sm py-2 px-4 rounded-xl disabled:opacity-40 transition-all">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export PDF
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-8 py-10">
        {/* Header */}
        {brief.headline && (
          <div className="mb-10" style={{ animation: 'slide-up 0.6s ease-out' }}>
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <h1 className="text-3xl md:text-4xl font-black text-white font-display tracking-tight">{brief.headline}</h1>
              {brief.urgencyScore && (
                <span className="text-sm font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5"
                      style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#c4b5fd' }}>
                  <Zap className="w-3.5 h-3.5" /> {brief.urgencyScore}/10 urgency
                </span>
              )}
            </div>
            {brief.subtitle && <p className="text-slate-400 text-lg font-light">{brief.subtitle}</p>}
            {analysis.processing_time_ms && (
              <p className="text-slate-600 text-sm mt-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Analyzed in {(analysis.processing_time_ms / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 glass rounded-2xl p-1.5 mb-10">
          {tabs.map(({ id: tabId, label, icon: Icon }) => (
            <button key={tabId} onClick={() => setActiveTab(tabId)}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${
                      activeTab === tabId
                        ? 'text-white shadow-lg'
                        : 'text-slate-500 hover:text-white hover:bg-white/[0.04]'
                    }`}
                    style={activeTab === tabId ? { background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.1))', border: '1px solid rgba(139,92,246,0.15)' } : {}}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'brief' && (
          <div className="space-y-6" style={{ animation: 'fade-in 0.4s ease-out' }}>
            {brief.fullReport ? (
              <div className="glass-card rounded-2xl p-8 prose-invert max-w-none">
                <ReactMarkdown>{brief.fullReport}</ReactMarkdown>
              </div>
            ) : (
              <div className="space-y-6">
                {brief.realityCheck && (
                  <div className="glass-card rounded-2xl p-7">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2 font-display"><AlertTriangle className="w-5 h-5 text-amber-400" /> The Reality</h3>
                    <p className="text-slate-300 leading-relaxed font-light">{brief.realityCheck}</p>
                  </div>
                )}
                {brief.psychologicalBlindspot && (
                  <div className="glass-card rounded-2xl p-7" style={{ border: '1px solid rgba(168,85,247,0.15)' }}>
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2 font-display"><Eye className="w-5 h-5 text-purple-400" /> The Psychological Blindspot</h3>
                    <p className="text-slate-300 leading-relaxed font-light">{brief.psychologicalBlindspot}</p>
                  </div>
                )}
                {brief.strategicPlaybook && (
                  <div className="glass-card rounded-2xl p-7" style={{ border: '1px solid rgba(16,185,129,0.15)' }}>
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2 font-display"><Target className="w-5 h-5 text-emerald-400" /> Your Strategic Playbook</h3>
                    <p className="text-slate-300 leading-relaxed whitespace-pre-line font-light">{brief.strategicPlaybook}</p>
                  </div>
                )}
                {brief.oneLiner && (
                  <div className="rounded-2xl p-12 text-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(99,102,241,0.05))', border: '1px solid rgba(139,92,246,0.15)' }}>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-violet-600/15 rounded-full blur-[80px] pointer-events-none" />
                    <p className="text-xl font-bold text-white italic font-display relative z-10">"{brief.oneLiner}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'changes' && (
          <div className="space-y-6" style={{ animation: 'fade-in 0.4s ease-out' }}>
            {analysis.snapshot_diff?.hasPreviousSnapshot ? (
              <>
                {/* Change Summary */}
                <div className="glass-card rounded-2xl p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
                      <TrendingUp className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white font-display">What Changed</h3>
                      <p className="text-slate-400 text-sm font-light">Compared to previous analysis ({new Date(analysis.snapshot_diff.previousSnapshotDate).toLocaleDateString()})</p>
                    </div>
                  </div>
                  <p className="text-lg text-slate-300 font-light">{analysis.snapshot_diff.overallChangeSummary}</p>
                </div>

                {/* Pricing Changes */}
                {analysis.snapshot_diff.pricingChanges?.length > 0 && (
                  <div className="glass-card rounded-2xl p-7">
                    <h3 className="text-lg font-bold text-white mb-5 font-display flex items-center gap-2">
                      <span className="text-2xl">💰</span> Pricing Changes
                    </h3>
                    <div className="space-y-3">
                      {analysis.snapshot_diff.pricingChanges.map((c: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-white font-semibold">{c.tier}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 line-through">{c.oldPrice}</span>
                            <span className="text-white font-bold">{c.newPrice}</span>
                            {c.changePercent !== null && (
                              <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${c.changePercent > 0 ? 'text-red-400' : 'text-emerald-400'}`}
                                    style={{ background: c.changePercent > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border: `1px solid ${c.changePercent > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}` }}>
                                {c.changePercent > 0 ? '+' : ''}{c.changePercent}%
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feature Changes */}
                {(analysis.snapshot_diff.featureChanges?.added?.length > 0 || analysis.snapshot_diff.featureChanges?.removed?.length > 0) && (
                  <div className="glass-card rounded-2xl p-7">
                    <h3 className="text-lg font-bold text-white mb-5 font-display flex items-center gap-2">
                      <span className="text-2xl">✨</span> Feature Changes
                    </h3>
                    <div className="space-y-4">
                      {analysis.snapshot_diff.featureChanges.added?.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-emerald-400 mb-3 uppercase tracking-wider">Added</p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.snapshot_diff.featureChanges.added.map((f: string, i: number) => (
                              <span key={i} className="text-sm px-3 py-1.5 rounded-full text-emerald-300"
                                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                + {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {analysis.snapshot_diff.featureChanges.removed?.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-red-400 mb-3 uppercase tracking-wider">Removed</p>
                          <div className="flex flex-wrap gap-2">
                            {analysis.snapshot_diff.featureChanges.removed.map((f: string, i: number) => (
                              <span key={i} className="text-sm px-3 py-1.5 rounded-full text-red-300"
                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                - {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tech Stack Changes */}
                {(analysis.snapshot_diff.techStackChanges?.added?.length > 0 || analysis.snapshot_diff.techStackChanges?.removed?.length > 0) && (
                  <div className="glass-card rounded-2xl p-7">
                    <h3 className="text-lg font-bold text-white mb-5 font-display flex items-center gap-2">
                      <span className="text-2xl">⚙️</span> Tech Stack Changes
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {analysis.snapshot_diff.techStackChanges.added?.map((t: string, i: number) => (
                        <span key={`added-${i}`} className="text-sm px-3 py-1.5 rounded-full text-emerald-300"
                              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          + {t}
                        </span>
                      ))}
                      {analysis.snapshot_diff.techStackChanges.removed?.map((t: string, i: number) => (
                        <span key={`removed-${i}`} className="text-sm px-3 py-1.5 rounded-full text-red-300"
                              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                          - {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Changes */}
                {(analysis.snapshot_diff.employeeCountChange || analysis.snapshot_diff.fundingChanges) && (
                  <div className="glass-card rounded-2xl p-7">
                    <h3 className="text-lg font-bold text-white mb-5 font-display flex items-center gap-2">
                      <span className="text-2xl">📊</span> Company Changes
                    </h3>
                    <div className="space-y-3">
                      {analysis.snapshot_diff.employeeCountChange && (
                        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-slate-400 font-medium">Employees:</span>
                          <span className="text-slate-400 line-through">{analysis.snapshot_diff.employeeCountChange.previous}</span>
                          <span className="text-white font-bold">→ {analysis.snapshot_diff.employeeCountChange.current}</span>
                        </div>
                      )}
                      {analysis.snapshot_diff.fundingChanges && (
                        <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-slate-400 font-medium">Funding updated:</span>
                          <p className="text-white mt-1">{analysis.snapshot_diff.fundingChanges.current}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* First analysis - no comparison */
              <div className="glass-card rounded-2xl p-10 text-center">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                     style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(99,102,241,0.05))', border: '1px solid rgba(139,92,246,0.15)' }}>
                  <TrendingUp className="w-9 h-9 text-violet-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3 font-display">First Analysis</h3>
                <p className="text-slate-400 font-light max-w-md mx-auto">
                  This is the first time we analyzed {analysis.competitor_name}. Run another analysis later to see what changed — pricing shifts, feature additions/removals, and strategic moves will be highlighted here.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="space-y-6" style={{ animation: 'fade-in 0.4s ease-out' }}>
            {patterns.hardChanges?.length > 0 && (
              <div className="glass-card rounded-2xl p-7">
                <h3 className="text-lg font-bold text-white mb-5 font-display">Hard Changes Detected</h3>
                <ul className="space-y-3">{patterns.hardChanges.map((c: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300 font-light">
                    <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }} />{c}
                  </li>
                ))}</ul>
              </div>
            )}
            {patterns.anomalies?.length > 0 && (
              <div className="glass-card rounded-2xl p-7" style={{ border: '1px solid rgba(245,158,11,0.15)' }}>
                <h3 className="text-lg font-bold text-amber-400 mb-5 font-display">Anomalies</h3>
                <ul className="space-y-3">{patterns.anomalies.map((a: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300 font-light"><span className="text-amber-400 mt-1">!</span>{a}</li>
                ))}</ul>
              </div>
            )}
            {patterns.pricingShift && <div className="glass-card rounded-2xl p-7"><h3 className="text-lg font-bold text-white mb-2 font-display">Pricing Shift</h3><p className="text-slate-300 font-light">{patterns.pricingShift}</p></div>}
            {patterns.featureEvolution && <div className="glass-card rounded-2xl p-7"><h3 className="text-lg font-bold text-white mb-2 font-display">Feature Evolution</h3><p className="text-slate-300 font-light">{patterns.featureEvolution}</p></div>}
            {patterns.sentimentSignal && <div className="glass-card rounded-2xl p-7"><h3 className="text-lg font-bold text-white mb-2 font-display">Sentiment Signal</h3><p className="text-slate-300 font-light">{patterns.sentimentSignal}</p></div>}
            {patterns.dataGaps?.length > 0 && (
              <div className="glass-card rounded-2xl p-7" style={{ opacity: 0.6 }}>
                <h3 className="text-lg font-bold text-slate-500 mb-3 font-display">Data Gaps</h3>
                <ul className="space-y-2">{patterns.dataGaps.map((g: string, i: number) => (<li key={i} className="text-slate-500 text-sm font-light">• {g}</li>))}</ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'psychology' && (
          <div className="space-y-6" style={{ animation: 'fade-in 0.4s ease-out' }}>
            <div className="grid grid-cols-2 gap-5">
              <div className="glass-card rounded-2xl p-6 text-center">
                <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider font-medium">Competitor Mindset</p>
                <p className="text-3xl font-black capitalize font-display" style={{ color: '#c084fc' }}>{psychology.competitorMindset || 'Unknown'}</p>
              </div>
              <div className="glass-card rounded-2xl p-6 text-center">
                <p className="text-slate-500 text-xs mb-2 uppercase tracking-wider font-medium">Motive Type</p>
                <p className="text-3xl font-black capitalize font-display" style={{ color: '#60a5fa' }}>{psychology.motiveType || 'Unknown'}</p>
              </div>
            </div>
            {psychology.coreVulnerability && (
              <div className="glass-card rounded-2xl p-7" style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
                <h3 className="text-lg font-bold text-red-400 mb-3 font-display">Core Vulnerability</h3>
                <p className="text-slate-300 leading-relaxed font-light">{psychology.coreVulnerability}</p>
              </div>
            )}
            {psychology.cognitiveBiasesExploited?.length > 0 && (
              <div className="glass-card rounded-2xl p-7">
                <h3 className="text-lg font-bold text-white mb-5 font-display">Cognitive Biases Being Exploited</h3>
                <div className="flex flex-wrap gap-2.5">{psychology.cognitiveBiasesExploited.map((b: string, i: number) => (
                  <span key={i} className="text-sm font-semibold px-4 py-2 rounded-full"
                        style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#d8b4fe' }}>{b}</span>
                ))}</div>
              </div>
            )}
            {psychology.customerManipulationTactics?.length > 0 && (
              <div className="glass-card rounded-2xl p-7">
                <h3 className="text-lg font-bold text-white mb-5 font-display">Manipulation Tactics</h3>
                <ul className="space-y-3">{psychology.customerManipulationTactics.map((t: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-slate-300 font-light"><span className="text-violet-400 mt-1">→</span>{t}</li>
                ))}</ul>
              </div>
            )}
            {psychology.internalPressureSignals?.length > 0 && (
              <div className="glass-card rounded-2xl p-7">
                <h3 className="text-lg font-bold text-white mb-3 font-display">Internal Pressure Signals</h3>
                <ul className="space-y-2">{psychology.internalPressureSignals.map((s: string, i: number) => (
                  <li key={i} className="text-slate-400 text-sm font-light">• {s}</li>
                ))}</ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="space-y-6" style={{ animation: 'fade-in 0.4s ease-out' }}>
            {strategy.options?.map((opt: any) => (
              <div key={opt.id} className={`glass-card rounded-2xl p-7 ${strategy.recommendedOption === opt.id ? 'glow-violet' : ''}`}
                   style={strategy.recommendedOption === opt.id ? { border: '1px solid rgba(16,185,129,0.2)' } : {}}>
                <div className="flex items-center gap-3 mb-5 flex-wrap">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${opt.riskLevel === 'low' ? 'text-emerald-400' : opt.riskLevel === 'high' ? 'text-red-400' : 'text-amber-400'}`}
                        style={{ background: opt.riskLevel === 'low' ? 'rgba(16,185,129,0.1)' : opt.riskLevel === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${opt.riskLevel === 'low' ? 'rgba(16,185,129,0.2)' : opt.riskLevel === 'high' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                    {opt.riskLevel} risk
                  </span>
                  <h3 className="text-lg font-bold text-white font-display">{opt.title}</h3>
                  {strategy.recommendedOption === opt.id && (
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>Recommended</span>
                  )}
                </div>
                <div className="space-y-3">
                  <div><span className="text-slate-500 font-medium text-sm">Action:</span> <span className="text-slate-300 font-light">{opt.action}</span></div>
                  <div><span className="text-slate-500 font-medium text-sm">Expected Outcome:</span> <span className="text-slate-300 font-light">{opt.expectedOutcome}</span></div>
                  <div><span className="text-slate-500 font-medium text-sm">Competitor Response:</span> <span className="text-slate-300 font-light">{opt.competitorResponse}</span></div>
                  <div><span className="text-slate-500 font-medium text-sm">2 Moves Ahead:</span> <span className="text-slate-300 font-light">{opt.twoMovesAhead}</span></div>
                  <div className="flex gap-5 text-slate-500 text-sm pt-2"><span>⏱ {opt.timeframe}</span><span>📦 {opt.resourceRequirement}</span></div>
                </div>
              </div>
            ))}
            {strategy.gameTheoryAnalysis && (
              <div className="glass-card rounded-2xl p-7">
                <h3 className="text-lg font-bold text-white mb-3 font-display">Game Theory Analysis</h3>
                <p className="text-slate-300 leading-relaxed font-light">{strategy.gameTheoryAnalysis}</p>
              </div>
            )}
            {strategy.firstPrinciplesInsight && (
              <div className="rounded-2xl p-7 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(99,102,241,0.05))', border: '1px solid rgba(139,92,246,0.15)' }}>
                <h3 className="text-lg font-bold text-white mb-3 font-display">First Principles Insight</h3>
                <p className="text-slate-300 leading-relaxed font-light">{strategy.firstPrinciplesInsight}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
