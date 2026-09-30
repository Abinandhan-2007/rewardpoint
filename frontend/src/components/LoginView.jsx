import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Eye, EyeOff, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { api, setAuthToken } from '../services/api';

export default function LoginView({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the captain password');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const res = await api.login(password.trim());
      setAuthToken(res.token);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || 'Incorrect password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 relative overflow-hidden">
      {/* Background ambient decorative glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="glass-card rounded-2xl p-8 border border-slate-800 shadow-2xl relative">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/30 mb-4 animate-bounce-subtle">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              Team Reward Tracker
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h1>
            <p className="text-slate-400 text-sm mt-1.5">
              Captain Dashboard Access & Team Analytics
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Captain Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter captain password"
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-medium text-sm shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Access Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Captain Hint */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-xs text-slate-500">
              Default password: <span className="font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">captain2026</span>
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              Configured via <code className="text-slate-400">CAPTAIN_PASSWORD</code> in backend <code className="text-slate-400">.env</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
