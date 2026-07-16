import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Brain, Target, Shield, Zap, BarChart3, Eye, TrendingUp,
  Check, ArrowRight, Sparkles, Globe, Activity, Users, Star,
  ChevronRight, ArrowUpRight
} from 'lucide-react';
import MeshBackground from '../components/MeshBackground';

/* ─── Animated Counter ─── */
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const duration = 2000;
        const steps = 60;
        const increment = target / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= target) { setCount(target); clearInterval(timer); }
          else setCount(Math.floor(current));
        }, duration / steps);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─── Particle Field ─── */
function Particles() {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    duration: `${8 + Math.random() * 12}s`,
    delay: `${Math.random() * 5}s`,
    size: `${1 + Math.random() * 2}px`,
  }));

  return (
    <div className="particles">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            '--duration': p.duration,
            '--delay': p.delay,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ─── Floating Orbs (Hero decoration) ─── */
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-[15%] w-80 h-80 bg-violet-600/30 rounded-full blur-[120px] animate-[float-slow_20s_ease-in-out_infinite]" />
      <div className="absolute top-40 right-[10%] w-[28rem] h-[28rem] bg-indigo-600/25 rounded-full blur-[140px] animate-[float-slow_25s_ease-in-out_infinite_reverse]" />
      <div className="absolute bottom-20 left-[40%] w-96 h-96 bg-cyan-500/15 rounded-full blur-[130px] animate-[float-slow_22s_ease-in-out_infinite]" style={{ animationDelay: '-5s' }} />
      {/* Animated rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-violet-500/10 rounded-full animate-[spin-slow_60s_linear_infinite]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-indigo-500/8 rounded-full animate-[spin-slow_80s_linear_infinite_reverse]" />
    </div>
  );
}

/* ─── Main Landing ─── */
export default function Landing() {
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -60px 0px' }
    );

    sectionRefs.current.forEach((el) => {
      if (el) {
        el.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach((child) => {
          observer.observe(child);
        });
      }
    });

    return () => observer.disconnect();
  }, []);

  const addSectionRef = (i: number) => (el: HTMLDivElement | null) => {
    sectionRefs.current[i] = el;
  };

  return (
    <div className="min-h-screen bg-[#0c0c14] text-white overflow-hidden">
      <MeshBackground />

      {/* ═══════ NAV ═══════ */}
      <nav className="relative z-50 flex items-center justify-between px-8 py-5 border-b border-white/[0.04] bg-[#0c0c14]/60 backdrop-blur-2xl sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
            <Brain className="w-5 h-5 text-white relative z-10" />
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_3s_linear_infinite]" style={{ backgroundSize: '200% 100%' }} />
          </div>
          <span className="text-xl font-bold text-white font-display tracking-tight">StratScope</span>
        </div>
        <div className="flex items-center gap-6">
          <Link to="/login" className="text-slate-400 hover:text-white transition-all duration-300 font-medium text-sm">Login</Link>
          <Link to="/register" className="btn-premium text-sm py-2.5 px-6 text-white rounded-xl font-semibold">
            Start Free Trial
          </Link>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="relative min-h-screen flex items-center justify-center px-8 pt-20">
        <FloatingOrbs />
        <Particles />

        {/* Video Background */}
        <div className="video-bg">
          <video autoPlay muted loop playsInline poster="">
            <source src="https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4" type="video/mp4" />
          </video>
          {/* CSS fallback if video doesn't load */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 30% 40%, rgba(139, 92, 246, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(99, 102, 241, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 20%, rgba(56, 189, 248, 0.08) 0%, transparent 50%)',
            zIndex: -1,
          }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto text-center">
          {/* Badge */}
          <div className="reveal inline-flex items-center gap-2.5 glass-strong rounded-full px-6 py-3 mb-10 border border-violet-500/25"
               style={{ animation: 'slide-down 0.8s ease-out both' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
            <span className="text-sm font-semibold text-violet-300">AI-Powered Competitive Intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="text-6xl md:text-8xl font-black font-display mb-8 tracking-tighter leading-[0.95]"
              style={{ animation: 'hero-text-reveal 1s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both' }}>
            Decode Your Competitors'
            <br />
            <span className="gradient-text-animated">True Intent</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed font-light"
             style={{ animation: 'slide-up 0.8s ease-out 0.5s both' }}>
            Stop guessing. StratScope uses cognitive psychology, game theory, and data science
            to reveal what your competitors are <em className="text-white not-italic font-medium">actually thinking</em>.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-5 justify-center mb-10"
               style={{ animation: 'slide-up 0.8s ease-out 0.7s both' }}>
            <Link to="/register" className="btn-premium text-lg inline-flex items-center justify-center gap-3 py-5 px-12 text-white rounded-2xl font-bold text-xl">
              Start Free Analysis
              <ArrowRight className="w-6 h-6" />
            </Link>
            <a href="#how" className="btn-glass text-lg inline-flex items-center justify-center gap-3 py-5 px-12 text-white rounded-2xl font-semibold text-xl">
              See How It Works
              <ChevronRight className="w-6 h-6" />
            </a>
          </div>
          <p className="text-slate-600 text-sm" style={{ animation: 'fade-in 1s ease-out 1s both' }}>
            No credit card required · 3 free analyses · Cancel anytime
          </p>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40 animate-bounce">
          <div className="w-5 h-8 border-2 border-white/20 rounded-full flex justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/40 rounded-full animate-[float-slow_2s_ease-in-out_infinite]" />
          </div>
        </div>
      </section>

      {/* ═══════ STATS BAR ═══════ */}
      <section ref={addSectionRef(0)} className="relative z-10 border-y border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-8 py-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {[
              { value: 4, suffix: '', label: 'AI Agents in Sequence', icon: Sparkles },
              { value: 10, suffix: 's', label: 'Per Full Analysis', icon: Zap },
              { value: 3, suffix: '', label: 'Counter-Strategies', icon: Target },
              { value: 0, suffix: '$', label: 'To Get Started', icon: TrendingUp },
            ].map(({ value, suffix, label, icon: Icon }, i) => (
              <div key={label} className={`reveal text-center reveal-delay-${i + 1}`}>
                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl glass-strong flex items-center justify-center border border-violet-500/15">
                  <Icon className="w-6 h-6 text-violet-400" />
                </div>
                <div className="text-5xl md:text-6xl font-black text-white font-display tracking-tight mb-2"
                     style={{ animation: 'counter-pulse 4s ease-in-out infinite' }}>
                  {suffix === '$' && <span className="text-violet-400">$</span>}
                  <Counter target={value} />
                  {suffix && suffix !== '$' && <span className="text-violet-400">{suffix}</span>}
                </div>
                <p className="text-slate-500 text-sm font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ HOW IT WORKS ═══════ */}
      <section ref={addSectionRef(1)} id="how" className="relative z-10 section-premium">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-24">
            <div className="reveal inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 border border-violet-500/10">
              <span className="text-sm font-semibold text-violet-300">How It Works</span>
            </div>
            <h2 className="reveal reveal-delay-1 text-5xl md:text-7xl font-black font-display mb-6 tracking-tight">
              4 Agents.<br />
              <span className="gradient-text-animated">One Brutal Truth.</span>
            </h2>
            <p className="reveal reveal-delay-2 text-lg text-slate-400 max-w-2xl mx-auto font-light">
              Each agent specializes in one dimension. Together, they reveal what no human analyst can.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: BarChart3, title: 'Data Decoder', desc: 'Strips marketing fluff. Finds hard pricing shifts, feature changes, and anomalies.', num: '01', color: 'from-blue-500/20 to-cyan-500/10', borderColor: 'border-blue-500/15', iconColor: 'text-blue-400' },
              { icon: Eye, title: 'Psych Profiler', desc: 'Reverse-engineers competitor psychology. Identifies fears, desperation, and blind spots.', num: '02', color: 'from-purple-500/20 to-pink-500/10', borderColor: 'border-purple-500/15', iconColor: 'text-purple-400' },
              { icon: Target, title: 'Strategy Engineer', desc: 'Game theory counter-moves. Projects 2 moves ahead. Finds asymmetric advantages.', num: '03', color: 'from-emerald-500/20 to-teal-500/10', borderColor: 'border-emerald-500/15', iconColor: 'text-emerald-400' },
              { icon: Shield, title: 'Executive Reporter', desc: 'Premium B2B brief. Sharp, actionable, worth $500 — delivered in minutes.', num: '04', color: 'from-violet-500/20 to-indigo-500/10', borderColor: 'border-violet-500/15', iconColor: 'text-violet-400' },
            ].map(({ icon: Icon, title, desc, num, color, borderColor, iconColor }, i) => (
              <div key={title} className={`reveal reveal-delay-${i + 1} glass-card rounded-2xl p-7 relative overflow-hidden group`}>
                <div className={`absolute inset-0 bg-gradient-to-b ${color} opacity-50`} />
                <div className="absolute top-4 right-4 text-7xl font-black text-white/[0.02] font-display">{num}</div>
                <div className="relative z-10">
                  <div className={`w-14 h-14 rounded-2xl bg-white/[0.04] border ${borderColor} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500`}>
                    <Icon className={`w-6 h-6 ${iconColor}`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 font-display">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FEATURES GRID ═══════ */}
      <section ref={addSectionRef(2)} className="relative z-10 section-premium bg-white/[0.01]">
        <div className="divider-glow mb-28" />
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="reveal inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 border border-violet-500/10">
              <span className="text-sm font-semibold text-violet-300">Platform</span>
            </div>
            <h2 className="reveal reveal-delay-1 text-5xl md:text-6xl font-black font-display mb-6 tracking-tight">
              Built for Serious<br />
              <span className="gradient-text-static">Competitors</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Activity, title: 'Scheduled Monitoring', desc: 'Set it and forget it. We re-analyze your competitors on your schedule and alert you when things change.', gradient: 'from-violet-500/10 to-indigo-500/5' },
              { icon: TrendingUp, title: 'Trend Analysis', desc: 'Track competitor moves over time. See patterns emerge before they become threats.', gradient: 'from-emerald-500/10 to-teal-500/5' },
              { icon: Globe, title: 'Deep Web Research', desc: 'Exa AI crawls review sites, news, funding databases, and tech stacks — not just their homepage.', gradient: 'from-blue-500/10 to-cyan-500/5' },
              { icon: Shield, title: 'Enterprise Security', desc: 'JWT authentication, rate limiting, and encrypted data. Your intelligence stays yours.', gradient: 'from-amber-500/10 to-orange-500/5' },
              { icon: Users, title: 'Multi-Competitor Tracking', desc: 'Track as many competitors as your plan allows. Compare them side-by-side.', gradient: 'from-pink-500/10 to-rose-500/5' },
              { icon: Zap, title: 'Instant Reports', desc: 'Get executive-grade intelligence briefs in under 10 seconds. Not hours. Not days.', gradient: 'from-purple-500/10 to-violet-500/5' },
            ].map(({ icon: Icon, title, desc, gradient }, i) => (
              <div key={title} className={`reveal reveal-delay-${i + 1} glass-card rounded-2xl p-7 group`}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} border border-white/[0.06] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500`}>
                  <Icon className="w-5 h-5 text-slate-300" />
                </div>
                <h3 className="text-base font-bold text-white mb-2.5 font-display">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ PRICING ═══════ */}
      <section ref={addSectionRef(3)} className="relative z-10 section-premium">
        <div className="divider-glow mb-28" />

        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <div className="reveal inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 mb-6 border border-violet-500/10">
              <span className="text-sm font-semibold text-violet-300">Simple Pricing</span>
            </div>
            <h2 className="reveal reveal-delay-1 text-5xl md:text-6xl font-black font-display mb-6 tracking-tight">
              Start Free.<br />
              <span className="gradient-text-animated">Scale When Ready.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              { name: 'Starter', price: '49', description: 'For individual founders', features: ['25 analyses/month', 'Full AI reports', 'Email alerts', '3 competitors'], popular: false },
              { name: 'Pro', price: '149', description: 'For growing teams', features: ['100 analyses/month', 'Full AI reports', 'Real-time alerts', 'PDF export', '10 competitors', 'Priority support'], popular: true },
              { name: 'Enterprise', price: '499', description: 'For companies at scale', features: ['Unlimited analyses', 'Full AI reports', 'Real-time alerts', 'PDF export', 'Unlimited competitors', 'API access', 'Dedicated support'], popular: false },
            ].map(({ name, price, description, features, popular }, i) => (
              <div key={name} className={`reveal reveal-delay-${i + 1} relative p-8 rounded-3xl transition-all duration-500 ${
                popular
                  ? 'glass-strong gradient-border scale-[1.03] glow-violet-strong'
                  : 'glass-card'
              }`} style={popular ? { background: 'rgba(255,255,255,0.06)', boxShadow: '0 0 60px rgba(139, 92, 246, 0.15), 0 20px 60px rgba(0,0,0,0.3)' } : {}}>
                {popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 btn-premium text-xs font-bold px-5 py-1.5 rounded-full text-white whitespace-nowrap">
                    ✦ Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold text-white font-display">{name}</h3>
                <p className="text-slate-400 text-sm mt-1.5 mb-6">{description}</p>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-black text-white font-display tracking-tight">${price}</span>
                  <span className="text-slate-500 text-sm">/mo</span>
                </div>
                <ul className="space-y-3.5 mb-8">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                      <div className="w-5 h-5 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-violet-400" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className={`block text-center py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-300 ${
                  popular
                    ? 'btn-premium text-white'
                    : 'btn-glass text-white'
                }`}>
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ FINAL CTA ═══════ */}
      <section ref={addSectionRef(4)} className="relative z-10 py-32 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="reveal relative p-16 md:p-20 rounded-3xl glass-strong gradient-border overflow-hidden">
            {/* Background glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-violet-600/30 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-[300px] h-[200px] bg-indigo-600/25 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-black font-display mb-6 tracking-tight">
                Ready to Stop<br />
                <span className="gradient-text-animated">Guessing?</span>
              </h2>
              <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto font-light">
                Join founders who know what their competitors are actually thinking.
                Start with 3 free analyses.
              </p>
              <Link to="/register" className="btn-premium inline-flex items-center gap-3 text-lg py-4 px-12 rounded-2xl font-bold text-white">
                Get Your Free Analysis
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="relative z-10 border-t border-white/[0.04] px-8 py-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
              <Brain className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white font-display">StratScope</span>
          </div>
          <p className="text-slate-600 text-sm">Competitive Intelligence Decoded.</p>
        </div>
      </footer>
    </div>
  );
}
