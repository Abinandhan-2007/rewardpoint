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
  Clock, 
  Loader2,
  Key,
  Shield,
  AlertTriangle,
  Copy,
  Check
} from 'lucide-react';

export default function MembersTable({
  members = [],
  currentTeam,
  onSelectMember,
  onOpenAddModal,
  onRefreshMember,
  onDeleteMember,
  onResetPassword,
  refreshingMemberId,
  currentUserId
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('balance_points');
  const [sortDirection, setSortDirection] = useState('desc');
  const [memberToDelete, setMemberToDelete] = useState(null);
  const [copiedMemberId, setCopiedMemberId] = useState(null);

  const handleCopyLoginInfo = (m) => {
    const text = `Team Reward Tracker Login:\nTeam ID: ${currentTeam?.team_id || ''}\nRoll Number: ${m.roll_no}\n(No password needed)\nLogin URL: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    setCopiedMemberId(m.id);
    setTimeout(() => setCopiedMemberId(null), 2000);
  };

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
          (m.name && m.name.toLowerCase().includes(query)) || 
          (m.roll_no && m.roll_no.toLowerCase().includes(query)) ||
          (m.department && m.department.toLowerCase().includes(query));

        if (!matchesQuery) return false;

        if (filterType === 'high_points') {
          return (Number(m.balance_points) || 0) >= 300;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'balance_points' || sortField === 'total_marks') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else if (sortField === 'name') {
          valA = (valA || '').toLowerCase();
          valB = (valB || '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [members, searchQuery, sortField, sortDirection, filterType]);

  const formatRelativeTime = (isoString) => {
    if (!isoString) return 'Pending sync';
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch (_) {
      return 'Recently';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden transition-colors">
      {/* Table Controls Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3.5 bg-slate-50/70 dark:bg-slate-900/60">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, roll number, or dept..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all shadow-xs"
          />
        </div>

        {/* Filter Pills & Add Button */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-brand-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All ({members.length})
            </button>
            <button
              onClick={() => setFilterType('high_points')}
              className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filterType === 'high_points'
                  ? 'bg-brand-600 text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              High Points (300+)
            </button>
          </div>

          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium text-xs shadow-md shadow-brand-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-800/40 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <th 
                onClick={() => handleSort('name')}
                className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span>Member / Student</span>
                  {sortField === 'name' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>
              </th>

              <th className="py-3 px-4">
                <span>Roll Number</span>
              </th>

              <th 
                onClick={() => handleSort('balance_points')}
                className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Reward Points</span>
                  {sortField === 'balance_points' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>
              </th>

              <th className="py-3 px-4 hidden md:table-cell">
                <span>Cumul. / Redeemed</span>
              </th>

              <th 
                onClick={() => handleSort('total_marks')}
                className="py-3 px-4 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                  <span>IP Marks</span>
                  {sortField === 'total_marks' ? (
                    sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-brand-500" /> : <ArrowDown className="w-3 h-3 text-brand-500" />
                  ) : (
                    <ArrowUpDown className="w-3 h-3 opacity-40" />
                  )}
                </div>
              </th>

              <th className="py-3 px-4 hidden lg:table-cell">
                <span>Last Sync</span>
              </th>

              <th className="py-3 px-4 text-right">
                <span>Actions</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
            {filteredAndSortedMembers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <p className="text-sm">No members found matching your search.</p>
                </td>
              </tr>
            ) : (
              filteredAndSortedMembers.map((m) => {
                const isFetching = m.fetch_status === 'fetching' || refreshingMemberId === m.id;
                const isCaptain = m.role === 'captain';

                return (
                  <tr 
                    key={m.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    {/* Member Name & Details */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ${
                          isCaptain 
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                            : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20'
                        }`}>
                          {m.name ? m.name.charAt(0).toUpperCase() : 'S'}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white text-sm">
                              {m.name || m.roll_no}
                            </span>
                            {isCaptain && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase">
                                Captain
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {m.department || (isFetching ? 'Fetching department...' : 'Department Pending')}
                          </p>
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
                          <span>Fetching (~3s)...</span>
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
                          title="Instant refresh from Gradio"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <RotateCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-brand-600' : ''}`} />
                        </button>

                        {/* Copy Member Login Details */}
                        {!isCaptain && (
                          <button
                            onClick={() => handleCopyLoginInfo(m)}
                            title="Copy student login details (Team ID + Roll No)"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors cursor-pointer"
                          >
                            {copiedMemberId === m.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {/* Open Details Modal */}
                        <button
                          onClick={() => onSelectMember(m.id)}
                          title="View semester graph and full details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete member (not allowed for captain self) */}
                        {!isCaptain && (
                          <button
                            onClick={() => setMemberToDelete(m)}
                            title="Remove member from team"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Dialog Modal for Member Deletion */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/85 backdrop-blur-sm animate-fade-in text-slate-800 dark:text-slate-100">
          <div className="w-full max-w-sm rounded-2xl p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Remove Member?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              Are you sure you want to remove <strong>{memberToDelete.name}</strong> ({memberToDelete.roll_no})? All their stored reward points, marks, and history will be permanently deleted from the team tracker.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMemberToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteMember(memberToDelete.id);
                  setMemberToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md shadow-rose-600/30 cursor-pointer"
              >
                Yes, Remove Member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
