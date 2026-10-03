const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('reward_tracker_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('reward_tracker_token', token);
  } else {
    localStorage.removeItem('reward_tracker_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    try {
      const errData = await response.json();
      errorMsg = errData.detail || errorMsg;
    } catch (_) {}

    if (response.status === 401) {
      setAuthToken(null);
      if (!endpoint.startsWith('/auth/')) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        if (!errorMsg || errorMsg.startsWith('Request failed')) {
          errorMsg = 'Unauthorized or session expired. Please log in.';
        }
      }
    }
    throw new Error(errorMsg);
  }

  // Check if response is JSON or blob/text
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response;
}

export const api = {
  // ----------------- Auth -----------------
  login: (team_id, roll_no, password = '') => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ team_id, roll_no, password }),
  }),
  signup: (team_id, roll_no, password, captain_name = '') => request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ team_id, roll_no, password, captain_name }),
  }),
  getMe: () => request('/auth/me'),
  changePassword: (current_password, new_password) => request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  }),

  // ----------------- Captain API -----------------
  getTeamMembers: () => request('/team/members'),
  addTeamMember: (data) => request('/team/members', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  removeTeamMember: (userId) => request(`/team/members/${userId}`, {
    method: 'DELETE',
  }),
  resetMemberPassword: (userId, new_password) => request(`/team/members/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ new_password }),
  }),
  getMemberFullDetails: (userId) => request(`/team/members/${userId}/details`),
  getMemberHistory: (userId) => request(`/team/members/${userId}/details`),
  fetchSingleMember: () => request('/team/refresh', { method: 'POST' }),
  getTeamChanges: (limit = 50) => request(`/team/changes?limit=${limit}`),
  refreshTeamNow: () => request('/team/refresh', {
    method: 'POST',
  }),
  downloadTeamCsv: async (teamId) => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/team/export/csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to export CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${teamId || 'team'}_reward_tracker_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // ----------------- Member & Shared API -----------------
  getMemberSelfDetails: () => request('/member/me'),
  getTeamSummary: () => request('/team/summary'),
  getSyncStatus: () => request('/sync/status'),
};
