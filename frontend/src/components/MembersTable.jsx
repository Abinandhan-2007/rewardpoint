import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  UserPlus, 
  ExternalLink, 
  RotateCw, 
  Trash2, 
  Award, 
  BookOpen, 
  Sparkles,
  TrendingUp,
  AlertCircle,
  Clock,
  Loader2
} from 'lucide-react';

export default function MembersTable({
  members = [],
  onSelectMember,
  onOpenAddModal,
  onRefreshMember,
  onDeleteMember,
  refreshingMemberId
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('balance_points'); // 'balance_points' | 'total_marks' | 'name' | 'last_updated'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'
  const [filterType, setFilterType] = useState('all'); // 'all' | 'recent_change' | 'high_points'

  // Handle Sort Toggle
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and Sort members
  const filteredAndSortedMembers = useMemo(() => {
    return members
      .filter((m) => {
        const query = searchQuery.toLowerCase().trim();
        const matchesQuery = 
          !query || 
          m.name.toLowerCase().includes(query) || 
          m.roll_no.toLowerCase().includes(query) ||
          (m.department && m.department.toLowerCase().includes(query));

        if (!matchesQuery) return false;

        if (filterType === 'recent_change') {
          return m.has_recent_change;
        }
        if (filterType === 'high_points') {
          return (m.balance_points || 0) >= 300;
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'name') {
          valA = (valA || '').toLowerCase();
          valB = (valB || '').toLowerCase();
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        }

        if (sortField === 'last_updated') {
          valA = new Date(valA || 0).getTime();
          valB = new Date(valB || 0).getTime();
        } else {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        }

        return sortDirection === 'asc' ? valA - valB : valB - valA;
      });
  }, [members, searchQuery, sortField, sortDirection, filterType]);

  const formatRelativeTime = (isoStr) => {
    if (!isoStr) return 'Never';
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return new Date(isoStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch (_) {
      return 'Recently';
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 font-bold" />
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-lg dark:shadow-2xl transition-colors duration-200">
      {/* Top Filter and Search Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, roll number, or dept..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all"
          />
        </div>

        {/* Filter Pills & Add Member */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All ({members.length})
            </button>
            <button
              onClick={() => setFilterType('recent_change')}
              className={`px-3 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                filterType === 'recent_change'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              <span>Updated</span>
            </button>
            <button
              onClick={() => setFilterType('high_points')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                filterType === 'high_points'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              High Points (300+)
            </button>
          </div>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th 
                onClick={() => handleSort('name')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Member / Student</span>
                  {getSortIcon('name')}
                </div>
              </th>
              <th className="py-3 px-4">Roll Number</th>
              <th 
                onClick={() => handleSort('balance_points')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Reward Points</span>
                  {getSortIcon('balance_points')}
                </div>
              </th>
              <th className="py-3 px-4 hidden md:table-cell">
                Cumul. / Redeemed
              </th>
              <th 
                onClick={() => handleSort('total_marks')}
                className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                  <span>IP Marks</span>
                  {getSortIcon('total_marks')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('last_updated')}
                className="py-3 px-4 hidden lg:table-cell cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition-colors select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Last Sync</span>
                  {getSortIcon('last_updated')}
                </div>
              </th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-xs">
            {filteredAndSortedMembers.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <p className="text-sm font-medium">No team members match the search.</p>
                  <p className="text-xs text-slate-500 dark:text-slate-600 mt-1">Click "Add Member" to enroll students.</p>
                </td>
              </tr>
            ) : (
              filteredAndSortedMembers.map((m, idx) => {
                const isRankOne = idx === 0 && sortField === 'balance_points' && sortDirection === 'desc';
                const hasRecentUpdate = m.has_recent_change;
                const isFetching = m.fetch_status === 'fetching' || m.fetch_status === 'pending' || refreshingMemberId === m.id;

                return (
                  <tr
                    key={m.id}
                    className={`transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 group ${
                      hasRecentUpdate ? 'animate-row-update bg-emerald-50/60 dark:bg-emerald-950/20' : ''
                    } ${isFetching ? 'bg-indigo-50/40 dark:bg-indigo-950/15' : ''}`}
                  >
                    {/* Rank / Index */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-400 dark:text-slate-500">
                      {isRankOne ? (
                        <span className="inline-flex p-1 rounded-md bg-amber-500/20 text-amber-500 dark:text-amber-300 font-bold" title="Top Points">
                          👑
                        </span>
                      ) : (
                        idx + 1
                      )}
                    </td>

                    {/* Member Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div 
                          onClick={() => onSelectMember(m.id)}
                          className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer group-hover:scale-105 group-hover:ring-2 group-hover:ring-brand-500/50 transition-all"
                        >
                          {m.name ? m.name.charAt(0) : 'S'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => onSelectMember(m.id)}
                              className="font-bold text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400 text-left transition-colors cursor-pointer"
                            >
                              {m.name || m.roll_no}
                            </button>

                            {/* Fetching live indicator */}
                            {isFetching && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin text-indigo-600 dark:text-indigo-400" />
                                <span>Fetching from Gradio (~3s)...</span>
                              </span>
                            )}

                            {/* Recent Change Badge */}
                            {!isFetching && hasRecentUpdate && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Updated
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            {m.department && <span>{m.department}</span>}
                            {m.mentor_name && <span>• Mentor: {m.mentor_name}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Roll Number */}
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-600 dark:text-slate-300 text-[11px]">
                      {m.roll_no}
                    </td>

                    {/* Balance Points Badge */}
                    <td className="py-3.5 px-4">
                      {isFetching ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                          <Loader2 className="w-3 h-3 animate-spin text-brand-500" />
                          <span>Fetching...</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-200 dark:border-brand-500/25 text-brand-700 dark:text-brand-300">
                          <span className="font-mono font-bold text-sm">
                            {(Number(m.balance_points) || 0).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-brand-600 dark:text-brand-400/80">pts</span>
                        </div>
                      )}
                    </td>

                    {/* Cumulative & Redeemed */}
                    <td className="py-3.5 px-4 hidden md:table-cell font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {isFetching ? (
                        <span className="text-slate-400 text-[10px]">Syncing...</span>
                      ) : (
                        <div>
                          <span>Cumul: {(Number(m.cumulative_points) || 0).toFixed(0)}</span>
                          <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
                          <span className="text-amber-600 dark:text-amber-400/90">Red: {(Number(m.redeemed_points) || 0).toFixed(0)}</span>
                        </div>
                      )}
                    </td>

                    {/* Marks & Subjects */}
                    <td className="py-3.5 px-4">
                      {isFetching ? (
                        <span className="text-slate-400 text-[10px] animate-pulse">Querying IP marks...</span>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            {(Number(m.total_marks) || 0).toFixed(2)} marks
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {m.total_subjects || 0} subjects
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Last Sync Time */}
                    <td className="py-3.5 px-4 hidden lg:table-cell text-slate-500 dark:text-slate-400 text-[11px]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                        {isFetching ? 'In progress' : formatRelativeTime(m.last_updated)}
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Instant single fetch */}
                        <button
                          onClick={() => onRefreshMember(m.id)}
                          disabled={isFetching}
                          title="Instant refresh for this member"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-600 dark:text-brand-400' : ''}`} />
                        </button>

                        {/* Open Details */}
                        <button
                          onClick={() => onSelectMember(m.id)}
                          title="View member details and history"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete member */}
                        <button
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to remove ${m.name || m.roll_no} from the team tracker?`)) {
                              onDeleteMember(m.id);
                            }
                          }}
                          title="Remove member"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
