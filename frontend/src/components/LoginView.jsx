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
  GraduationCap
} from 'lucide-react';
import { api, setAuthToken } from '../services/api';

export default function LoginView({ onLoginSuccess }) {
  // 'member_login' | 'captain_login' | 'create_team'
  const [tab, setTab] = useState('member_login');

  // Member Login fields
  const [memberTeamId, setMemberTeamId] = useState('');
  const [memberRollNo, setMemberRollNo] = useState('');

  // Captain Login fields
  const [captainTeamId, setCaptainTeamId] = useState('');
  const [captainRollNo, setCaptainRollNo] = useState('');
  const [captainPassword, setCaptainPassword] = useState('');
  const [showCaptainPassword, setShowCaptainPassword] = useState(false);

  // Create Team fields (Captain gives their own Team ID, no auto-gen, no team name)
  const [signupTeamId, setSignupTeamId] = useState('');
  const [signupCaptainRollNo, setSignupCaptainRollNo] = useState('');
  const [signupCaptainName, setSignupCaptainName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdTeamInfo, setCreatedTeamInfo] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // 1. Member Login (NO PASSWORD REQUIRED)
  const handleMemberLoginSubmit = async (e) => {
    e.preventDefault();
    if (!memberTeamId.trim() || !memberRollNo.trim()) {
      setError('Please provide both Team ID and Roll Number.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const res = await api.login(
        memberTeamId.trim().toUpperCase(),
        memberRollNo.trim().toUpperCase(),
        '' // No password needed for member
      );
      setAuthToken(res.token);
      if (onLoginSuccess) onLoginSuccess(res);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your Team ID and Roll Number.');
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Captain Login (Requires Password)
  const handleCaptainLoginSubmit = async (e) => {
    e.preventDefault();
    if (!captainTeamId.trim() || !captainRollNo.trim() || !captainPassword.trim()) {
      setError('Please provide Team ID, Roll Number, and Password.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const res = await api.login(
        captainTeamId.trim().toUpperCase(),
        captainRollNo.trim().toUpperCase(),
        captainPassword.trim()
      );
      setAuthToken(res.token);
      if (onLoginSuccess) onLoginSuccess(res);
    } catch (err) {
      setError(err.message || 'Captain login failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Create Team (Captain enters their chosen Team ID)
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!signupTeamId.trim() || !signupCaptainRollNo.trim() || !signupPassword.trim()) {
      setError('Please provide Team ID, Captain Roll Number, and Password.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const res = await api.signup(
        signupTeamId.trim().toUpperCase(),
        signupCaptainRollNo.trim().toUpperCase(),
        signupPassword.trim(),
        signupCaptainName.trim()
      );
      setCreatedTeamInfo(res.team);
      setAuthToken(res.token);
      setTimeout(() => {
        if (onLoginSuccess) onLoginSuccess(res);
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to create team. Team ID might already exist.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Demo Fillers
  const fillMemberDemo = () => {
    setTab('member_login');
    setMemberTeamId('TEAM-ALPHA');
    setMemberRollNo('7376231CS101');
    setError('');
  };

  const fillCaptainDemo = () => {
    setTab('captain_login');
    setCaptainTeamId('TEAM-ALPHA');
    setCaptainRollNo('7376241CS280');
    setCaptainPassword('captain2026');
    setError('');
  };

  const handleCopyTeamId = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 selection:bg-brand-500 selection:text-white transition-colors duration-200 relative overflow-hidden">
      {/* Background ambient decorative glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 dark:bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 my-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl relative">
          
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/25 mb-3 animate-bounce-subtle">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center justify-center gap-2">
              Team Reward Tracker
              <Sparkles className="w-4 h-4 text-amber-500" />
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
              Live Team Rewards Dashboard & Performance
            </p>
          </div>

          {/* Mode Switch Tabs (3 Distinct Options) */}
          <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 mb-6 text-xs font-semibold gap-1">
            <button
              type="button"
              onClick={() => { setTab('member_login'); setError(''); }}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'member_login'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Member</span>
            </button>

            <button
              type="button"
              onClick={() => { setTab('captain_login'); setError(''); }}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'captain_login'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Captain</span>
            </button>

            <button
              type="button"
              onClick={() => { setTab('create_team'); setError(''); }}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'create_team'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Team</span>
            </button>
          </div>

          {/* Success Banner after Team Creation */}
          {createdTeamInfo && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 text-xs text-center space-y-2 animate-fade-in">
              <div className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                🎉 Team Created Successfully!
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Your Team ID:
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 font-mono font-bold text-sm text-brand-600 dark:text-brand-400">
                <span>{createdTeamInfo.team_id}</span>
                <button
                  type="button"
                  onClick={() => handleCopyTeamId(createdTeamInfo.team_id)}
                  className="p-1 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  title="Copy Team ID"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Logging you into your captain dashboard...
              </p>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* ----------------- TAB 1: MEMBER LOGIN (NO PASSWORD) ----------------- */}
          {tab === 'member_login' && !createdTeamInfo && (
            <form onSubmit={handleMemberLoginSubmit} className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                🎓 <strong>Passwordless Member Login:</strong> Members only need to enter their Team ID and Roll Number. No password required!
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Team ID <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={memberTeamId}
                    onChange={(e) => setMemberTeamId(e.target.value.toUpperCase())}
                    placeholder="e.g. TEAM-ALPHA"
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Your Roll Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={memberRollNo}
                  onChange={(e) => setMemberRollNo(e.target.value.toUpperCase())}
                  placeholder="e.g. 7376231CS101"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>View My Reward Points</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* 1-Click Demo Fill for Member */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  type="button"
                  onClick={fillMemberDemo}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Click here to test Member Demo (TEAM-ALPHA / 7376231CS101)</span>
                </button>
              </div>
            </form>
          )}

          {/* ----------------- TAB 2: CAPTAIN LOGIN (WITH PASSWORD) ----------------- */}
          {tab === 'captain_login' && !createdTeamInfo && (
            <form onSubmit={handleCaptainLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Team ID <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={captainTeamId}
                    onChange={(e) => setCaptainTeamId(e.target.value.toUpperCase())}
                    placeholder="e.g. TEAM-ALPHA"
                    required
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Captain Roll Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={captainRollNo}
                  onChange={(e) => setCaptainRollNo(e.target.value.toUpperCase())}
                  placeholder="e.g. 7376241CS280"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Captain Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showCaptainPassword ? 'text' : 'password'}
                    value={captainPassword}
                    onChange={(e) => setCaptainPassword(e.target.value)}
                    placeholder="Enter captain password"
                    required
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCaptainPassword(!showCaptainPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showCaptainPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-xs shadow-md shadow-amber-600/25 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In as Captain</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* 1-Click Demo Fill for Captain */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  type="button"
                  onClick={fillCaptainDemo}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Click here to test Captain Demo (TEAM-ALPHA / 7376241CS280)</span>
                </button>
              </div>
            </form>
          )}

          {/* ----------------- TAB 3: CREATE TEAM (CAPTAIN CHOOSES TEAM ID) ----------------- */}
          {tab === 'create_team' && !createdTeamInfo && (
            <form onSubmit={handleSignupSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Team ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={signupTeamId}
                  onChange={(e) => setSignupTeamId(e.target.value.toUpperCase())}
                  placeholder="Choose your Team ID (e.g. ALPHA, SQUAD-1, 2026-CS)..."
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Choose your team identifier directly. Not automatically generated.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Captain Roll Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={signupCaptainRollNo}
                  onChange={(e) => setSignupCaptainRollNo(e.target.value.toUpperCase())}
                  placeholder="e.g. 7376241CS280"
                  required
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Captain Name <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={signupCaptainName}
                  onChange={(e) => setSignupCaptainName(e.target.value)}
                  placeholder="e.g. Monish JB"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Captain Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a secure captain password"
                    required
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-brand-600/25 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Team & Launch</span>
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
