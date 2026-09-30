import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { api, getAuthToken, setAuthToken } from './services/api';
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import MembersTable from './components/MembersTable';
import MemberDashboard from './components/MemberDashboard';
import MemberDetailModal from './components/MemberDetailModal';
import AddMemberModal from './components/AddMemberModal';
import ResetPasswordModal from './components/ResetPasswordModal';
import ChangePasswordModal from './components/ChangePasswordModal';
import LoginView from './components/LoginView';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentTeam, setCurrentTeam] = useState(null);

  // Captain state
  const [members, setMembers] = useState([]);
  const [changes, setChanges] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingMemberId, setRefreshingMemberId] = useState(null);

  // Modals
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memberToReset, setMemberToReset] = useState(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Active top toast/notification banner
  const [toastNotification, setToastNotification] = useState(null);

  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Auth check on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        setIsAuthenticated(false);
        setIsCheckingAuth(false);
        return;
      }
      try {
        const me = await api.getMe();
        setCurrentUser(me.user);
        setCurrentTeam(me.team);
        setIsAuthenticated(true);
      } catch (_) {
        setAuthToken(null);
        setCurrentUser(null);
        setCurrentTeam(null);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setCurrentTeam(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Load team data if captain
  const loadDashboardData = useCallback(async () => {
    if (!isAuthenticated || currentUser?.role !== 'captain') return;
    try {
      const [membersData, statusData] = await Promise.all([
        api.getTeamMembers(),
        api.getSyncStatus(),
      ]);
      setMembers(membersData);
      setSyncStatus(statusData);
    } catch (err) {
      console.error('Error loading team data:', err);
    }
  }, [isAuthenticated, currentUser]);

  useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'captain') {
      loadDashboardData();
    }
  }, [isAuthenticated, currentUser, loadDashboardData]);

  // Real-time SSE listener
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAuthToken();
    let eventSource = null;
    let reconnectTimeout = null;

    const connectSSE = () => {
      eventSource = new EventSource(`/api/events?token=${encodeURIComponent(token || '')}`);

      eventSource.addEventListener('connected', () => {
        console.log('SSE connected for team');
      });

      eventSource.addEventListener('member_updated', (event) => {
        try {
          const updated = JSON.parse(event.data);
          setMembers((prev) => {
            const exists = prev.some((m) => m.id === updated.id);
            if (!exists) {
              return [updated, ...prev];
            }
            return prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m));
          });

          if (updated.fetch_status === 'success') {
            setToastNotification({
              type: 'success',
              title: `Updated ${updated.name || updated.roll_no}!`,
              message: `Balance: ${updated.balance_points} pts | Total marks: ${updated.total_marks}`
            });
            setTimeout(() => setToastNotification(null), 5000);
          }
        } catch (err) {
          console.error('Error handling member_updated event:', err);
        }
      });

      eventSource.addEventListener('change_alert', (event) => {
        try {
          const changeItem = JSON.parse(event.data);
          setChanges((prev) => [changeItem, ...prev]);

          if (changeItem.field === 'balance_points' && Number(changeItem.new_value) > Number(changeItem.old_value)) {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.8 },
            });
          }
        } catch (err) {
          console.error('Error handling change_alert:', err);
        }
      });

      eventSource.addEventListener('sync_status', (event) => {
        try {
          const newStatus = JSON.parse(event.data);
          setSyncStatus((prev) => ({ ...(prev || {}), ...newStatus }));
        } catch (err) {
          console.error('Error handling sync_status:', err);
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        reconnectTimeout = setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [isAuthenticated]);

  const handleLoginSuccess = (loginResponse) => {
    if (loginResponse) {
      setCurrentUser(loginResponse.user);
      setCurrentTeam(loginResponse.team);
    }
    setIsAuthenticated(true);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await api.refreshTeamNow();
      setTimeout(async () => {
        const status = await api.getSyncStatus();
        setSyncStatus(status);
        setIsRefreshing(false);
      }, 1000);
    } catch (err) {
      alert(`Refresh failed: ${err.message}`);
      setIsRefreshing(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      await api.downloadTeamCsv(currentTeam?.team_id);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  const handleRefreshSingleMember = async (userId) => {
    setRefreshingMemberId(userId);
    try {
      await api.refreshTeamNow();
      await loadDashboardData();
    } catch (err) {
      alert(`Member fetch failed: ${err.message}`);
    } finally {
      setRefreshingMemberId(null);
    }
  };

  const handleDeleteMember = async (userId) => {
    try {
      await api.removeTeamMember(userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch (err) {
      alert(`Failed to remove member: ${err.message}`);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setCurrentTeam(null);
    setIsAuthenticated(false);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        currentTeam={currentTeam}
        syncStatus={syncStatus}
        isRefreshing={isRefreshing}
        onRefresh={handleManualRefresh}
        onExportCsv={handleExportCsv}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
      />

      {/* Toast Notification Banner */}
      {toastNotification && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-3.5 rounded-2xl border flex items-center justify-between shadow-sm animate-fade-in bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="font-bold mr-1.5">{toastNotification.title}</span>
                <span className="opacity-90">{toastNotification.message}</span>
              </div>
            </div>
            <button
              onClick={() => setToastNotification(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {currentUser?.role === 'captain' ? (
          /* CAPTAIN VIEW */
          <div className="space-y-6 animate-fade-in">
            <StatsCards members={members} changes={changes} />

            <div className="w-full">
              <MembersTable
                members={members}
                currentUserId={currentUser.id}
                onSelectMember={(id) => setSelectedMemberId(id)}
                onOpenAddModal={() => setIsAddModalOpen(true)}
                onRefreshMember={handleRefreshSingleMember}
                onDeleteMember={handleDeleteMember}
                onResetPassword={(m) => setMemberToReset(m)}
                refreshingMemberId={refreshingMemberId}
              />
            </div>
          </div>
        ) : (
          /* MEMBER VIEW */
          <MemberDashboard
            currentUser={currentUser}
            currentTeam={currentTeam}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <span>⚡ Team Reward Tracker • Team ID: <strong className="text-slate-700 dark:text-slate-300 font-mono">{currentTeam?.team_id}</strong></span>
        </div>
      </footer>

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onMemberAdded={() => loadDashboardData()}
        currentTeam={currentTeam}
      />

      <MemberDetailModal
        memberId={selectedMemberId}
        isOpen={!!selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        onRefreshMember={loadDashboardData}
      />

      <ResetPasswordModal
        isOpen={!!memberToReset}
        member={memberToReset}
        onClose={() => setMemberToReset(null)}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}
