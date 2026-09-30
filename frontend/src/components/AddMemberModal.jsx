import React, { useState } from 'react';
import { X, UserPlus, Sparkles, AlertCircle, Check, Clock, Loader2 } from 'lucide-react';
import { api } from '../services/api';

const SAMPLE_STUDENTS = [
  { roll: '7376231CS101', name: 'AAMINA A' },
  { roll: '7376231CS102', name: 'AANANDHA KRISHNAN A P' },
  { roll: '7376231CS103', name: 'AATHIKESAVAN S' },
  { roll: '7376231CS104', name: 'ABINANDAN C' },
];

export default function AddMemberModal({ isOpen, onClose, onMemberAdded }) {
  const [rollNo, setRollNo] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
      const addedName = name.trim() || addedRoll;
      
      const res = await api.addMember({
        roll_no: addedRoll,
        name: addedName,
      });

      setRollNo('');
      setName('');
      if (onMemberAdded) {
        onMemberAdded({ roll_no: addedRoll, name: addedName });
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add member');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = (sample) => {
    setRollNo(sample.roll);
    setName(sample.name);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/85 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative text-slate-800 dark:text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
              Enter student roll number to start automatic tracking
            </p>
          </div>
        </div>

        {/* Informative Note about Gradio Fetch Time */}
        <div className="mb-4 p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-semibold block text-indigo-800 dark:text-indigo-300">
              ⚡ Real-Time External Gradio Sync:
            </span>
            Querying the live Gradio Space takes about <strong>3 to 5 seconds</strong>. Once added, the dashboard will immediately display a live fetching status and update automatically via Server-Sent Events!
          </div>
        </div>

        {/* Quick Sample Roll Numbers */}
        <div className="mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>Click to fill verified sample student:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_STUDENTS.map((s) => (
              <button
                key={s.roll}
                type="button"
                onClick={() => handleSelectSample(s)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition-all cursor-pointer ${
                  rollNo === s.roll
                    ? 'bg-brand-500/20 text-brand-700 dark:text-brand-300 border-brand-500/40 font-semibold'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {s.roll} ({s.name.split(' ')[0]})
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Roll Number <span className="text-rose-500 dark:text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value.toUpperCase())}
              placeholder="e.g. 7376231CS101"
              required
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Member Name <span className="text-slate-500 text-[11px]">(Optional, will auto-fetch from sheet)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AAMINA A"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
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
                  <span>Add Member</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
