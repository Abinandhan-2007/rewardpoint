import React, { useState, useEffect } from 'react';
import { 
  X, 
  RotateCw, 
  Calendar, 
  Award, 
  BookOpen, 
  TrendingUp, 
  History, 
  User,
  Building2,
  Clock
} from 'lucide-react';
import { api } from '../services/api';

export default function MemberDetailModal({ memberId, isOpen, onClose, onRefreshMember }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'subjects' | 'activities' | 'history'
  const [chartMode, setChartMode] = useState('semester'); // 'semester' | 'sync'
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [isFetchingSingle, setIsFetchingSingle] = useState(false);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const res = await api.getMemberHistory(memberId);
      setData(res);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && memberId) {
      loadHistory();
    }
  }, [isOpen, memberId]);

  const handleInstantFetch = async () => {
    setIsFetchingSingle(true);
    try {
      await api.fetchSingleMember(memberId);
      await loadHistory();
      if (onRefreshMember) onRefreshMember();
    } catch (err) {
      alert(`Fetch failed: ${err.message}`);
    } finally {
      setIsFetchingSingle(false);
    }
  };

  if (!isOpen) return null;

  const member = data?.member;
  const current = data?.current;
  const chartData = data?.chart_data || [];
  const changeLogs = data?.change_logs || [];
  const semesterProgression = data?.semester_progression;
  const semesterTimeline = semesterProgression?.timeline || [];

  // -------------------------------------------------------------
  // 1. RENDER WHOLE SEMESTER GRAPH
  // -------------------------------------------------------------
  const renderSemesterChart = () => {
    if (!semesterTimeline || semesterTimeline.length === 0) {
      return (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/30">
          <TrendingUp className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
          <span>No semester activity milestones found in the student record.</span>
        </div>
      );
    }

    const width = 760;
    const height = 230;
    const paddingLeft = 45;
    const paddingRight = 45;
    const paddingTop = 40;
    const paddingBottom = 45;

    // Use cumulative points for the growth progression curve
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

    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - paddingBottom} L ${coords[0].x} ${height - paddingBottom} Z`;

    return (
      <div className="space-y-4">
        {/* Semester Overview Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 text-xs">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Initial Carry-Over</span>
            <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
              {(Number(semesterProgression?.initial_points) || 0).toFixed(0)} pts
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Earned this Semester</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
              +{(Number(semesterProgression?.semester_earned) || 0).toFixed(0)} pts
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Redeemed for IP</span>
            <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-sm">
              -{(Number(semesterProgression?.redeemed_points) || 0).toFixed(0)} pts
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Current Balance</span>
            <span className="font-bold text-brand-600 dark:text-brand-400 font-mono text-sm">
              {(Number(semesterProgression?.current_balance) || 0).toFixed(0)} pts
            </span>
          </div>
        </div>

        {/* The SVG Line Graph */}
        <div className="w-full overflow-x-auto relative bg-slate-50/80 dark:bg-slate-900/60 p-2 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[620px] h-56 overflow-visible">
            <defs>
              <linearGradient id="semGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#818cf8" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
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

            {/* Base axis line */}
            <line
              x1={paddingLeft}
              y1={height - paddingBottom}
              x2={width - paddingRight}
              y2={height - paddingBottom}
              stroke="#94a3b8"
              opacity="0.4"
            />

            {/* Area fill under curve */}
            <path d={areaD} fill="url(#semGradient)" />

            {/* Main Progression Line */}
            <path
              d={pathD}
              fill="none"
              stroke="#6366f1"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-sm"
            />

            {/* Data points & X-axis date labels */}
            {coords.map((p, i) => {
              const isSelected = hoveredPoint?.step === p.item.step;
              const isFirst = i === 0;
              const isLast = i === coords.length - 1;

              return (
                <g 
                  key={i} 
                  className="cursor-pointer group"
                  onMouseEnter={() => setHoveredPoint(p.item)}
                  onClick={() => setHoveredPoint(p.item)}
                >
                  {/* Vertical guide line on hover */}
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

                  {/* Outer glow ring on point */}
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 7 : 5}
                    fill={isLast ? '#10b981' : isFirst ? '#f59e0b' : '#6366f1'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="transition-all duration-150"
                  />

                  {/* Top Point Value Label */}
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

                  {/* Bottom X-Axis Date Label */}
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

          {/* Interactive Tooltip Callout on Point Hover */}
          {hoveredPoint && (
            <div className="mt-2 p-3 rounded-xl bg-white dark:bg-slate-800 border border-brand-200 dark:border-brand-500/40 shadow-lg text-xs flex items-center justify-between gap-4 animate-fade-in">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-semibold text-[10px] uppercase">
                    {hoveredPoint.type}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {hoveredPoint.short_title || hoveredPoint.label}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {hoveredPoint.description}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 block font-mono">Cumulative Total</span>
                <span className="font-bold text-sm text-brand-600 dark:text-brand-400 font-mono">
                  {(Number(hoveredPoint?.cumulative_points) || 0).toFixed(0)} pts
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Chronological Semester Activity Timeline */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
              Chronological Semester Milestones ({semesterTimeline.length} events)
            </h4>
            <span className="text-[11px] text-slate-500">From semester start to date</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {semesterTimeline.map((item, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoveredPoint(item)}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                  hoveredPoint?.step === item.step
                    ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-500/50'
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-slate-400 text-[10px] w-12 shrink-0">
                    {item.date_str}
                  </span>
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {item.label}
                    </span>
                    {item.full_description && item.full_description !== item.label && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-md">
                        {item.full_description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.points_added > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[11px]">
                      +{item.points_added} pts
                    </span>
                  )}
                  <span className="font-mono font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-[11px]">
                    {(Number(item?.cumulative_points) || 0).toFixed(0)} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // 2. RENDER LIVE SYNC SNAPSHOTS GRAPH
  // -------------------------------------------------------------
  const renderSyncChart = () => {
    if (!chartData || chartData.length < 2) {
      return (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/30">
          <TrendingUp className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
          <span>Tracking started. Live snapshots will appear as multiple polls are recorded.</span>
        </div>
      );
    }

    const width = 600;
    const height = 180;
    const padding = 35;

    const pointsList = chartData.map(d => d.balance_points || 0);
    const minVal = Math.min(...pointsList, 0);
    const maxVal = Math.max(...pointsList, 100);
    const range = (maxVal - minVal) || 1;

    const points = chartData.map((d, i) => {
      const x = padding + (i / (chartData.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d.balance_points - minVal) / range) * (height - 2 * padding);
      return { x, y, val: d.balance_points, time: d.timestamp };
    });

    const pathD = points.reduce(
      (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
      ''
    );

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <div className="w-full overflow-x-auto bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#94a3b8" strokeDasharray="3 3" opacity="0.3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#94a3b8" strokeDasharray="3 3" opacity="0.3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#94a3b8" opacity="0.5" />

          <path d={areaD} fill="url(#chartGradient)" />
          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="1.5" />
              <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#475569" className="dark:fill-slate-300 select-none text-[10px] font-semibold">
                {p.val}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 dark:bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 shadow-2xl relative overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50 dark:bg-slate-900/90 relative">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-brand-500/25">
              {member?.name ? member.name.charAt(0) : 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {member?.name || 'Student Details'}
                </h2>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-brand-500/10 text-brand-700 dark:text-brand-300 border border-brand-500/30">
                  {member?.roll_no}
                </span>
                {current?.year && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                    Year {current.year}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                {current?.department && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    {current.department}
                  </span>
                )}
                {current?.mentor_name && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    Mentor: {current.mentor_name}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInstantFetch}
              disabled={isFetchingSingle}
              title="Force re-fetch from Gradio Space"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${isFetchingSingle ? 'animate-spin text-brand-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 text-xs overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Semester Graph', icon: TrendingUp },
            { id: 'subjects', label: `IP Subjects (${current?.subjects?.length || 0})`, icon: BookOpen },
            { id: 'activities', label: `Activities (${current?.activities?.length || 0})`, icon: Award },
            { id: 'history', label: `Change History (${changeLogs.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400 font-semibold'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-3" />
              <span className="text-xs">Loading member data and history...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & SEMESTER GRAPH */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Stats Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Balance Points</span>
                      <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {(Number(current?.balance_points) || 0).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-brand-600 dark:text-brand-400 font-medium">Available to redeem</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Cumulative Points</span>
                      <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {(Number(current?.cumulative_points) || 0).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-slate-500">Total points earned</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Redeemed Points</span>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                        {(Number(current?.redeemed_points) || 0).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-slate-500">Already used for IP</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Internal Marks</span>
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        {(Number(current?.total_marks) || 0).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-500/80">From {current?.total_subjects || 0} subjects</span>
                    </div>
                  </div>

                  {/* Benchmark Alert */}
                  {current?.average_points && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/60 dark:to-purple-950/60 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                          Year {current.year} Benchmark
                        </span>
                        <p className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
                          Year Average: <span className="font-bold">{current.average_points} pts</span>
                          {current.points_needed ? (
                            <span className="text-rose-600 dark:text-rose-400 ml-2">({current.points_needed} pts needed to reach average)</span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 ml-2">🎉 Above Class Average!</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* THE FEATURED GRAPH CONTAINER */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md">
                    {/* Graph Controls Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                          <span>{chartMode === 'semester' ? 'Whole Semester Points Progression' : 'Live Sync Polling Snapshots'}</span>
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {chartMode === 'semester'
                            ? 'Milestones, activities, and rewards trajectory over the entire semester'
                            : 'Automated background synchronization snapshot history'}
                        </p>
                      </div>

                      {/* Mode Switch Pills */}
                      <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                        <button
                          type="button"
                          onClick={() => setChartMode('semester')}
                          className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                            chartMode === 'semester'
                              ? 'bg-brand-600 text-white shadow-xs font-semibold'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          📅 Whole Semester ({semesterTimeline.length} events)
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartMode('sync')}
                          className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                            chartMode === 'sync'
                              ? 'bg-brand-600 text-white shadow-xs font-semibold'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                          }`}
                        >
                          🔄 Live Polls ({chartData.length})
                        </button>
                      </div>
                    </div>

                    {/* Render active chart */}
                    {chartMode === 'semester' ? renderSemesterChart() : renderSyncChart()}
                  </div>
                </div>
              )}

              {/* TAB 2: IP SUBJECTS */}
              {activeTab === 'subjects' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Innovative Practice (IP) Registered Subjects
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Total Internal Marks: <strong className="text-emerald-600 dark:text-emerald-400">{(Number(current?.total_marks) || 0).toFixed(2)}</strong>
                    </span>
                  </div>

                  {current?.subjects?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {current.subjects.map((sub, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-mono font-bold text-base text-slate-900 dark:text-white">
                              {sub.code}
                            </span>
                            <span className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                              sub.type === 'theory' 
                                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20' 
                                : 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20'
                            }`}>
                              {sub.type}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Reward Points</span>
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                {(Number(sub.total_points || sub.redeemed_points) || 0).toFixed(2)} pts
                              </div>
                              <span className="text-[10px] text-slate-500">
                                IP1: {sub.ip1_points ?? '-'} | IP2: {sub.ip2_points ?? '-'}
                              </span>
                            </div>

                            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">Internal Marks</span>
                              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                {(Number(sub.total_marks || sub.marks) || 0).toFixed(2)} marks
                              </div>
                              <span className="text-[10px] text-slate-500">
                                IP1: {sub.ip1_marks ?? '-'} | IP2: {sub.ip2_marks ?? '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                      No IP subjects registered for this roll number or not available in cache.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: ACTIVITIES & BREAKDOWN */}
              {activeTab === 'activities' && (
                <div className="space-y-6">
                  {/* Category Breakdown Table */}
                  {current?.breakdown && Object.keys(current.breakdown).length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                        Category Breakdown
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {Object.entries(current.breakdown).map(([category, item], i) => (
                          <div key={i} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-300 text-[11px] block truncate">
                              {category}
                            </span>
                            <div className="flex items-center justify-between mt-1 text-slate-500 dark:text-slate-400 text-[11px]">
                              <span>Count: {item.count}</span>
                              <span className="font-bold text-slate-900 dark:text-white">{item.points} pts</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activity Items List */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                      Detailed Activity Records ({current?.activities?.length || 0})
                    </h4>
                    {current?.activities?.length > 0 ? (
                      <div className="space-y-2">
                        {current.activities.map((act, i) => (
                          <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-slate-400 text-[11px] w-5">
                                {act.index}.
                              </span>
                              <div>
                                <span className="font-semibold text-brand-700 dark:text-brand-300 mr-2">
                                  {act.type}:
                                </span>
                                <span className="text-slate-800 dark:text-slate-200">
                                  {act.description}
                                </span>
                              </div>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white px-2 py-0.5 rounded bg-slate-200/80 dark:bg-slate-900 font-mono shrink-0 ml-3">
                              +{act.points} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                        No activity items recorded for this student.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: CHANGE HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <History className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                      Recorded Change History Log
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Total events: {changeLogs.length}
                    </span>
                  </div>

                  {changeLogs.length > 0 ? (
                    <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                      {changeLogs.map((log) => (
                        <div key={log.id} className="relative group">
                          <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-brand-500 border-2 border-white dark:border-slate-900 group-hover:scale-125 transition-transform" />

                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 text-xs">
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                              <span className="font-mono font-medium text-brand-700 dark:text-brand-400">
                                {log.field_name}
                              </span>
                              <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                                <Clock className="w-3 h-3" />
                                {new Date(log.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                              {log.description}
                            </p>
                            {log.old_value && log.new_value && (
                              <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200 dark:border-transparent">
                                <span className="text-rose-600 dark:text-rose-400 line-through">Old: {log.old_value}</span>
                                <span>→</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">New: {log.new_value}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-10 text-center text-slate-500 text-xs border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                      <Clock className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
                      <span>No changes detected yet. The background job will log changes as points or marks update.</span>
                    </div>
                  )}
                </div>
              )}


            </>
          )}
        </div>
      </div>
    </div>
  );
}
