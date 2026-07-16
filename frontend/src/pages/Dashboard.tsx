import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Brain, Plus, Trash2, Loader2, BarChart3, Clock, AlertTriangle, ExternalLink,
  LogOut, Settings, TrendingUp, Target, Zap, Bell, ChevronRight,
  Calendar, RefreshCw, Check, Globe, Eye, Search, ArrowRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../utils/store';
import OnboardingWizard from '../components/OnboardingWizard';
import MeshBackground from '../components/MeshBackground';

interface Competitor { id: string; name: string; website_url: string; description: string; last_scraped_at: string | null; }
interface Analysis { id: string; competitor_id: string; competitor_name: string; status: string; created_at: string; completed_at: string | null; processing_time_ms: number; }
interface Stats {
  totalCompetitors: number; totalAnalyses: number; analysesThisMonth: number;
  successfulAnalyses: number; avgProcessingTime: number;
  trendData: Array<{ day: string; count: number }>;
  topCompetitor: { name: string; analysis_count: number } | null;
  recentAnalyses: Analysis[]; plan: string; analysesUsed: number; analysesLimit: number;
  unreadAlerts: number; riskDistribution: Array<{ risk: string; count: number }>;
}
interface Monitor { id: string; competitor_id: string; competitor_name: string; schedule: string; enabled: number; last_run: string | null; }

