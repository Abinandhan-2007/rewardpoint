import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Clock, X, Loader2, CheckCircle2 } from 'lucide-react';
import { api, getAuthToken, setAuthToken } from './services/api';
import Navbar from './components/Navbar';
import StatsCards from './components/StatsCards';
import MembersTable from './components/MembersTable';
import MemberDetailModal from './components/MemberDetailModal';
import AddMemberModal from './components/AddMemberModal';
import LoginView from './components/LoginView';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [members, setMembers] = useState([]);
  const [changes, setChanges] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingMemberId, setRefreshingMemberId] = useState(null);

  // Active top toast/notification banner
  const [toastNotification, setToastNotification] = useState(null);

  // Modals
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Theme
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') !== 'light';
  });

  // Apply dark mode class to html element
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
        await api.getMe();
        setIsAuthenticated(true);
      } catch (_) {
        setAuthToken(null);
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Fetch initial data
  const loadDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [membersData, changesData, statusData] = await Promise.all([
        api.getMembers(),
        api.getChanges(20),
        api.getSyncStatus(),
      ]);
      setMembers(membersData);
      setChanges(changesData);
      setSyncStatus(statusData);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated, loadDashboardData]);

  // Server-Sent Events (SSE) Listener for real-time live updates
  useEffect(() => {
    if (!isAuthenticated) return;

    let eventSource = null;
    let reconnectTimeout = null;

    const connectSSE = () => {
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('connected', () => {
        console.log('SSE connected successfully');
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

          // If this was a member completing fetch, show success banner and clear pending notice
          if (updated.fetch_status === 'success') {
            setToastNotification({
              type: 'success',
              title: `Synced ${updated.name || updated.roll_no}!`,
              message: `Reward points: ${updated.balance_points} pts | Marks: ${updated.total_marks}`
            });
            setTimeout(() => {
              setToastNotification(null);
            }, 6000);
          }
        } catch (err) {
          console.error('Error handling member_updated event:', err);
        }
      });

      eventSource.addEventListener('change_alert', (event) => {
        try {
          const changeItem = JSON.parse(event.data);
          setChanges((prev) => [changeItem, ...prev]);

          // Trigger festive confetti if points changed upwards
          if (changeItem.field === 'balance_points' && Number(changeItem.new_value) > Number(changeItem.old_value)) {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.8 },
            });
          }
        } catch (err) {
          console.error('Error handling change_alert event:', err);
        }
      });

      eventSource.addEventListener('sync_status', (event) => {
        try {
          const newStatus = JSON.parse(event.data);
          setSyncStatus((prev) => ({ ...(prev || {}), ...newStatus }));
        } catch (err) {
          console.error('Error handling sync_status event:', err);
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

  // Handler when a member is added
  const handleMemberAdded = (addedInfo) => {
    // Show clear informative banner that Gradio fetch is underway
    setToastNotification({
      type: 'fetching',
      title: `Enrolled ${addedInfo?.name || addedInfo?.roll_no}!`,
      message: 'Connecting to Gradio Space to fetch reward points and marks... This usually takes ~3–5 seconds. The table will update live automatically.'
    });

    loadDashboardData();
  };

  // Manual Refresh Handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await api.refreshNow();
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

  // Export CSV Handler
  const handleExportCsv = async () => {
    try {
      await api.downloadCsv();
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    }
  };

  // Refresh single member
  const handleRefreshSingleMember = async (memberId) => {
    setRefreshingMemberId(memberId);
    try {
      await api.fetchSingleMember(memberId);
      await loadDashboardData();
    } catch (err) {
      alert(`Member fetch failed: ${err.message}`);
    } finally {
      setRefreshingMemberId(null);
    }
  };

  // Delete member
  const handleDeleteMember = async (memberId) => {
    try {
      await api.deleteMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      alert(`Failed to remove member: ${err.message}`);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setIsAuthenticated(false);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-500">
        <div className="w-8 h-8 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-brand-500 selection:text-white transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        syncStatus={syncStatus}
        isRefreshing={isRefreshing}
        onRefresh={handleManualRefresh}
        onExportCsv={handleExportCsv}
        onLogout={handleLogout}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
      />

      {/* Informative Toast Banner when fetching new member */}
      {toastNotification && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between shadow-sm animate-fade-in ${
            toastNotification.type === 'fetching'
              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200'
              : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-xl ${
                toastNotification.type === 'fetching'
                  ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              }`}>
                {toastNotification.type === 'fetching' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </div>
              <div className="text-xs">
                <span className="font-bold mr-1.5 block sm:inline">
                  {toastNotification.title}
                </span>
                <span className="opacity-90">
                  {toastNotification.message}
                </span>
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
        {/* Quick Stats Cards */}
        <StatsCards members={members} changes={changes} />

        {/* Team Members Roster Table */}
        <div className="w-full">
          <MembersTable
            members={members}
            onSelectMember={(id) => setSelectedMemberId(id)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onRefreshMember={handleRefreshSingleMember}
            onDeleteMember={handleDeleteMember}
            refreshingMemberId={refreshingMemberId}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
          <span>⚡ Team Reward Tracker • Built for Captains</span>
        </div>
      </footer>

      {/* Modals */}
      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onMemberAdded={handleMemberAdded}
      />

      <MemberDetailModal
        memberId={selectedMemberId}
        isOpen={!!selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
        onRefreshMember={loadDashboardData}
      />
    </div>
  );
}
