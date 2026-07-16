import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brain, Loader2, ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuthStore } from '../utils/store';
import MeshBackground from '../components/MeshBackground';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      login(data.user, data.token);
      toast.success('Account created! Welcome to StratScope.');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0c14] flex relative overflow-hidden">
      <MeshBackground />

      {/* Left Panel — Brand */}
      <div className="hidden lg:flex lg:w-[45%] relative items-center justify-center p-16 overflow-hidden"
           style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.08) 0%, transparent 70%)' }}>
        <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-violet-600/35 rounded-full blur-[140px] animate-[float-slow_20s_ease-in-out_infinite]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-indigo-600/30 rounded-full blur-[120px] animate-[float-slow_25s_ease-in-out_infinite_reverse]" />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-violet-500/[0.06] rounded-full animate-[spin-slow_60s_linear_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] border border-indigo-500/[0.04] rounded-full animate-[spin-slow_80s_linear_infinite_reverse]" />

        <div className="relative z-10 max-w-md">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-10 relative overflow-hidden"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
            <Brain className="w-8 h-8 text-white relative z-10" />
            <div className="absolute inset-0 bg-white/20 animate-[shimmer_3s_linear_infinite]" style={{ backgroundSize: '200% 100%' }} />
          </div>
          <h2 className="text-5xl font-black font-display mb-5 tracking-tight leading-tight">Start<br />Decoding</h2>
          <p className="text-slate-300 text-lg leading-relaxed font-light mb-12">
            Create your free account and get 3 competitive intelligence analyses. No credit card required.
          </p>
          <div className="space-y-5">
            {[
              '4 specialized AI agents',
              'Psychological profiling',
              'Game theory strategies',
              'Instant executive briefs',
            ].map((f, i) => (
              <div key={f} className="flex items-center gap-4">
                <div className="w-7 h-7 rounded-full flex items-center justify-center"
                     style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(99,102,241,0.2))', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <Check className="w-3.5 h-3.5 text-violet-300" />
                </div>
                <span className="text-slate-300 font-light">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md" style={{ animation: 'blur-in 0.8s ease-out both' }}>
          <div className="lg:hidden text-center mb-10">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #7c3aed, #6366f1)' }}>
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white font-display">StratScope</span>
            </Link>
          </div>
          <h1 className="text-3xl font-black text-white mb-2 font-display tracking-tight">Create Account</h1>
          <p className="text-slate-400 mb-10 font-light">Get started with 3 free analyses</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Full Name</label>
              <input type="text" className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all duration-300" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
              <input type="email" className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all duration-300" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/30 transition-all duration-300 pr-12" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition p-1">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full btn-premium flex items-center justify-center gap-2.5 py-4 text-white rounded-xl font-bold text-base disabled:opacity-40">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Create Free Account <ArrowRight className="w-4 h-4" /></>}
            </button>
            <p className="text-center text-slate-500 text-sm font-light">
              Already have an account? <Link to="/login" className="text-violet-400 hover:text-violet-300 font-semibold transition">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
