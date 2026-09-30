import React, { useState, useEffect } from 'react';
import { 
  Award, 
  BookOpen, 
  TrendingUp, 
  Users, 
  Clock, 
  RotateCw, 
  Calendar, 
  Sparkles, 
  Trophy, 
  Medal,
  ChevronRight,
  ShieldCheck,
  Building2,
  User as UserIcon,
  Layers,
  Activity
} from 'lucide-react';
import { api } from '../services/api';

export default function MemberDashboard({ currentUser, currentTeam }) {
  const [selfData, setSelfData] = useState(null);
  const [teamSummary, setTeamSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'subjects' | 'activities' | 'history'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [selfRes, summaryRes] = await Promise.all([
        api.getMemberSelfDetails(),
        api.getTeamSummary()
      ]);
      setSelfData(selfRes);
      setTeamSummary(summaryRes);
    } catch (err) {
      console.error('Error loading member dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const current = selfData?.current;
  const semesterProgression = selfData?.semester_progression;
  const semesterTimeline = semesterProgression?.timeline || [];
  const changeLogs = selfData?.change_logs || [];

  // SVG Chart Dimensions
  const width = 740;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 35;
  const paddingBottom = 40;

  const pointsList = semesterTimeline.map(t => Number(t.cumulative_points) || 0);
  const minVal = 0;
  const maxVal = Math.max(...pointsList, 100) * 1.08;
  const range = (maxVal - minVal) || 1;

  const coords = semesterTimeline.map((item, i) => {
    const x = semesterTimeline.length > 1
      ? paddingLeft + (i / (semesterTimeline.length - 1)) * (width - paddingLeft - paddingRight)
      : width / 2;
    const y = height - paddingBottom - ((item.cumulative_points - minVal) / range) * (height - paddingTop - paddingBottom);
    return { x, y, item, i };
  });

  const pathD = coords.reduce(
    (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
    ''
  );
  const areaD = coords.length > 0
    ? `${pathD} L ${coords[coords.length - 1].x} ${height - paddingBottom} L ${coords[0].x} ${height - paddingBottom} Z`
    : '';

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-3" />
        <span className="text-xs">Loading your reward points and team standing...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Top Welcome & KPI Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-xs font-semibold uppercase tracking-wider backdrop-blur-xs">
                Student Member Portal
              </span>
              <span className="text-xs text-white/80 font-mono">
                {currentUser?.roll_no}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {currentUser?.name}!
            </h1>
            <p className="text-xs sm:text-sm text-white/80 mt-1 flex items-center gap-3 flex-wrap">
              {current?.department && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {current.department}
                </span>
              )}
              {current?.mentor_name && (
                <span className="flex items-center gap-1">
                  <UserIcon className="w-3.5 h-3.5" />
                  Mentor: {current.mentor_name}
                </span>
              )}
            </p>
          </div>

          {/* Quick Balance Hero Stat */}
          <div className="p-4 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-right min-w-[180px]">
            <span className="text-xs uppercase tracking-wider text-white/80 font-medium block">
              Balance Reward Points
            </span>
            <div className="text-3xl font-black font-mono mt-0.5">
              {(Number(current?.balance_points) || 0).toFixed(2)}
            </div>
            <span className="text-[11px] text-emerald-300 font-semibold block mt-0.5">
              Active & Available
            </span>
          </div>
        </div>
      </div>

      {/* Grid: 4 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">Balance Points</span>
          <div className="text-2xl font-bold text-brand-600 dark:text-brand-400 font-mono mt-1">
            {(current?.balance_points || 0).toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">Available to redeem</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">Cumulative Points</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-1">
            {(current?.cumulative_points || 0).toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">Total earned this sem</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">Redeemed for IP</span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-1">
            {(current?.redeemed_points || 0).toFixed(2)}
          </div>
          <span className="text-[10px] text-slate-400">Applied to internal marks</span>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 dark:text-slate-400 block">Total IP Marks</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            {(current?.total_marks || 0).toFixed(2)}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-500/80">From {current?.total_subjects || 0} subjects</span>
        </div>
      </div>

      {/* Main Grid: My Details & Semester Graph (Left 2 cols) + Team Summary & Leaderboard (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Semester Graph & Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  <span>My Whole Semester Points Progression</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Chronological progression across milestones and activities
                </p>
              </div>

              <div className="flex items-center gap-1">
                {[
                  { id: 'chart', label: 'Graph' },
                  { id: 'subjects', label: `IP Subjects (${current?.subjects?.length || 0})` },
                  { id: 'activities', label: `Activities (${current?.activities?.length || 0})` },
                  { id: 'history', label: `History (${changeLogs.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      activeTab === t.id
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB 1: SEMESTER GRAPH */}
            {activeTab === 'chart' && (
              <div className="space-y-4">
                {/* Semester Summary Mini-Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Carry-Over</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                      {(semesterProgression?.initial_points || 0).toFixed(0)} pts
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Earned this Sem</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      +{(semesterProgression?.semester_earned || 0).toFixed(0)} pts
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Redeemed for IP</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-sm">
                      -{(semesterProgression?.redeemed_points || 0).toFixed(0)} pts
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Current Balance</span>
                    <span className="font-bold text-brand-600 dark:text-brand-400 font-mono text-sm">
                      {(semesterProgression?.current_balance || 0).toFixed(0)} pts
                    </span>
                  </div>
                </div>

                {/* SVG Curve */}
                {semesterTimeline.length > 0 ? (
                  <div className="w-full overflow-x-auto relative bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[580px] h-52 overflow-visible">
                      <defs>
                        <linearGradient id="memberSemGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                          <stop offset="60%" stopColor="#818cf8" stopOpacity="0.12" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid lines */}
                      {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
                        const yVal = height - paddingBottom - pct * (height - paddingTop - paddingBottom);
                        const labelVal = Math.round(minVal + pct * range);
                        return (
                          <g key={idx}>
                            <line
                              x1={paddingLeft}
                              y1={yVal}
                              x2={width - paddingRight}
                              y2={yVal}
                              stroke="#94a3b8"
                              strokeDasharray="4 4"
                              opacity="0.25"
                            />
                            <text
                              x={paddingLeft - 8}
                              y={yVal + 3}
                              textAnchor="end"
                              fill="#94a3b8"
                              fontSize="9"
                              fontFamily="monospace"
                            >
                              {labelVal}
                            </text>
                          </g>
                        );
                      })}

                      <line
                        x1={paddingLeft}
                        y1={height - paddingBottom}
                        x2={width - paddingRight}
                        y2={height - paddingBottom}
                        stroke="#94a3b8"
                        opacity="0.4"
                      />

                      {/* Area Fill */}
                      <path d={areaD} fill="url(#memberSemGrad)" />

                      {/* Main Progression Line */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#6366f1"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Points */}
                      {coords.map((p, i) => {
                        const isSelected = hoveredPoint?.step === p.item.step;
                        const isFirst = i === 0;
                        const isLast = i === coords.length - 1;

                        return (
                          <g
                            key={i}
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredPoint(p.item)}
                            onClick={() => setHoveredPoint(p.item)}
                          >
                            {isSelected && (
                              <line
                                x1={p.x}
                                y1={paddingTop - 10}
                                x2={p.x}
                                y2={height - paddingBottom}
                                stroke="#818cf8"
                                strokeWidth="1.5"
                                strokeDasharray="3 3"
                              />
                            )}

                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isSelected ? 7 : 5}
                              fill={isLast ? '#10b981' : isFirst ? '#f59e0b' : '#6366f1'}
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="transition-all"
                            />

                            {(isFirst || isLast || isSelected || i % 2 === 0) && (
                              <text
                                x={p.x}
                                y={p.y - 9}
                                textAnchor="middle"
                                fill="#475569"
                                className="dark:fill-slate-200 select-none text-[10px] font-bold font-mono"
                              >
                                {Math.round(p.item.cumulative_points)}
                              </text>
                            )}

                            <text
                              x={p.x}
                              y={height - paddingBottom + 16}
                              textAnchor="middle"
                              fill="#64748b"
                              className="dark:fill-slate-400 select-none text-[9px] font-medium"
                            >
                              {p.item.date_str}
                            </text>
                          </g>
                        );
                      })}
                    </svg>

                    {hoveredPoint && (
                      <div className="mt-2 p-3 rounded-xl bg-white dark:bg-slate-800 border border-brand-200 dark:border-brand-500/40 shadow-md text-xs flex items-center justify-between gap-4 animate-fade-in">
                        <div>
                          <span className="px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-semibold text-[10px] uppercase">
                            {hoveredPoint.type}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white ml-2">
                            {hoveredPoint.short_title || hoveredPoint.label}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {hoveredPoint.description}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 block font-mono">Cumulative Total</span>
                          <span className="font-bold text-sm text-brand-600 dark:text-brand-400 font-mono">
                            {hoveredPoint.cumulative_points.toFixed(0)} pts
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                    No semester activity milestones found in your record.
                  </div>
                )}

                {/* Milestone list */}
                {semesterTimeline.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {semesterTimeline.map((item, idx) => (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredPoint(item)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors ${
                          hoveredPoint?.step === item.step
                            ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-500/50'
                            : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 text-[10px] w-12 shrink-0">
                            {item.date_str}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          {item.points_added > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[11px]">
                              +{item.points_added} pts
                            </span>
                          )}
                          <span className="font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-[11px]">
                            {item.cumulative_points.toFixed(0)} pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: IP SUBJECTS */}
            {activeTab === 'subjects' && (
              <div className="space-y-3">
                {current?.subjects?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {current.subjects.map((sub, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                            {sub.code}
                          </span>
                          <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                            sub.type === 'theory' 
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                          }`}>
                            {sub.type}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Reward Points</span>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {sub.total_points} pts
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Internal Marks</span>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400">
                              {sub.total_marks} marks
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                    No registered IP subjects found.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ACTIVITIES */}
            {activeTab === 'activities' && (
              <div className="space-y-2">
                {current?.activities?.length > 0 ? (
                  current.activities.map((act, i) => (
                    <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-brand-600 dark:text-brand-400 mr-2">
                          {act.type}:
                        </span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {act.description}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-900 font-mono ml-2 shrink-0">
                        +{act.points} pts
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                    No activity logs recorded.
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CHANGE HISTORY */}
            {activeTab === 'history' && (
              <div className="space-y-2">
                {changeLogs.length > 0 ? (
                  changeLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-xs">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span className="font-mono font-semibold text-brand-600 dark:text-brand-400">
                          {log.field_name}
                        </span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {log.description}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                    No changes detected yet for your account.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Team Summary Card & Top Performers Leaderboard */}
        <div className="lg:col-span-1 space-y-6">
          {/* Team Summary Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Team Summary
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/20">
                {teamSummary?.team_id || currentTeam?.team_id}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">Total Members</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                  {teamSummary?.total_members || 0}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">Total Points</span>
                <span className="text-xl font-bold text-brand-600 dark:text-brand-400 font-mono mt-0.5 block">
                  {(teamSummary?.total_points || 0).toFixed(0)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">Avg Points / Mem</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                  {(teamSummary?.avg_points || 0).toFixed(1)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block text-[11px]">Avg IP Marks</span>
                <span className="text-xl font-bold text-purple-600 dark:text-purple-400 font-mono mt-0.5 block">
                  {(teamSummary?.avg_marks || 0).toFixed(1)}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
              <span>Last Sync Time:</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">
                {teamSummary?.last_sync ? new Date(teamSummary.last_sync).toLocaleTimeString() : 'Recently'}
              </span>
            </div>
          </div>

          {/* Top Performers Leaderboard Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Trophy className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Team Leaderboard
                </h3>
                <p className="text-[11px] text-slate-400">
                  Top performers ranked by reward points
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {teamSummary?.leaderboard && teamSummary.leaderboard.length > 0 ? (
                teamSummary.leaderboard.map((item) => (
                  <div
                    key={item.rank}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                      item.is_current_user
                        ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-500/50 shadow-xs ring-1 ring-brand-500/30'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
                        item.rank === 1
                          ? 'bg-amber-500 text-white shadow-xs shadow-amber-500/30'
                          : item.rank === 2
                            ? 'bg-slate-300 text-slate-800 dark:bg-slate-700 dark:text-white'
                            : item.rank === 3
                              ? 'bg-amber-700/60 text-white'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {item.rank}
                      </span>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.name}
                          </span>
                          {item.is_current_user && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-brand-600 text-white uppercase tracking-wider">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="font-mono font-bold text-slate-900 dark:text-white px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      {item.points.toFixed(0)} pts
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Leaderboard will populate as points sync.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
