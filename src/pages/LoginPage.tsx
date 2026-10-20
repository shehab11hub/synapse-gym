import React, { useState } from 'react';
import {
  Lock,
  User,
  ShieldAlert,
  ArrowRight,
  Dumbbell,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { sounds } from '../utils/sound';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const res = login(username, password);
      setIsLoading(false);
      if (!res.success) {
        setError(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      } else {
        sounds.playSuccessDing();
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#070b12] flex items-center justify-center p-4 relative overflow-hidden selection:bg-teal-500 selection:text-white" dir="rtl">
      {/* Background Glow Orbs */}
      <div className="absolute top-1/4 -right-24 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-25 pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Card Container */}
        <div className="bg-[#0f172a]/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-black/80 relative">
          {/* Top Brand */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 p-0.5 shadow-xl shadow-teal-500/25 mb-4 flex items-center justify-center">
              <div className="w-full h-full bg-[#0b1120] rounded-[14px] flex items-center justify-center">
                <Dumbbell className="w-8 h-8 text-teal-400 transform -rotate-45" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <h1 className="text-2xl font-black tracking-wider text-white">SYNAPSE</h1>
              <span className="text-xs uppercase font-extrabold px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-400 border border-teal-500/30">
                GYM SaaS
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1.5">
              نظام إدارة الجيم والاشتراكات السحابي المتكامل
            </p>
          </div>

          {/* Protected Portal Security Banner */}
          <div className="mb-6 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs flex items-center gap-2.5 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
            <span className="text-[11px] leading-relaxed">
              بوابة تسجيل دخول آمنة ومحمية. يرجى إدخال اسم المستخدم وكلمة المرور المعتمدة.
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                اسم المستخدم (Username)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم المستخدم..."
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 pl-10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition dir-ltr"
                  autoFocus
                />
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                كلمة المرور (Password)
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-3 pl-10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition dir-ltr"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-black text-sm shadow-lg shadow-teal-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>تسجيل الدخول للنظام</span>
                  <ArrowRight className="w-4 h-4 transform rotate-180" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-8 pt-5 border-t border-slate-800/80 text-center text-xs text-slate-500">
            <p>منظومة Synapse Gym SaaS - الإصدار الإنتاجي للتشغيل الفعلي v2.4</p>
          </div>
        </div>
      </div>
    </div>
  );
};