export default function Dashboard() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAnalyzeModal, setShowAnalyzeModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{ step: number; message: string } | null>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [newComp, setNewComp] = useState({ name: '', websiteUrl: '', description: '' });
  const [businessProfile, setBusinessProfile] = useState({ businessDescription: '', targetAudience: '', pricing: '', strengths: '' });

  useEffect(() => {
    loadData();
    if (user && !user.onboarding_completed) setShowOnboarding(true);
  }, []);

  const loadData = async () => {
    try {
      const [compRes, statsRes, monitorRes] = await Promise.all([
        api.get('/competitors'),
        api.get('/stats'),
        api.get('/monitoring').catch(() => ({ data: { monitors: [] } })),
      ]);
      setCompetitors(compRes.data.competitors);
      setStats(statsRes.data);
      setMonitors(monitorRes.data.monitors);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const addCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/competitors', newComp);
      setCompetitors([data.competitor, ...competitors]);
      setShowAddModal(false);
      setNewComp({ name: '', websiteUrl: '', description: '' });
      toast.success('Competitor added');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const deleteCompetitor = async (id: string) => {
    if (!confirm('Delete this competitor?')) return;
    try { await api.delete(`/competitors/${id}`); setCompetitors(competitors.filter((c) => c.id !== id)); toast.success('Deleted'); }
    catch { toast.error('Failed to delete'); }
  };

  const runAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    setAnalysisProgress({ step: 1, message: 'Starting analysis...' });
    try {
      // Animate through steps while waiting
      const stepMessages = [
        { step: 1, message: 'Scraping competitor website...' },
        { step: 2, message: 'Decoding data patterns...' },
        { step: 3, message: 'Profiling psychological state...' },
        { step: 4, message: 'Engineering strategy...' },
        { step: 5, message: 'Generating executive brief...' },
      ];
      let currentStep = 0;
      const stepTimer = setInterval(() => {
        currentStep++;
        if (currentStep < stepMessages.length) {
          setAnalysisProgress(stepMessages[currentStep]);
        }
      }, 8000); // advance step every 8s

      const { data } = await api.post('/analyses', { competitorId: showAnalyzeModal, ...businessProfile });

      clearInterval(stepTimer);
      setAnalysisProgress({ step: 5, message: 'Analysis complete!' });
      await new Promise(r => setTimeout(r, 500));
      setAnalysisProgress(null);
      toast.success('Analysis complete!');
      setShowAnalyzeModal(null);
      setBusinessProfile({ businessDescription: '', targetAudience: '', pricing: '', strengths: '' });
      navigate(`/report/${data.analysis.analysisId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Analysis failed');
      setAnalysisProgress(null);
    } finally { setAnalyzing(false); }
  };

  const toggleMonitor = async (monitorId: string) => {
    try { await api.patch(`/monitoring/${monitorId}/toggle`); setMonitors(monitors.map(m => m.id === monitorId ? { ...m, enabled: m.enabled ? 0 : 1 } : m)); }
    catch { toast.error('Failed'); }
  };

  const setMonitor = async (competitorId: string, schedule: string) => {
    try { await api.post('/monitoring', { competitorId, schedule }); toast.success('Monitoring enabled'); loadData(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center relative">
      <MeshBackground />
      <div className="relative z-10 flex flex-col items-center gap-4" style={{ animation: 'blur-in 0.6s ease-out' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden"
             style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
          <Brain className="w-7 h-7 text-white relative z-10" />
          <div className="absolute inset-0 bg-white/20 animate-[shimmer_3s_linear_infinite]" style={{ backgroundSize: '200% 100%' }} />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        <p className="text-slate-500 text-sm font-light">Loading your dashboard...</p>
      </div>
    </div>
  );

  const usagePercent = stats ? Math.min((stats.analysesUsed / (stats.analysesLimit === -1 ? 100 : stats.analysesLimit)) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-[#0c0c14] relative">
      <MeshBackground />

      {/* Nav */}
      <nav className="relative z-50 border-b border-white/[0.04] px-8 py-5 flex items-center justify-between bg-[#0c0c14]/60 backdrop-blur-2xl sticky top-0">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center relative overflow-hidden"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
            <Brain className="w-6 h-6 text-white relative z-10" />
          </div>
          <span className="text-xl font-black text-white font-display">StratScope</span>
        </div>
        <div className="flex items-center gap-6">
          {stats && stats.unreadAlerts > 0 && (
            <div className="relative cursor-pointer group">
              <Bell className="w-5 h-5 text-slate-400 group-hover:text-white transition" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white animate-pulse">{stats.unreadAlerts}</span>
            </div>
          )}
          <span className="text-slate-400 text-sm font-medium">{user?.name}</span>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.15))', border: '1px solid rgba(139,92,246,0.2)', color: '#c4b5fd' }}>
            {user?.plan}
          </span>
          <Link to="/settings" className="text-slate-400 hover:text-white transition"><Settings className="w-5 h-5" /></Link>
          <button onClick={logout} className="text-slate-400 hover:text-red-400 transition"><LogOut className="w-5 h-5" /></button>
        </div>
      </nav>

      <div className="relative z-10 max-w-7xl mx-auto px-8 py-10">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {[
            { label: 'Competitors', value: stats?.totalCompetitors || 0, icon: Target, color: 'text-violet-400', bg: 'rgba(139,92,246,0.08)' },
            { label: 'Total Analyses', value: stats?.totalAnalyses || 0, icon: BarChart3, color: 'text-emerald-400', bg: 'rgba(16,185,129,0.08)' },
            { label: 'This Month', value: stats?.analysesThisMonth || 0, icon: Calendar, color: 'text-blue-400', bg: 'rgba(59,130,246,0.08)' },
            { label: 'Avg Speed', value: stats?.avgProcessingTime ? `${(stats.avgProcessingTime / 1000).toFixed(1)}s` : '—', icon: Zap, color: 'text-amber-400', bg: 'rgba(245,158,11,0.08)' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="glass-card rounded-2xl p-6 group">
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-500" style={{ background: bg }}>
                  <Icon className={`w-7 h-7 ${color}`} />
                </div>
                <span className="text-slate-500 text-sm font-medium">{label}</span>
              </div>
              <div className="text-4xl font-black text-white font-display tracking-tight">{value}</div>
            </div>
          ))}
        </div>

        {/* Usage + Chart */}
        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          <div className="glass-card rounded-2xl p-8">
            <h3 className="text-base font-semibold text-slate-400 mb-6 font-display uppercase tracking-wider">Monthly Usage</h3>
            <div className="mb-6">
              <div className="flex items-baseline justify-between mb-4">
                <span className="text-5xl font-black text-white font-display">{stats?.analysesUsed || 0}</span>
                <span className="text-slate-500 text-base">/ {stats?.analysesLimit === -1 ? '∞' : stats?.analysesLimit}</span>
              </div>
              <div className="w-full h-3.5 bg-white/[0.04] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                     style={{
                       width: `${usagePercent}%`,
                       background: 'linear-gradient(90deg, #7c3aed, #6366f1, #818cf8)',
                     }}>
                  <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_linear_infinite]" style={{ backgroundSize: '200% 100%' }} />
                </div>
              </div>
            </div>
            <p className="text-slate-500 text-sm mb-5">{stats?.analysesLimit === -1 ? 'Unlimited analyses' : `${(stats?.analysesLimit || 3) - (stats?.analysesUsed || 0)} remaining`}</p>
            <Link to="/settings" className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-base font-semibold transition group">
              Upgrade plan <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="lg:col-span-2 glass-card rounded-2xl p-8">
            <h3 className="text-base font-semibold text-slate-400 mb-6 font-display uppercase tracking-wider">Activity (30 Days)</h3>
            {stats?.trendData && stats.trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={stats.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="day" stroke="rgba(255,255,255,0.15)" fontSize={11} tickLine={false} axisLine={false}
                         tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                  <YAxis stroke="rgba(255,255,255,0.15)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(10,10,15,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', fontSize: '12px', backdropFilter: 'blur(20px)' }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#a78bfa' }}
                  />
                  <Line type="monotone" dataKey="count" stroke="url(#lineGradient)" strokeWidth={2.5} dot={false}
                        activeDot={{ r: 5, fill: '#8b5cf6', stroke: '#0a0a0f', strokeWidth: 2 }} />
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="50%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#38bdf8" />
                    </linearGradient>
                  </defs>
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-slate-600 text-sm font-light">Run your first analysis to see trends</div>
            )}
          </div>
        </div>

        {/* Competitors */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-white font-display tracking-tight">Your Competitors</h2>
            <p className="text-slate-500 text-base mt-1.5 font-light">{competitors.length} tracked competitors</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-premium flex items-center gap-2.5 text-base py-3.5 px-7 text-white rounded-2xl font-bold">
            <Plus className="w-5 h-5" /> Add Competitor
          </button>
        </div>

        {competitors.length === 0 ? (
          <div className="text-center py-28 rounded-3xl glass-card">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-8"
                 style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(99,102,241,0.05))', border: '1px solid rgba(139,92,246,0.15)' }}>
              <Search className="w-11 h-11 text-violet-400" />
            </div>
            <h3 className="text-3xl font-black text-white mb-3 font-display">No competitors yet</h3>
            <p className="text-slate-400 mb-10 max-w-md mx-auto font-light text-lg">Add your first competitor to start decoding their strategy with AI-powered analysis.</p>
            <button onClick={() => setShowAddModal(true)} className="btn-premium py-4 px-10 text-white rounded-2xl font-bold text-lg">
              Add Your First Competitor
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {competitors.map((comp) => {
              const monitor = monitors.find(m => m.competitor_id === comp.id);
              return (
                <div key={comp.id} className="glass-card rounded-2xl p-7 group">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-black text-white font-display">{comp.name}</h3>
                    <div className="flex items-center gap-2">
                      {monitor && (
                        <button onClick={() => toggleMonitor(monitor.id)}
                                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all ${monitor.enabled ? 'text-emerald-400' : 'text-slate-600'}`}
                                style={{ background: monitor.enabled ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${monitor.enabled ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}` }}>
                          {monitor.enabled ? '● Live' : '○ Off'}
                        </button>
                      )}
                      <button onClick={() => deleteCompetitor(comp.id)} className="text-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <a href={comp.website_url} target="_blank" rel="noopener noreferrer"
                     className="text-violet-400 text-base flex items-center gap-1.5 hover:text-violet-300 mb-4 font-medium transition">
                    {comp.website_url.replace('https://', '')} <ExternalLink className="w-4 h-4" />
                  </a>
                  {comp.description && <p className="text-slate-400 text-base mb-5 font-light">{comp.description}</p>}
                  {comp.last_scraped_at && (
                    <p className="text-slate-600 text-sm mb-6 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" /> Last analyzed {new Date(comp.last_scraped_at).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <button onClick={() => setShowAnalyzeModal(comp.id)}
                            className="flex-1 flex items-center justify-center gap-2 btn-premium text-white font-bold text-base py-3 rounded-2xl">
                      <BarChart3 className="w-5 h-5" /> Analyze
                    </button>
                    {!monitor && (
                      <button onClick={() => setMonitor(comp.id, 'weekly')}
                              className="flex items-center justify-center gap-1.5 btn-glass text-slate-400 hover:text-white text-base py-3 px-4 rounded-2xl">
                        <RefreshCw className="w-4 h-4" /> Monitor
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Analyses */}
        {stats?.recentAnalyses && stats.recentAnalyses.length > 0 && (
          <div>
            <h2 className="text-2xl font-black text-white mb-6 font-display tracking-tight">Recent Analyses</h2>
            <div className="space-y-4">
              {stats.recentAnalyses.map((a) => (
                <Link key={a.id} to={`/report/${a.id}`}
                      className="glass-card flex items-center justify-between p-6 rounded-2xl group cursor-pointer">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(99,102,241,0.05))', border: '1px solid rgba(139,92,246,0.1)' }}>
                      <BarChart3 className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-white group-hover:text-violet-300 transition">{a.competitor_name}</p>
                      <p className="text-slate-500 text-base font-light">{new Date(a.created_at).toLocaleDateString()} {a.processing_time_ms ? `· ${(a.processing_time_ms / 1000).toFixed(1)}s` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${a.status === 'completed' ? 'text-emerald-400' : a.status === 'failed' ? 'text-red-400' : 'text-amber-400'}`}
                          style={{ background: a.status === 'completed' ? 'rgba(16,185,129,0.1)' : a.status === 'failed' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${a.status === 'completed' ? 'rgba(16,185,129,0.2)' : a.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                      {a.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Competitor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}
             style={{ animation: 'fade-in 0.2s ease-out' }}>
          <div className="w-full max-w-xl rounded-3xl p-10 shadow-2xl relative overflow-hidden"
               style={{ background: 'rgba(12,12,18,0.95)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(40px)', animation: 'scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
               onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-violet-600/15 rounded-full blur-[100px] pointer-events-none" />
            <h2 className="text-3xl font-black text-white mb-6 font-display relative z-10 tracking-tight">Add Competitor</h2>
            <form onSubmit={addCompetitor} className="space-y-5 relative z-10">
              <div>
                <label className="block text-base font-semibold text-slate-300 mb-2.5">Company Name</label>
                <input className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all" placeholder="e.g. Notion" value={newComp.name} onChange={(e) => setNewComp({ ...newComp, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-base font-semibold text-slate-300 mb-2.5">Website URL</label>
                <input className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all" placeholder="https://example.com" value={newComp.websiteUrl} onChange={(e) => setNewComp({ ...newComp, websiteUrl: e.target.value })} required />
              </div>
              <div>
                <label className="block text-base font-semibold text-slate-300 mb-2.5">Description (optional)</label>
                <input className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all" placeholder="What do they do?" value={newComp.description} onChange={(e) => setNewComp({ ...newComp, description: e.target.value })} />
              </div>
              <div className="flex gap-4 pt-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 btn-glass text-white font-semibold py-4 px-6 rounded-2xl text-lg">Cancel</button>
                <button type="submit" className="flex-1 btn-premium text-white font-bold py-4 px-6 rounded-2xl text-lg">Add Competitor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analyze Modal */}
      {showAnalyzeModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => { if (!analyzing) setShowAnalyzeModal(null); }}
             style={{ animation: 'fade-in 0.2s ease-out' }}>
          <div className="w-full max-w-2xl rounded-3xl p-10 shadow-2xl relative overflow-hidden"
               style={{ background: 'rgba(12,12,18,0.95)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(40px)', animation: 'scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
               onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />

            {!analyzing ? (
              <>
                <h2 className="text-3xl font-black text-white mb-2 font-display relative z-10 tracking-tight">Run Analysis</h2>
                <p className="text-slate-400 text-lg mb-8 font-light relative z-10">Tell us about your business for personalized strategy recommendations.</p>
                <form onSubmit={runAnalysis} className="space-y-5 relative z-10">
                  <div>
                    <label className="block text-base font-semibold text-slate-300 mb-2.5">Your Business</label>
                    <textarea className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all h-28 resize-none" placeholder="Describe what your business does..." value={businessProfile.businessDescription} onChange={(e) => setBusinessProfile({ ...businessProfile, businessDescription: e.target.value })} required />
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div><label className="block text-base font-semibold text-slate-300 mb-2.5">Target Audience</label><input className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all" placeholder="e.g. SaaS founders" value={businessProfile.targetAudience} onChange={(e) => setBusinessProfile({ ...businessProfile, targetAudience: e.target.value })} required /></div>
                    <div><label className="block text-base font-semibold text-slate-300 mb-2.5">Your Pricing</label><input className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all" placeholder="e.g. $49/mo" value={businessProfile.pricing} onChange={(e) => setBusinessProfile({ ...businessProfile, pricing: e.target.value })} required /></div>
                  </div>
                  <div>
                    <label className="block text-base font-semibold text-slate-300 mb-2.5">Your Key Strengths</label>
                    <input className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-5 py-4 text-white text-lg placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all" placeholder="e.g. Better UX, faster, cheaper" value={businessProfile.strengths} onChange={(e) => setBusinessProfile({ ...businessProfile, strengths: e.target.value })} required />
                  </div>
                  <div className="flex gap-4 pt-3">
                    <button type="button" onClick={() => setShowAnalyzeModal(null)} className="flex-1 btn-glass text-white font-semibold py-4 px-6 rounded-2xl text-lg">Cancel</button>
                    <button type="submit" className="flex-1 btn-premium text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 text-lg">
                      Run Full Analysis <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </>
            ) : (
              /* Analysis in progress */
              <div className="text-center py-4" style={{ animation: 'fade-in 0.4s ease-out' }}>
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 relative overflow-hidden"
                     style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <Loader2 className="w-10 h-10 text-violet-400 animate-spin relative z-10" />
                  <div className="absolute inset-0 bg-white/10 animate-[shimmer_2s_linear_infinite]" style={{ backgroundSize: '200% 100%' }} />
                </div>
                <h3 className="text-2xl font-black text-white mb-2 font-display">Analyzing Competitor</h3>
                <p className="text-slate-400 text-lg mb-10 font-light">{analysisProgress?.message || 'Working...'}</p>

                <div className="space-y-4 text-left max-w-md mx-auto">
                  {[
                    { step: 1, label: 'Scraping competitor website', icon: Globe },
                    { step: 2, label: 'Decoding data patterns', icon: BarChart3 },
                    { step: 3, label: 'Profiling psychological state', icon: Eye },
                    { step: 4, label: 'Engineering strategy', icon: Target },
                    { step: 5, label: 'Generating executive brief', icon: Zap },
                  ].map(({ step, label, icon: Icon }) => {
                    const isComplete = (analysisProgress?.step || 0) > step;
                    const isCurrent = (analysisProgress?.step || 0) === step;
                    return (
                      <div key={step} className={`flex items-center gap-4 text-base transition-all duration-500 ${isComplete ? 'text-emerald-400' : isCurrent ? 'text-violet-400' : 'text-slate-700'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500 ${isComplete ? 'bg-emerald-500/20' : isCurrent ? 'bg-violet-500/20 animate-pulse' : 'bg-white/[0.04]'}`}>
                          {isComplete ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                        </div>
                        <span className="font-semibold">{label}</span>
                        {isCurrent && <Loader2 className="w-5 h-5 animate-spin ml-auto text-violet-400" />}
                      </div>
                    );
                  })}
                </div>

                <button onClick={() => { setAnalyzing(false); setAnalysisProgress(null); }}
                        className="mt-10 btn-glass text-slate-400 hover:text-white font-semibold py-3 px-8 rounded-2xl transition-all">
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showOnboarding && <OnboardingWizard onComplete={() => { setShowOnboarding(false); loadData(); }} />}
    </div>
  );
}
