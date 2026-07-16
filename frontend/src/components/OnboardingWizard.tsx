import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, ArrowRight, ArrowLeft, Check, Loader2, Target, Zap, Globe, Sparkles, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../utils/store';

interface Props { onComplete: () => void; }

export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [competitor, setCompetitor] = useState({ name: '', websiteUrl: '' });
  const [profile, setProfile] = useState({ businessDescription: '', targetAudience: '', pricing: '', strengths: '' });
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const user = useAuthStore((s) => s.user);

  const steps = [
    { title: 'Add Your First Competitor', desc: 'Who do you compete against? Add their website and we\'ll do the rest.' },
    { title: 'Tell Us About You', desc: 'Help our AI understand your business for personalized strategies.' },
    { title: 'You\'re All Set', desc: 'Run your first analysis and see what your competitor is really thinking.' },
  ];

  const addCompetitor = async () => {
    setLoading(true);
    try { await api.post('/competitors', { ...competitor, description: '' }); toast.success('Competitor added!'); setStep(1); }
    catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const completeOnboarding = async () => {
    setLoading(true);
    try {
      await api.post('/auth/complete-onboarding');
      if (user) login({ ...user, onboarding_completed: 1 }, useAuthStore.getState().token || '');
      toast.success('Welcome to StratScope!');
      onComplete();
    } catch { onComplete(); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4"
         style={{ animation: 'fade-in 0.3s ease-out' }}>
      <div className="w-full max-w-lg rounded-3xl shadow-2xl relative overflow-hidden"
           style={{ background: 'rgba(10,10,18,0.98)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(40px)', animation: 'scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-violet-600/15 rounded-full blur-[100px] pointer-events-none" />

        {/* Progress bar */}
        <div className="h-1 bg-white/[0.03] relative z-10">
          <div className="h-full transition-all duration-700 ease-out relative overflow-hidden"
               style={{ width: `${((step + 1) / steps.length) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #6366f1, #818cf8)' }}>
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_linear_infinite]" style={{ backgroundSize: '200% 100%' }} />
          </div>
        </div>

        <div className="p-8 relative z-10">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
              <Brain className="w-5 h-5 text-white relative z-10" />
            </div>
            <span className="font-bold text-white font-display">StratScope</span>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-3 mb-10">
            {steps.map((_, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                  i < step ? 'text-white' : i === step ? 'text-white' : 'text-slate-600'
                }`}
                     style={{
                       background: i < step ? 'linear-gradient(135deg, #10b981, #059669)' : i === step ? 'linear-gradient(135deg, #7c3aed, #6366f1)' : 'rgba(255,255,255,0.03)',
                       border: `1px solid ${i < step ? 'rgba(16,185,129,0.3)' : i === step ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.05)'}`,
                     }}>
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-0.5 rounded-full transition-all duration-500"
                       style={{ background: i < step ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.04)' }} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="min-h-[220px]" style={{ animation: 'fade-in 0.4s ease-out' }}>
            {step === 0 && (
              <div key="step0">
                <h2 className="text-xl font-bold text-white mb-2 font-display">{steps[0].title}</h2>
                <p className="text-slate-400 text-sm mb-6 font-light">{steps[0].desc}</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Company Name</label>
                    <input className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all"
                           placeholder="e.g. Notion, Linear, Stripe" value={competitor.name} onChange={(e) => setCompetitor({ ...competitor, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">Website URL</label>
                    <input className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all"
                           placeholder="https://example.com" value={competitor.websiteUrl} onChange={(e) => setCompetitor({ ...competitor, websiteUrl: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div key="step1">
                <h2 className="text-xl font-bold text-white mb-2 font-display">{steps[1].title}</h2>
                <p className="text-slate-400 text-sm mb-6 font-light">{steps[1].desc}</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">What does your business do?</label>
                    <textarea className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all h-20 resize-none"
                              placeholder="We build project management software for startups..." value={profile.businessDescription} onChange={(e) => setProfile({ ...profile, businessDescription: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-sm font-medium text-slate-400 mb-2">Target audience</label>
                      <input className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all text-sm"
                             placeholder="SaaS founders" value={profile.targetAudience} onChange={(e) => setProfile({ ...profile, targetAudience: e.target.value })} /></div>
                    <div><label className="block text-sm font-medium text-slate-400 mb-2">Your pricing</label>
                      <input className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all text-sm"
                             placeholder="$49/mo" value={profile.pricing} onChange={(e) => setProfile({ ...profile, pricing: e.target.value })} /></div>
                  </div>
                  <div><label className="block text-sm font-medium text-slate-400 mb-2">Key strengths</label>
                    <input className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all text-sm"
                           placeholder="Better UX, faster, more affordable" value={profile.strengths} onChange={(e) => setProfile({ ...profile, strengths: e.target.value })} /></div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div key="step2" className="text-center py-4">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 relative overflow-hidden"
                     style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(99,102,241,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <Zap className="w-9 h-9 text-violet-400 relative z-10" />
                  <div className="absolute inset-0 bg-white/10 animate-[shimmer_2s_linear_infinite]" style={{ backgroundSize: '200% 100%' }} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2 font-display">{steps[2].title}</h2>
                <p className="text-slate-400 text-sm mb-8 max-w-sm mx-auto font-light">{steps[2].desc}</p>
                <div className="glass-card rounded-2xl p-6 text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <Target className="w-5 h-5 text-violet-400" />
                    <span className="text-white font-bold font-display">{competitor.name || 'Your Competitor'}</span>
                  </div>
                  <div className="space-y-2.5 text-sm text-slate-400">
                    <div className="flex items-center gap-2"><Sparkles className="w-3.5 h-3.5 text-violet-400" /> 4 AI agents will analyze their strategy</div>
                    <div className="flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-purple-400" /> Psychological profiling of their leadership</div>
                    <div className="flex items-center gap-2"><Target className="w-3.5 h-3.5 text-emerald-400" /> Game theory counter-strategies</div>
                    <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-amber-400" /> Executive brief in under 10 seconds</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}
                      className="flex items-center gap-1.5 btn-glass text-white font-semibold py-3 px-5 rounded-xl text-sm">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step < 2 ? (
              <button onClick={() => { if (step === 0) addCompetitor(); else setStep(2); }}
                      disabled={(step === 0 && (!competitor.name || !competitor.websiteUrl)) || loading}
                      className="flex-1 btn-premium flex items-center justify-center gap-2 text-white font-semibold py-3 px-6 rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            ) : (
              <button onClick={completeOnboarding} disabled={loading}
                      className="flex-1 btn-premium flex items-center justify-center gap-2 text-white font-semibold py-3 px-6 rounded-xl text-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Go to Dashboard <ArrowRight className="w-4 h-4" /></>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
