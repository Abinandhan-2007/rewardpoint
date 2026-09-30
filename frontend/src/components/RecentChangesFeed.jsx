import React from 'react';
import { History, Sparkles, TrendingUp, Clock, ArrowRight } from 'lucide-react';

export default function RecentChangesFeed({ changes = [], onSelectMember }) {
  if (!changes || changes.length === 0) {
    return (
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md dark:shadow-xl text-center">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider justify-center">
          <History className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
          <span>Recent Changes Feed</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
          No point or mark changes detected yet. Updates appear here in real-time.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md dark:shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
              Live Changes Feed
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Instant alerts pushed via Server-Sent Events
            </p>
          </div>
        </div>
        <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold px-2 py-0.5 rounded-full bg-brand-500/10 border border-brand-500/20">
          {changes.length} events
        </span>
      </div>

      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {changes.slice(0, 15).map((ch, idx) => (
          <div
            key={ch.id || idx}
            onClick={() => onSelectMember && onSelectMember(ch.member_id)}
            className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 hover:border-brand-500/40 transition-all cursor-pointer group text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                  {ch.member_name}
                </span>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 px-1.5 py-0.2 rounded bg-slate-200/60 dark:bg-slate-900">
                  {ch.roll_no}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(ch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <p className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">
              {ch.description}
            </p>

            {ch.old_value && ch.new_value && (
              <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                <span className="text-rose-600 dark:text-rose-400 line-through">
                  {ch.old_value}
                </span>
                <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-600" />
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {ch.new_value}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
