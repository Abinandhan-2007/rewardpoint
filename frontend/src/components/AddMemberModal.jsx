import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Check, Clock, Loader2, Copy, Sparkles } from 'lucide-react';
import { api } from '../services/api';

export default function AddMemberModal({ isOpen, onClose, onMemberAdded, currentTeam }) {
  const [rollNo, setRollNo] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rollNo.trim()) {
      setError('Roll number is required');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const addedRoll = rollNo.trim().toUpperCase();
      const res = await api.addTeamMember({
        roll_no: addedRoll,
        name: name.trim() || undefined
      });

      setCreatedCredentials({
        team_id: res.team_id || currentTeam?.team_id,
        roll_no: res.roll_no,
        name: res.name
      });

      if (onMemberAdded) {
        onMemberAdded(res);
      }
    } catch (err) {
      setError(err.message || 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `Team Reward Tracker Login:\nTeam ID: ${createdCredentials.team_id}\nRoll Number: ${createdCredentials.roll_no}\n(No password needed)\nLogin URL: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleResetAndClose = () => {
    setRollNo('');
    setName('');
    setCreatedCredentials(null);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/85 backdrop-blur-sm animate-fade-in text-slate-800 dark:text-slate-100">
      <div className="w-full max-w-md rounded-2xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Add Team Member
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Team ID: <strong className="text-slate-700 dark:text-slate-300 font-mono">{currentTeam?.team_id}</strong>
            </p>
          </div>
        </div>

        {/* Credentials Share Card on Success */}
        {createdCredentials ? (
          <div className="space-y-4 py-2 animate-fade-in">
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>Member Enrolled & Tracking Started!</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Share these login details with the student:
              </p>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700/80 font-mono text-xs space-y-1.5 text-slate-800 dark:text-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-400">Team ID:</span>
                  <span className="font-bold text-brand-600 dark:text-brand-400">{createdCredentials.team_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Roll Number:</span>
                  <span className="font-bold">{createdCredentials.roll_no}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-sans text-[11px]">
                  <span>Password:</span>
                  <span className="font-semibold">Not needed (roll number is enough)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyCredentials}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Login Info Copied to Clipboard!' : 'Copy Login Details to Share'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreatedCredentials(null);
                  setRollNo('');
                  setName('');
                }}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                Add Another Member
              </button>
              <button
                type="button"
                onClick={handleResetAndClose}
                className="flex-1 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Informative Note about Gradio Fetch Time */}
            <div className="mb-4 p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-semibold block text-indigo-800 dark:text-indigo-300">
                  ⚡ Auto-Fetch & Passwordless:
                </span>
                The student's name, reward points, and marks will auto-fetch from Gradio in <strong>~3 seconds</strong>. Members do not need a password to log in.
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Roll Number <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                  placeholder="Enter student roll number (e.g. 7376241CS106)..."
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all uppercase"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !rollNo.trim()}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow-md shadow-brand-600/30 flex items-center gap-1.5 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Adding & Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Enroll Member</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
