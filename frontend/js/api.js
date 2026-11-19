/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Centralized API Base URL Configuration & Network Engine
 * 
 * Rules:
 * 1. Never use file:// as an API endpoint.
 * 2. Never assume localhost works on real Android devices.
 * 3. Unified API_BASE_URL across auth, user management, and synchronization.
 * 4. Active validation and detailed connection diagnostics.
 */

const ApiConfig = {
  STORAGE_KEY: 'tasmac_cloud_api_url',
  DEFAULT_CLOUD_URL: 'https://tasmac-shop-11066-backend.onrender.com',

  /**
   * Resolves the active API base URL.
   * Priority:
   * 1. User-configured custom URL in localStorage (http:// or https://)
   * 2. Current origin if running in a web browser on http:// or https://
   * 3. Default secure HTTPS FastAPI cloud backend for Android WebView
   */
  getBaseUrl() {
    // 1. Explicitly configured URL in app settings
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved && typeof saved === 'string') {
      const trimmed = saved.trim().replace(/\/+$/, '');
      if (this.isValidHttpUrl(trimmed)) {
        return trimmed;
      }
    }

    // 2. Web browser on standard HTTP/HTTPS host (NOT file://)
    if (typeof window !== 'undefined' && window.location) {
      const proto = window.location.protocol;
      const host = window.location.hostname;
      const origin = window.location.origin;

      if (proto.startsWith('http')) {
        // Desktop / Laptop local development mode
        if (host === 'localhost' || host === '127.0.0.1') {
          return origin.includes(':8000') ? origin : 'http://localhost:8000';
        }
        return origin.replace(/\/+$/, '');
      }
    }

    // 3. Android APK (file:// or capacitor://localhost):
    // Never use file:// or assume mobile localhost has a Python server running!
    return this.DEFAULT_CLOUD_URL;
  },

  setBaseUrl(url) {
    if (!url || !url.trim()) {
      localStorage.removeItem(this.STORAGE_KEY);
      return;
    }
    const clean = url.trim().replace(/\/+$/, '');
    if (!this.isValidHttpUrl(clean)) {
      throw new Error('Invalid URL format. Please start with http:// or https:// and do not use file://');
    }
    localStorage.setItem(this.STORAGE_KEY, clean);
  },

  isValidHttpUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().trim();
    if (lower.startsWith('file:') || lower.startsWith('content:') || lower.startsWith('null') || lower.startsWith('undefined')) {
      return false;
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
      return false;
    }
  },

  /**
   * Actively tests backend connectivity via /health endpoint.
   * Provides precise diagnostics for mobile debugging.
   */
  async testConnection(candidateUrl) {
    const url = (candidateUrl || this.getBaseUrl() || '').trim().replace(/\/+$/, '');
    if (!this.isValidHttpUrl(url)) {
      return {
        success: false,
        status: 0,
        message: 'Invalid backend URL. URL must start with http:// or https:// (never file://).',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    try {
      const res = await fetch(`${url}/health`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const dbType = data.database_type || (data.database === 'connected' ? 'cloud' : 'local');
        return {
          success: true,
          status: res.status,
          data,
          message: `Connected successfully! TASMAC Server 11066 is active (${dbType} DB: ${data.database || 'connected'}).`,
        };
      } else {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          status: res.status,
          message: errData.detail || `Server returned HTTP ${res.status}: ${res.statusText}`,
        };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        return {
          success: false,
          status: 408,
          message: 'Connection timed out after 7 seconds. Please verify your internet connection and backend server URL.',
        };
      }
      return {
        success: false,
        status: 0,
        message: this.formatNetworkError(err, url),
      };
    }
  },

  /**
   * Replaces generic 'Failed to fetch' with actionable diagnostic messages.
   */
  formatNetworkError(err, url) {
    const baseMsg = err && err.message ? err.message : String(err);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return 'Network connection unavailable. Your device is currently offline.';
    }
    const lower = baseMsg.toLowerCase();
    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
      return `Server unavailable or unreachable at ${url}. Please ensure the backend is deployed on Render (or reachable on Wi-Fi) and check your internet connection.`;
    }
    return `Connection error: ${baseMsg}`;
  },
  /**
   * Performs an authenticated fetch against the API.
   * Automatically attaches Bearer token, handles JSON serialization,
   * and intercepts 401 Unauthorized to trigger automatic token refresh.
   */
  async fetchAuth(path, options = {}) {
    const baseUrl = this.getBaseUrl();
    const url = path.startsWith('http') ? path : `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;

    const headers = Object.assign(
      { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      options.headers || {}
    );

    if (window.AuthManager && window.AuthManager.getToken) {
      const token = window.AuthManager.getToken();
      if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const opts = Object.assign({}, options, { headers });

    try {
      let res = await fetch(url, opts);

      // Handle 401: Token expired -> Attempt Refresh
      if (res.status === 401 && window.AuthManager && window.AuthManager.refreshAccessToken) {
        const refreshedToken = await window.AuthManager.refreshAccessToken().catch(() => null);
        if (refreshedToken) {
          headers['Authorization'] = `Bearer ${refreshedToken}`;
          opts.headers = headers;
          res = await fetch(url, opts);
        }
      }

      return res;
    } catch (err) {
      throw new Error(this.formatNetworkError(err, baseUrl));
    }
  },
};

window.ApiConfig = ApiConfig;
