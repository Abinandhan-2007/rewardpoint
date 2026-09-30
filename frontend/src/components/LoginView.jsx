import React, { useState } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Sparkles, 
  AlertCircle, 
  ArrowRight,
  UserPlus,
  LogIn,
  Users,
  Copy,
  Check,
  Award
} from 'lucide-react';
import { api, setAuthToken } from '../services/api';

export default function LoginView({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  // Login form state
  const [teamId, setTeamId] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup form state
  const [signupTeamName, setSignupTeamName] = useState('');
  const [signupCaptainName, setSignupCaptainName] = useState('');
  const [signupRollNo, setSignupRollNo] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdTeamInfo, setCreatedTeamInfo] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!teamId.trim() || !rollNo.trim() || !password.trim()) {
      setError('Please provide Team ID, Roll Number, and Password.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const res = await api.login(
        teamId.trim().toUpperCase(),
        rollNo.trim().toUpperCase(),
        password.trim()
      );
      setAuthToken(res.token);
      if (onLoginSuccess) onLoginSuccess(res);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!signupTeamName.trim() || !signupCaptainName.trim() || !signupRollNo.trim() || !signupPassword.trim()) {
      setError('Please fill in all team and captain fields.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const res = await api.signup(
        signupCaptainName.trim(),
        signupRollNo.trim().toUpperCase(),
        signupPassword.trim(),
        signupTeamName.trim()
      );
      setCreatedTeamInfo(res.team);
      setAuthToken(res.token);
      // Wait briefly so user sees the newly generated Team ID
      setTimeout(() => {
        if (onLoginSuccess) onLoginSuccess(res);
      }, 2500);
    } catch (err) {
      setError(err.message || 'Failed to create team.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillQuickDemo = (demoType) => {
    if (demoType === 'captain') {
      setTeamId('TEAM-ALPHA');
      setRollNo('7376241CS280');
      setPassword('captain2026');
    } else {
      setTeamId('TEAM-ALPHA');
      setRollNo('7376231CS101');
      setPassword('member123');
    }
    setError('');
  };

  const handleCopyTeamId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 relative overflow-hidden text-slate-100 selection:bg-brand-500 selection:text-white">
      {/* Background ambient decorative glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 my-8">
        <div className="glass-card rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/30 mb-3 animate-bounce-subtle">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              Team Reward Tracker
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Multi-Team Live Rewards Dashboard & Performance
            </p>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex p-1 rounded-xl bg-slate-900/80 border border-slate-800 mb-6 text-xs">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Team Login</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); }}
              className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Team</span>
            </button>
          </div>

          {/* Congratulations Card after Team Creation */}
          {createdTeamInfo && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs text-center space-y-2 animate-fade-in">
              <div className="text-base font-bold text-white flex items-center justify-center gap-2">
                🎉 Team Created Successfully!
              </div>
              <p className="text-slate-300">
                Your auto-generated Team ID is:
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-400 font-mono font-bold text-sm">
                <span>{createdTeamInfo.team_id}</span>
                <button
                  type="button"
                  onClick={() => handleCopyTeamId(createdTeamInfo.team_id)}
                  className="p-1 hover:text-white"
                  title="Copy Team ID"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Logging you into your new captain dashboard...
              </p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {mode === 'login' && !createdTeamInfo && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Team ID <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Users className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value.toUpperCase())}
                    placeholder="e.g. TEAM-ALPHA"
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Roll Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                  placeholder="Enter student roll number..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
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
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Team</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* 1-Click Demo Fill Helpers */}
              <div className="pt-4 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2 text-center font-semibold">
                  Quick Demo Credentials:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => fillQuickDemo('captain')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 text-left transition-colors cursor-pointer group"
                  >
                    <span className="font-semibold text-brand-400 text-[11px] block">👑 Captain Demo</span>
                    <span className="text-[10px] text-slate-400">monish jb (Alpha)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickDemo('member')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 text-left transition-colors cursor-pointer group"
                  >
                    <span className="font-semibold text-emerald-400 text-[11px] block">🎓 Member Demo</span>
                    <span className="text-[10px] text-slate-400">AAMINA A (Alpha)</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 2: SIGNUP FORM (CAPTAIN CREATES TEAM) */}
          {mode === 'signup' && !createdTeamInfo && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Team Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={signupTeamName}
                  onChange={(e) => setSignupTeamName(e.target.value)}
                  placeholder="e.g. Phoenix Innovators"
                  required
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Captain Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={signupCaptainName}
                  onChange={(e) => setSignupCaptainName(e.target.value)}
                  placeholder="e.g. Alex Johnson"
                  required
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Captain Roll Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={signupRollNo}
                  onChange={(e) => setSignupRollNo(e.target.value.toUpperCase())}
                  placeholder="e.g. 7376241CS280"
                  required
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Captain Password <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a strong password"
                    required
                    className="w-full pl-3 pr-10 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] leading-relaxed">
                ✨ A unique, readable Team ID (e.g. <strong>TEAM-4F9K2</strong>) will be automatically generated for your squad!
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Generate Team & Launch</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
