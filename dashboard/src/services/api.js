/**
 * Unified API Client & Session Manager for SitePulse Dashboard
 */

export const BACKEND_URL = (typeof window !== 'undefined' && (window.location.origin.includes(':3000') || window.location.origin.includes(':5173')))
  ? 'http://localhost:5000'
  : (typeof window !== 'undefined' ? window.location.origin : '');

let onUnauthorizedCallback = null;

export function registerUnauthorizedHandler(cb) {
  onUnauthorizedCallback = cb;
}

export function getAuthToken() {
  try {
    return sessionStorage.getItem('sitepulse_admin_token') || null;
  } catch {
    return null;
  }
}

export function setAuthToken(token, serverInstance) {
  try {
    if (token) {
      sessionStorage.setItem('sitepulse_admin_token', token);
    } else {
      sessionStorage.removeItem('sitepulse_admin_token');
    }
    if (serverInstance) {
      sessionStorage.setItem('sitepulse_server_instance', serverInstance);
    }
  } catch (e) {
    console.warn('SessionStorage write error:', e);
  }
}

export function getServerInstance() {
  try {
    return sessionStorage.getItem('sitepulse_server_instance');
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  try {
    sessionStorage.removeItem('sitepulse_admin_token');
    sessionStorage.removeItem('sitepulse_server_instance');
    localStorage.removeItem('sitepulse_admin_token');
  } catch (e) {}
}

/**
 * Fetch wrapper that attaches Bearer token and triggers session logout on 401 Unauthorized
 */
export async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const fullUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(fullUrl, {
    ...options,
    headers
  });

  if (res.status === 401) {
    if (typeof onUnauthorizedCallback === 'function') {
      onUnauthorizedCallback();
    }
  }

  return res;
}

// -------------------------------------------------------------
// DOMAIN-SPECIFIC API CLIENTS
// -------------------------------------------------------------

export const authApi = {
  async getStatus() {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/status`);
    return { ok: res.ok, status: res.status, data: await res.json() };
  },

  async getMe(token) {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return { ok: res.ok, status: res.status, data: await res.json() };
  },

  async login({ email, password }) {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async signup({ name, email, password, confirmPassword }) {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, confirmPassword })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    return data;
  }
};

export const sitesApi = {
  async getAll() {
    const res = await authFetch('/api/v1/sites');
    return res.ok ? await res.json() : [];
  },

  async create({ name, domain }) {
    const res = await authFetch('/api/v1/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, domain })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create site');
    return data;
  },

  async update(siteId, data) {
    const res = await authFetch(`/api/v1/sites/${siteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update site');
    return result;
  },

  async delete(siteId, password) {
    const res = await authFetch(`/api/v1/sites/${siteId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete website property');
    return data;
  },

  async clearConversations(siteId, password) {
    const res = await authFetch(`/api/v1/sites/${siteId}/conversations`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete conversations');
    return data;
  },

  async getPages(apiKey) {
    const res = await authFetch(`/api/v1/sites/${apiKey}/pages`);
    return res.ok ? await res.json() : { pages: [], pageRules: null };
  },

  async scanSite(apiKey) {
    const res = await authFetch(`/api/v1/sites/${apiKey}/scan`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Site scan failed');
    return data;
  }
};

export const widgetApi = {
  async updateConfig({ siteKey, settings }) {
    const res = await authFetch('/api/v1/widget/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteKey, settings })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save widget configuration');
    return data;
  }
};

export const conversationsApi = {
  async getAll(siteKey, status) {
    const query = status && status !== 'all' ? `&status=${status}` : '';
    const res = await authFetch(`/api/v1/conversations?siteKey=${siteKey}${query}`);
    return res.ok ? await res.json() : [];
  },

  async getMessages(conversationId) {
    const res = await authFetch(`/api/v1/conversations/${conversationId}/messages`);
    return res.ok ? await res.json() : [];
  },

  async updateStatus(conversationId, status) {
    const res = await authFetch(`/api/v1/conversations/${conversationId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update status');
    return data;
  }
};

export const feedbackApi = {
  async getAll(siteKey) {
    const res = await authFetch(`/api/v1/feedback?siteKey=${siteKey}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }
};

export const bugsApi = {
  async getAll(siteKey) {
    const res = await authFetch(`/api/v1/bugs?siteKey=${siteKey}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }
};
