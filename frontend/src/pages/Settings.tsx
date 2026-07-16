import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Brain, ArrowLeft, Loader2, Check, User, Mail, Shield, Zap, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../utils/store';
import MeshBackground from '../components/MeshBackground';

interface Plan { name: string; price: number; analysesLimit: number; features: string[]; }

export default function Settings() {
  const user = useAuthStore((s) => s.user);
  const [plans, setPlans] = useState<Record<string, Plan>>({});
  const [usage, setUsage] = useState({ analysesCount: 0, analysesLimit: 3, plan: 'free' });
  const [loading, setLoading] = useState(true);
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [plansRes, usageRes] = await Promise.all([api.get('/billing/plans'), api.get('/billing/usage')]);
      setPlans(plansRes.data.plans);
      setUsage(usageRes.data);
    } catch {}
    finally { setLoading(false); }
  };

  const upgrade = async (plan: string) => {
    try {
      const { data } = await api.post('/stripe/checkout', { plan, interval: annual ? 'yearly' : 'monthly' });
      if (data.url) {
        window.location.href = data.url;
      } else {
        // Fallback to fake upgrade if Stripe not configured
        await api.post('/billing/upgrade', { plan });
        toast.success(`Upgraded to ${plan}!`);
        loadData();
      }
    } catch (err: any) {
      // If Stripe endpoint fails, try fake upgrade
      try {
        await api.post('/billing/upgrade', { plan });
        toast.success(`Upgraded to ${plan}!`);
        loadData();
      } catch {
        toast.error(err.response?.data?.error || 'Upgrade failed');
      }
    }
  };

  const manageSubscription = async () => {
    try {
      const { data } = await api.post('/stripe/portal');
      if (data.url) window.location.href = data.url;
    } catch { toast.error('Failed to open billing portal'); }
  };

  const faqs = [
    { q: 'What counts as an analysis?', a: 'Each time you run a full competitor analysis using our 4 AI agents, it counts as one analysis. Viewing past reports does not count.' },
    { q: 'Can I change plans anytime?', a: 'Yes. Upgrade instantly and get immediate access. Downgrade takes effect at the end of your billing cycle.' },
    { q: 'What happens when I hit my limit?', a: 'You\'ll be prompted to upgrade. Your existing reports remain accessible. You can still add and manage competitors.' },
    { q: 'Do you offer refunds?', a: 'We offer a 14-day money-back guarantee on all paid plans. No questions asked.' },
  ];

  if (loading) return (
    <div className="min-h-screen bg-[#0c0c14] flex items-center justify-center relative">
      <MeshBackground />
      <Loader2 className="w-8 h-8 animate-spin text-violet-500 relative z-10" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0c0c14] relative">
      <MeshBackground />

      <nav className="relative z-50 border-b border-white/[0.04] px-8 py-4 flex items-center gap-5 bg-[#0c0c14]/60 backdrop-blur-2xl sticky top-0">
        <Link to="/dashboard" className="text-slate-400 hover:text-white transition"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white font-display">StratScope</span>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-8 py-10">
        {/* Account */}
        <div className="mb-14">
          <h1 className="text-2xl font-black text-white mb-6 font-display tracking-tight">Settings</h1>
          <div className="glass-card rounded-2xl p-7">
            <h2 className="text-lg font-bold text-white mb-5 font-display flex items-center gap-2"><User className="w-5 h-5 text-violet-400" /> Account</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}><Mail className="w-4 h-4 text-slate-500" /></div><div><p className="text-slate-500 text-xs">Name</p><p className="text-white font-medium text-sm">{user?.name}</p></div></div>
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}><Mail className="w-4 h-4 text-slate-500" /></div><div><p className="text-slate-500 text-xs">Email</p><p className="text-white font-medium text-sm">{user?.email}</p></div></div>
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}><Shield className="w-4 h-4 text-slate-500" /></div><div><p className="text-slate-500 text-xs">Plan</p><p className="text-violet-300 font-semibold text-sm capitalize">{usage.plan}</p></div></div>
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}><Zap className="w-4 h-4 text-slate-500" /></div><div><p className="text-slate-500 text-xs">Analyses Used</p><p className="text-white font-medium text-sm">{usage.analysesCount} / {usage.analysesLimit === -1 ? '∞' : usage.analysesLimit}</p></div></div>
            </div>
            {usage.plan !== 'free' && (
              <div className="mt-5 pt-5 border-t border-white/[0.05]">
                <button onClick={manageSubscription} className="text-violet-400 hover:text-violet-300 text-sm font-semibold transition">
                  Manage Subscription →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Pricing */}
        <div>
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-black text-white font-display tracking-tight">Choose Your Plan</h2>
              <p className="text-slate-400 mt-1 font-light">Scale your competitive intelligence as you grow.</p>
            </div>
            <div className="flex items-center gap-1 glass rounded-xl p-1">
              <button onClick={() => setAnnual(false)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${!annual ? 'text-white' : 'text-slate-500 hover:text-white'}`}
                      style={!annual ? { background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.1))', border: '1px solid rgba(139,92,246,0.2)' } : {}}>
                Monthly
              </button>
              <button onClick={() => setAnnual(true)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-1.5 ${annual ? 'text-white' : 'text-slate-500 hover:text-white'}`}
                      style={annual ? { background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.1))', border: '1px solid rgba(139,92,246,0.2)' } : {}}>
                Annual <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>Save 20%</span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(plans).filter(([k]) => k !== 'free').map(([key, plan]) => {
              const isPopular = key === 'pro';
              const displayPrice = annual ? Math.round(plan.price * 0.8) : plan.price;

              return (
                <div key={key} className={`relative p-8 rounded-3xl transition-all duration-500 ${
                  isPopular ? 'glass-strong gradient-border scale-[1.03] glow-violet-strong' : 'glass-card'
                } ${usage.plan === key ? 'ring-2 ring-violet-500/40' : ''}`}>
                  {isPopular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 btn-premium text-xs font-bold px-5 py-1.5 rounded-full text-white whitespace-nowrap">
                      ✦ Most Popular
                    </div>
                  )}
                  {usage.plan === key && <span className="text-xs text-violet-300 font-bold mb-2 block">Current Plan</span>}
                  <h3 className="text-xl font-bold text-white font-display">{plan.name}</h3>
                  <p className="text-slate-400 text-sm mt-1 mb-6 font-light">
                    {key === 'starter' ? 'For individual founders' : key === 'pro' ? 'For growing teams' : 'For companies at scale'}
                  </p>
                  <div className="flex items-baseline gap-1 mb-8">
                    <span className="text-5xl font-black text-white font-display tracking-tight">${displayPrice}</span>
                    <span className="text-slate-500 text-sm">/mo</span>
                    {annual && <span className="text-slate-600 text-xs ml-1">billed annually</span>}
                  </div>
                  <p className="text-slate-400 text-sm mb-6 font-light">{plan.analysesLimit === -1 ? 'Unlimited' : plan.analysesLimit} analyses/month</p>
                  <ul className="space-y-3.5 mb-8">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                             style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.2)' }}>
                          <Check className="w-3 h-3 text-violet-400" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {usage.plan !== key ? (
                    <button onClick={() => upgrade(key)}
                            className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-300 ${isPopular ? 'btn-premium text-white' : 'btn-glass text-white'}`}>
                      {plan.price > 0 ? 'Upgrade' : 'Downgrade'}
                    </button>
                  ) : (
                    <div className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-center"
                         style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)', color: '#c4b5fd' }}>
                      Current Plan
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20">
          <h2 className="text-2xl font-black text-white font-display mb-8 tracking-tight">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="glass-card rounded-2xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full flex items-center justify-between p-6 text-left">
                  <span className="text-white font-semibold">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-slate-400 text-sm leading-relaxed font-light" style={{ animation: 'slide-up 0.3s ease-out' }}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
