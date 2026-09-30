import React from 'react';
import { Users, Award, TrendingUp, BookOpen, Clock } from 'lucide-react';

export default function StatsCards({ members = [], changes = [] }) {
  const totalMembers = members.length;
  
  const totalBalancePoints = members.reduce(
    (sum, m) => sum + (Number(m.balance_points) || 0), 
    0
  );

  const avgPoints = totalMembers > 0 
    ? (totalBalancePoints / totalMembers).toFixed(1) 
    : '0.0';

  const totalMarks = members.reduce(
    (sum, m) => sum + (Number(m.total_marks) || 0), 
    0
  );

  const recentChangesCount = members.filter(m => m.has_recent_change).length;

  const cards = [
    {
      label: 'Team Members',
      value: totalMembers,
      sublabel: 'Active tracked students',
      icon: Users,
      gradient: 'from-blue-500/15 to-cyan-500/15',
      border: 'border-blue-200 dark:border-blue-500/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Total Reward Points',
      value: totalBalancePoints.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      sublabel: 'Combined balance points',
      icon: Award,
      gradient: 'from-brand-500/15 to-purple-500/15',
      border: 'border-brand-200 dark:border-brand-500/30',
      iconColor: 'text-brand-600 dark:text-brand-400',
    },
    {
      label: 'Avg Points / Member',
      value: avgPoints,
      sublabel: 'Across team roster',
      icon: TrendingUp,
      gradient: 'from-emerald-500/15 to-teal-500/15',
      border: 'border-emerald-200 dark:border-emerald-500/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Total IP Marks',
      value: totalMarks.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      sublabel: 'Innovative Practice sum',
      icon: BookOpen,
      gradient: 'from-amber-500/15 to-yellow-500/15',
      border: 'border-amber-200 dark:border-amber-500/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Recent Updates (24h)',
      value: recentChangesCount,
      sublabel: 'Members with live diffs',
      icon: Clock,
      gradient: 'from-rose-500/15 to-pink-500/15',
      border: 'border-rose-200 dark:border-rose-500/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
      highlight: recentChangesCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-4 rounded-2xl border ${card.border} bg-white dark:bg-slate-900 shadow-md dark:shadow-xl relative overflow-hidden transition-all duration-300 hover:scale-[1.02]`}
          >
            <div className={`absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br ${card.gradient} blur-xl pointer-events-none`} />
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">
                {card.label}
              </span>
              <div className={`p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 ${card.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {card.value}
              </span>
              {card.highlight && (
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              )}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
              {card.sublabel}
            </p>
          </div>
        );
      })}
    </div>
  );
}
