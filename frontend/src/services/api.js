const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('captain_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('captain_token', token);
  } else {
    localStorage.removeItem('captain_token');
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

  if (response.status === 401) {
    setAuthToken(null);
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let errorMsg = `Request failed (${response.status})`;
    try {
      const errData = await response.json();
      errorMsg = errData.detail || errorMsg;
    } catch (_) {}
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
  // Auth
  login: (password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),
  getMe: () => request('/auth/me'),

  // Members
  getMembers: () => request('/members'),
  addMember: (data) => request('/members', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateMember: (id, data) => request(`/members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteMember: (id) => request(`/members/${id}`, {
    method: 'DELETE',
  }),
  fetchSingleMember: (id) => request(`/members/${id}/fetch`, {
    method: 'POST',
  }),
  getMemberHistory: (id) => request(`/members/${id}/history`),

  // Changes
  getChanges: (limit = 50) => request(`/changes?limit=${limit}`),

  // Sync
  refreshNow: () => request('/sync/refresh', {
    method: 'POST',
  }),
  getSyncStatus: () => request('/sync/status'),

  // Export CSV
  exportCsvUrl: () => `${API_BASE}/export/csv?token=${encodeURIComponent(getAuthToken() || '')}`,
  downloadCsv: async () => {
    const token = getAuthToken();
    const res = await fetch(`${API_BASE}/export/csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to export CSV');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team_reward_tracker_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
};
