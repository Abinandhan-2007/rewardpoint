import React, { useState } from 'react';
import { 
  ShieldCheck, 
  RotateCw, 
  Download, 
  LogOut, 
  Sun, 
  Moon, 
  AlertTriangle, 
  Loader2,
  Users,
  Copy,
  Check,
  Key,
  Award
} from 'lucide-react';

export default function Navbar({
  currentUser,
  currentTeam,
  syncStatus,
  isRefreshing,
  onRefresh,
  onExportCsv,
  onOpenChangePassword,
  onLogout,
  darkMode,
  onToggleTheme
}) {
  const [copiedTeam, setCopiedTeam] = useState(false);

  const isCaptain = currentUser?.role === 'captain';
  const isOnline = syncStatus?.source_reachable !== false;
  const isSyncing = syncStatus?.status === 'running' || isRefreshing;
  const hasError = syncStatus?.status === 'error' || !isOnline;

  const formatLastSync = (isoStr) => {
    if (!isoStr) return 'Never';
    try {
      const date = new Date(isoStr);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (_) {
      return 'Recently';
    }
  };

  const copyTeamId = () => {
    if (currentTeam?.team_id) {
      navigator.clipboard.writeText(currentTeam.team_id);
      setCopiedTeam(true);
      setTimeout(() => setCopiedTeam(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-slate-900/85 backdrop-blur-lg transition-colors duration-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Team Info */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                  Team Reward Tracker
                </span>
                
                {/* Team ID Badge with click-to-copy */}
                {currentTeam?.team_id && (
                  <button
                    type="button"
                    onClick={copyTeamId}
                    title="Click to copy Team ID"
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                  >
                    <Users className="w-3 h-3" />
                    <span>{currentTeam.team_id}</span>
                    {copiedTeam ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                )}

                {/* Role Badge */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  isCaptain 
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                }`}>
                  {isCaptain ? '👑 Captain' : '🎓 Member'}
                </span>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Team ID: <strong className="text-slate-700 dark:text-slate-300 font-mono">{currentTeam?.team_id}</strong> • Logged in as {currentUser?.name || currentUser?.roll_no}
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Live Source Status Indicator */}
            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
              isSyncing 
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' 
                : hasError 
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' 
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            }`}>
              {isSyncing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 dark:text-blue-400" />
              ) : hasError ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 animate-pulse" />
              ) : (
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </div>
              )}
              <div className="flex flex-col text-left">
                <span className="font-semibold text-[11px]">
                  {isSyncing ? 'Syncing...' : hasError ? 'Source Unreachable' : 'Source Connected'}
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  Last: {formatLastSync(syncStatus?.last_sync_finish || syncStatus?.last_sync_start)}
                </span>
              </div>
            </div>

            {/* Captain Only: Manual Refresh Button */}
            {isCaptain && (
              <button
                onClick={onRefresh}
                disabled={isSyncing}
                title="Manual refresh from Gradio Space"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700/80 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-brand-600 dark:text-brand-400' : ''}`} />
                <span className="hidden sm:inline">Refresh Now</span>
              </button>
            )}

            {/* Captain Only: Export CSV Button */}
            {isCaptain && (
              <button
                onClick={onExportCsv}
                title="Download current team metrics as CSV"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700/80 transition-all cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            )}

            {/* PROMINENT LIGHT / DARK MODE TOGGLE BUTTON */}
            <button
              onClick={onToggleTheme}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium border border-slate-200 dark:border-slate-700/80 transition-all cursor-pointer shadow-xs group"
            >
              {darkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-45 transition-transform" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600 group-hover:-rotate-12 transition-transform" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Change Password Button (Captain Only) */}
            {isCaptain && (
              <button
                onClick={onOpenChangePassword}
                title="Change Captain Password"
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80 transition-all cursor-pointer"
              >
                <Key className="w-4 h-4" />
              </button>
            )}

            {/* Logout */}
            <button
              onClick={onLogout}
              title="Logout"
              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-500/20 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700/80 hover:border-rose-300 dark:hover:border-rose-500/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
