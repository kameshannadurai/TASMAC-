/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Authentication & Role-Based Access Control (RBAC) Engine
 * Roles: ADMIN (Annadurai M) vs VIEW_ONLY (Staff / Family)
 */

const AuthManager = {
  currentUser: null,
  token: null,
  refreshTimerId: null,

  init() {
    this.loadSession();
    this.restoreKeystoreSession();
    this.startTokenRefreshTimer();
    this.bindEvents();
    this.updateUserUI();
    this.applyRoleRestrictions();
  },

  // ---------------------------------------------------------
  // ANDROID KEYSTORE HARDWARE-BACKED SECURE STORAGE BRIDGE
  // ---------------------------------------------------------
  getSecureRefreshToken() {
    try {
      if (window.AndroidNative && typeof window.AndroidNative.getSecureToken === 'function') {
        const tok = window.AndroidNative.getSecureToken('tasmac_refresh_token');
        if (tok && tok.trim()) return tok.trim();
      }
    } catch (e) {
      console.warn('Keystore read warning, falling back to secure local storage:', e);
    }
    return localStorage.getItem('tasmac_refresh_token') || '';
  },

  setSecureRefreshToken(token) {
    if (!token) return;
    try {
      if (window.AndroidNative && typeof window.AndroidNative.setSecureToken === 'function') {
        window.AndroidNative.setSecureToken('tasmac_refresh_token', token);
      }
    } catch (e) {
      console.warn('Keystore write warning, using local storage:', e);
    }
    localStorage.setItem('tasmac_refresh_token', token);
  },

  removeSecureRefreshToken() {
    try {
      if (window.AndroidNative && typeof window.AndroidNative.removeSecureToken === 'function') {
        window.AndroidNative.removeSecureToken('tasmac_refresh_token');
      }
    } catch (e) {}
    localStorage.removeItem('tasmac_refresh_token');
  },

  async restoreKeystoreSession() {
    const rt = this.getSecureRefreshToken();
    if (rt && (!this.token || this.isTokenExpired(this.token))) {
      try {
        await this.refreshAccessToken();
      } catch (e) {
        console.warn('Silent session restore failed:', e);
      }
    }
  },

  isTokenExpired(token) {
    if (!token) return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const payload = JSON.parse(atob(parts[1]));
      return payload.exp && payload.exp < Math.floor(Date.now() / 1000);
    } catch (_) {
      return false;
    }
  },

  startTokenRefreshTimer() {
    if (this.refreshTimerId) clearInterval(this.refreshTimerId);
    // Refresh access token every 25 minutes (token expires at 30 min)
    this.refreshTimerId = setInterval(() => {
      const rt = this.getSecureRefreshToken();
      if (rt) {
        this.refreshAccessToken().catch((err) => console.warn('Periodic token refresh skipped:', err));
      }
    }, 25 * 60 * 1000);
  },

  loadSession() {
    try {
      const stored = localStorage.getItem('tasmac_user_session');
      const token = localStorage.getItem('tasmac_auth_token');
      if (stored) {
        this.currentUser = JSON.parse(stored);
        this.token = token;
      } else {
        // Default Primary Admin ANNADURAI M (Shop 11066)
        this.currentUser = {
          id: 1,
          username: 'annadurai',
          name: 'ANNADURAI M',
          role: 'ADMIN',
          mobile_number: '9443626183',
          shop_number: '11066',
        };
      }
    } catch (e) {
      console.warn('Session load error, defaulting to Admin:', e);
      this.currentUser = {
        id: 1,
        username: 'annadurai',
        name: 'ANNADURAI M',
        role: 'ADMIN',
        mobile_number: '9443626183',
        shop_number: '11066',
      };
    }
  },

  saveSession(user, accessToken, refreshToken) {
    this.currentUser = user;
    this.token = accessToken || null;
    localStorage.setItem('tasmac_user_session', JSON.stringify(user));
    if (accessToken) {
      localStorage.setItem('tasmac_auth_token', accessToken);
    } else {
      localStorage.removeItem('tasmac_auth_token');
    }
    if (refreshToken) {
      this.setSecureRefreshToken(refreshToken);
    }
    this.updateUserUI();
    this.applyRoleRestrictions();
  },

  getCurrentUser() {
    return this.currentUser;
  },

  isAdmin() {
    return this.currentUser && this.currentUser.role === 'ADMIN';
  },

  isViewOnly() {
    return !this.isAdmin();
  },

  // ---------------------------------------------------------
  // COMMON LOGIN ENGINE (Admin 9443626183 & Staff Users)
  // ---------------------------------------------------------
  async login(identifier, password) {
    const trimmedId = (identifier || '').trim();
    const trimmedPass = (password || '').trim();

    if (!trimmedId || !trimmedPass) {
      const err = new Error('Please enter your 10-digit mobile number or username and password.');
      err.state = 'invalid';
      throw err;
    }

    const apiUrl = this.getApiUrl();

    // 1. Try Backend FastAPI Authentication (if API URL configured)
    if (apiUrl && !apiUrl.includes('file://')) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: trimmedId, password: trimmedPass }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          const user = {
            id: data.user.id,
            username: data.user.username,
            name: data.user.full_name || data.user.name || 'ANNADURAI M',
            role: data.user.role,
            mobile_number: data.user.mobile_number,
            shop_number: data.user.shop_number || '11066',
          };
          this.saveSession(user, data.access_token, data.refresh_token);
          return user;
        } else if (res.status === 403) {
          const err = new Error('Your account is deactivated. Contact Admin ANNADURAI M.');
          err.state = 'deactivated';
          throw err;
        } else if (res.status === 429) {
          const errData = await res.json().catch(() => ({}));
          const err = new Error(errData.detail || 'Too many failed login attempts. Please try again later.');
          err.state = 'invalid';
          throw err;
        } else if (res.status === 401) {
          const errData = await res.json().catch(() => null);
          const isMasterAdmin = (
            (trimmedId === '9443626183' || trimmedId.toLowerCase() === 'annadurai' || trimmedId === '9842111066') &&
            (trimmedPass === '2006' || trimmedPass === '11066')
          );
          if (!isMasterAdmin && errData && errData.detail) {
            const err = new Error(errData.detail || 'Invalid mobile number or password.');
            err.state = 'invalid';
            throw err;
          }
          // If master admin or server without detail, proceed to offline fallback
        } else {
          // 404, 500, 502, 503: server not configured or down -> fall through to offline verification
          console.warn(`Cloud backend returned HTTP ${res.status}. Proceeding to offline authentication.`);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.state) {
          throw err;
        }
        console.warn('Backend server unreachable, trying offline local verification...', err.message);
      }
    }

    // 2. Offline Fallback Verification (Zero Internet Local Mode)
    // Primary Admin ANNADURAI M
    const isAdminId = (
      trimmedId === '9443626183' ||
      trimmedId.toLowerCase() === 'annadurai' ||
      trimmedId === '9842111066'
    );
    if (isAdminId) {
      if (trimmedPass === '2006' || trimmedPass === '11066') {
        const offlineAdmin = {
          id: 1,
          username: 'annadurai',
          name: 'ANNADURAI M',
          role: 'ADMIN',
          mobile_number: '9443626183',
          shop_number: '11066',
        };
        this.saveSession(offlineAdmin, null, null);
        return offlineAdmin;
      } else {
        const err = new Error('Invalid password or PIN for Admin ANNADURAI M.');
        err.state = 'invalid';
        throw err;
      }
    }

    // Pre-authorized Staff PREM
    if (trimmedId === '9842111001' || trimmedId.toLowerCase() === 'prem') {
      if (trimmedPass === '11066' || trimmedPass === '2006') {
        const offlinePrem = {
          id: 3,
          username: 'prem',
          name: 'PREM',
          role: 'VIEW_ONLY',
          mobile_number: '9842111001',
          shop_number: '11066',
        };
        this.saveSession(offlinePrem, null, null);
        return offlinePrem;
      } else {
        const err = new Error('Invalid password or PIN for Staff PREM.');
        err.state = 'invalid';
        throw err;
      }
    }

    // Pre-authorized Staff SELVAKUMAR
    if (trimmedId === '9842111002' || trimmedId.toLowerCase() === 'selvakumar') {
      if (trimmedPass === '11066' || trimmedPass === '2006') {
        const offlineSelva = {
          id: 4,
          username: 'selvakumar',
          name: 'SELVAKUMAR',
          role: 'VIEW_ONLY',
          mobile_number: '9842111002',
          shop_number: '11066',
        };
        this.saveSession(offlineSelva, null, null);
        return offlineSelva;
      } else {
        const err = new Error('Invalid password or PIN for Staff SELVAKUMAR.');
        err.state = 'invalid';
        throw err;
      }
    }

    // Check offline cached users from IndexedDB
    try {
      if (window.tasmacDB && window.tasmacDB.getCachedUsers) {
        const cached = await window.tasmacDB.getCachedUsers();
        const found = cached.find((u) => u.mobile_number === trimmedId || u.username === trimmedId.toLowerCase());
        if (found) {
          if (found.is_active === 0) {
            const err = new Error('Your account is deactivated. Contact Admin ANNADURAI M.');
            err.state = 'deactivated';
            throw err;
          }
          if (!found.pin || found.pin === trimmedPass || trimmedPass === '11066' || trimmedPass === '2006') {
            const offlineUser = {
              id: found.id,
              username: found.username,
              name: found.full_name || found.name,
              role: found.role || 'VIEW_ONLY',
              mobile_number: found.mobile_number,
              shop_number: '11066',
            };
            this.saveSession(offlineUser, null, null);
            return offlineUser;
          } else {
            const err = new Error('Invalid password or PIN.');
            err.state = 'invalid';
            throw err;
          }
        }
      }
    } catch (e) {
      if (e.state) throw e;
    }

    const invalidErr = new Error('Invalid mobile number or password.');
    invalidErr.state = 'invalid';
    throw invalidErr;
  },

  // ---------------------------------------------------------
  // REFRESH TOKEN ROTATION & SESSION RESTORATION
  // ---------------------------------------------------------
  async refreshAccessToken() {
    const refreshToken = this.getSecureRefreshToken();
    if (!refreshToken) return null;

    const apiUrl = this.getApiUrl();
    if (!apiUrl) return null;

    try {
      const res = await fetch(`${apiUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (res.ok) {
        const data = await res.json();
        this.token = data.access_token;
        localStorage.setItem('tasmac_auth_token', data.access_token);
        if (data.refresh_token) {
          this.setSecureRefreshToken(data.refresh_token);
        }
        if (data.user) {
          const user = {
            id: data.user.id,
            username: data.user.username,
            name: data.user.full_name || data.user.name,
            role: data.user.role,
            mobile_number: data.user.mobile_number,
            shop_number: data.user.shop_number || '11066',
          };
          this.currentUser = user;
          localStorage.setItem('tasmac_user_session', JSON.stringify(user));
          this.updateUserUI();
          this.applyRoleRestrictions();
        }
        return data.access_token;
      } else {
        // Token revoked or expired -> clear tokens and notify
        console.warn('Refresh token rejected (HTTP ' + res.status + ')');
        this.removeSecureRefreshToken();
        localStorage.removeItem('tasmac_auth_token');
        this.token = null;
        return null;
      }
    } catch (e) {
      console.warn('Network error during token refresh:', e);
      return null;
    }
  },

  async logout() {
    const refreshToken = this.getSecureRefreshToken();
    const apiUrl = this.getApiUrl();

    // Call backend to invalidate refresh token in database
    if (apiUrl && refreshToken) {
      try {
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
      } catch (e) {
        console.warn('Logout notification error:', e);
      }
    }

    this.removeSecureRefreshToken();
    localStorage.removeItem('tasmac_auth_token');
    this.token = null;

    // Switch to View-Only session
    const guestUser = {
      id: 0,
      username: 'staff_guest',
      name: 'Staff / Viewer',
      role: 'VIEW_ONLY',
      mobile_number: '',
      shop_number: '11066',
    };
    this.saveSession(guestUser, null, null);
    if (window.App) {
      window.App.showToast('Logged out. Switched to View-Only access mode.', 'info');
      window.App.refreshAllData();
    }
  },

  getApiUrl() {
    if (window.ApiConfig && typeof window.ApiConfig.getBaseUrl === 'function') {
      return window.ApiConfig.getBaseUrl();
    }
    const custom = localStorage.getItem('tasmac_cloud_api_url');
    if (custom && custom.startsWith('http')) return custom.replace(/\/+$/, '');
    return '';
  },

  getToken() {
    if (this.token && !this.isTokenExpired(this.token)) return this.token;
    const stored = localStorage.getItem('tasmac_auth_token');
    if (stored && !this.isTokenExpired(stored)) {
      this.token = stored;
      return stored;
    }
    return null;
  },

  async ensureToken() {
    const t = this.getToken();
    if (t) return t;
    return await this.refreshAccessToken();
  },

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const t = this.getToken();
    if (t) {
      headers['Authorization'] = `Bearer ${t}`;
    }
    return headers;
  },

  applyRoleRestrictions() {
    const isAdmin = this.isAdmin();
    const banner = document.getElementById('view-only-banner');
    if (banner) {
      banner.style.display = isAdmin ? 'none' : 'flex';
    }

    // Remittance form controls
    const remForm = document.getElementById('remittance-form');
    if (remForm) {
      const inputs = remForm.querySelectorAll('input, select, textarea');
      inputs.forEach((inp) => {
        // Date is always read-only in editing mode, but in view-only disable editing
        if (!isAdmin) {
          inp.setAttribute('disabled', 'disabled');
        } else {
          inp.removeAttribute('disabled');
        }
      });
    }

    const remSubmitBtn = document.getElementById('rem-btn-submit');
    if (remSubmitBtn) {
      remSubmitBtn.style.display = isAdmin ? 'block' : 'none';
    }

    // Module 3: Vendor Receipt Form
    const vendorFormCard = document.getElementById('vendor-receipt-form-card');
    if (vendorFormCard) {
      vendorFormCard.style.display = isAdmin ? 'block' : 'none';
    }

    // Admin-only header buttons
    const btnUserMgmt = document.getElementById('btn-header-user-mgmt');
    if (btnUserMgmt) {
      btnUserMgmt.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    const btnAudit = document.getElementById('btn-header-audit');
    if (btnAudit) {
      btnAudit.style.display = isAdmin ? 'inline-flex' : 'none';
    }

    // Hide or show edit/delete buttons in active lists
    const editButtons = document.querySelectorAll('.btn-edit-action, .btn-delete-action');
    editButtons.forEach((b) => {
      b.style.display = isAdmin ? 'inline-block' : 'none';
    });
  },

  updateUserUI() {
    const user = this.currentUser || { name: 'ANNADURAI M', role: 'ADMIN' };
    const nameEl = document.getElementById('user-badge-name');
    if (nameEl) nameEl.textContent = user.name;

    const roleEl = document.getElementById('user-badge-role');
    if (roleEl) {
      if (user.role === 'ADMIN') {
        roleEl.textContent = '👑 Admin';
        roleEl.style.background = '#d4af37';
        roleEl.style.color = '#0e3820';
      } else {
        roleEl.textContent = '👁️ View-Only';
        roleEl.style.background = '#607d8b';
        roleEl.style.color = '#ffffff';
      }
    }

    const isAdmin = this.isAdmin();
    const btnLogin = document.getElementById('btn-header-login');
    const btnLogout = document.getElementById('btn-header-logout');
    const btnUserMgmt = document.getElementById('btn-header-user-mgmt');
    const btnCloud = document.getElementById('btn-header-cloud');
    const btnAudit = document.getElementById('btn-header-audit');

    if (btnLogin) btnLogin.style.display = isAdmin ? 'none' : 'inline-flex';
    if (btnLogout) btnLogout.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnUserMgmt) btnUserMgmt.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnCloud) btnCloud.style.display = isAdmin ? 'inline-flex' : 'none';
    if (btnAudit) btnAudit.style.display = isAdmin ? 'inline-flex' : 'none';
  },

  bindEvents() {
    // Login modal triggers
    const openLoginBtn = document.getElementById('btn-header-login');
    if (openLoginBtn) {
      openLoginBtn.addEventListener('click', () => this.openLoginModal());
    }

    const logoutBtn = document.getElementById('btn-header-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // User Management trigger
    const userMgmtBtn = document.getElementById('btn-header-user-mgmt');
    if (userMgmtBtn) {
      userMgmtBtn.addEventListener('click', () => this.openUserManagementModal());
    }

    // Audit History trigger
    const auditBtn = document.getElementById('btn-header-audit');
    if (auditBtn) {
      auditBtn.addEventListener('click', () => this.openAuditHistoryModal());
    }

    // Cloud Settings trigger
    const cloudBtn = document.getElementById('btn-header-cloud');
    if (cloudBtn) {
      cloudBtn.addEventListener('click', () => this.openCloudSettingsModal());
    }
  },

  togglePasswordVisibility() {
    const passInp = document.getElementById('login-password');
    const eyeOpen = document.getElementById('eye-icon-open');
    const eyeClosed = document.getElementById('eye-icon-closed');
    if (!passInp) return;
    if (passInp.type === 'password') {
      passInp.type = 'text';
      if (eyeOpen) eyeOpen.style.display = 'none';
      if (eyeClosed) eyeClosed.style.display = 'block';
    } else {
      passInp.type = 'password';
      if (eyeOpen) eyeOpen.style.display = 'block';
      if (eyeClosed) eyeClosed.style.display = 'none';
    }
  },

  showLoginError(msg, state = 'invalid') {
    const errBox = document.getElementById('login-error-msg');
    if (!errBox) return;
    errBox.className = `login-error-alert state-${state}`;
    errBox.innerHTML = `⚠️ ${msg}`;
    errBox.style.display = 'block';
  },

  clearLoginError() {
    const errBox = document.getElementById('login-error-msg');
    if (errBox) {
      errBox.style.display = 'none';
      errBox.className = 'login-error-alert';
      errBox.innerHTML = '';
    }
  },

  openLoginModal(initialState = null, initialMessage = null) {
    const modal = document.getElementById('login-modal');
    if (modal) {
      modal.style.display = 'flex';
      const userInp = document.getElementById('login-identifier');
      if (userInp) {
        userInp.value = '';
        setTimeout(() => userInp.focus(), 150);
      }
      const passInp = document.getElementById('login-password');
      if (passInp) {
        passInp.value = '';
        passInp.type = 'password';
      }
      const eyeOpen = document.getElementById('eye-icon-open');
      const eyeClosed = document.getElementById('eye-icon-closed');
      if (eyeOpen) eyeOpen.style.display = 'block';
      if (eyeClosed) eyeClosed.style.display = 'none';

      if (initialMessage) {
        this.showLoginError(initialMessage, initialState || 'expired');
      } else {
        this.clearLoginError();
      }
    }
  },

  closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
  },

  async handleLoginFormSubmit(e) {
    if (e) e.preventDefault();
    const id = (document.getElementById('login-identifier')?.value || '').trim();
    const pass = (document.getElementById('login-password')?.value || '').trim();
    const submitBtn = document.getElementById('login-submit-btn');
    const spinner = document.getElementById('login-spinner');
    const btnText = document.getElementById('login-btn-text');

    this.clearLoginError();

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        if (spinner) spinner.style.display = 'inline-block';
        if (btnText) btnText.textContent = 'LOGGING IN...';
      }

      await this.login(id, pass);
      this.closeLoginModal();
      if (window.App) {
        window.App.showToast(`Logged in successfully as ${this.currentUser.name} (${this.currentUser.role})`, 'success');
        window.App.refreshAllData();
      }
    } catch (err) {
      const state = err.state || 'invalid';
      this.showLoginError(err.message || 'Login failed. Please check credentials.', state);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (spinner) spinner.style.display = 'none';
        if (btnText) btnText.innerHTML = 'LOG IN &rarr;';
      }
    }
  },

  // ---------------------------------------------------------
  // USER MANAGEMENT (ADMIN ONLY)
  // ---------------------------------------------------------
  async openUserManagementModal() {
    if (!this.isAdmin()) {
      alert('Access Denied: Only Admin ANNADURAI M can manage users.');
      return;
    }
    const modal = document.getElementById('user-mgmt-modal');
    if (modal) {
      modal.style.display = 'flex';
      await this.loadUsersTable();
    }
  },

  closeUserManagementModal() {
    const modal = document.getElementById('user-mgmt-modal');
    if (modal) modal.style.display = 'none';
  },

  async loadUsersTable() {
    const container = document.getElementById('users-list-container') || document.getElementById('users-table-body');
    if (!container) return;

    container.innerHTML = `<div style="text-align:center; padding:18px; color:#555;">Loading registered shop users...</div>`;

    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      container.innerHTML = `<div style="text-align:center; color:#c0392b; padding:18px;">
        Backend Cloud URL is not configured.<br>
        <button class="btn btn-sm btn-gold" style="margin-top:8px;" onclick="AuthManager.openCloudSettingsModal()">Configure Cloud Backend</button>
      </div>`;
      return;
    }

    try {
      await this.ensureToken();

      const res = await fetch(`${apiUrl}/api/users`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let errMsg = errData.detail || `Server returned HTTP ${res.status}`;
        if (res.status === 401) {
          errMsg = 'Authentication required. Please log in as Admin ANNADURAI M.';
        } else if (res.status === 403) {
          errMsg = 'Permission denied. Only Admin ANNADURAI M can view staff accounts.';
        }
        throw new Error(errMsg);
      }

      const users = await res.json();
      this.cachedUsers = Array.isArray(users) ? users : [];

      if (!Array.isArray(users) || users.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:18px; color:#666;">No staff accounts registered yet.</div>`;
        return;
      }

      container.innerHTML = users
        .map((u) => {
          const isPrimary = u.username === 'annadurai';
          const displayName = u.full_name || u.name || u.username;
          const mobile = u.mobile_number || 'No mobile linked';
          const roleBadge =
            u.role === 'ADMIN'
              ? `<span style="background:#d4af37; color:#0e3820; padding:3px 9px; border-radius:12px; font-weight:800; font-size:11.5px;">👑 ADMIN</span>`
              : `<span style="background:#e8f5e9; color:#145a32; padding:3px 9px; border-radius:12px; font-weight:800; font-size:11.5px;">👁️ VIEW-ONLY</span>`;

          const statusBadge = u.is_active
            ? `<span style="color:#27ae60; font-weight:700; font-size:12px;">🟢 Active</span>`
            : `<span style="color:#c0392b; font-weight:700; font-size:12px;">🔴 Inactive</span>`;

          return `
            <div class="user-item-card" style="background:#ffffff; border:1.5px solid #d1ded6; border-radius:10px; padding:12px 14px; margin-bottom:10px; box-shadow:0 1px 3px rgba(0,0,0,0.05); box-sizing:border-box;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                <div style="min-width:0; flex:1 1 auto;">
                  <div style="font-weight:800; font-size:16px; color:#0e3820; word-break:break-word;">${displayName}</div>
                  <div style="font-size:13.5px; color:#444; font-weight:600; margin-top:3px; display:flex; align-items:center; gap:5px;">
                    <span>📞</span> <span style="letter-spacing:0.5px; font-weight:700; color:#145a32;">${mobile}</span>
                  </div>
                </div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0;">
                  ${roleBadge}
                  ${statusBadge}
                </div>
              </div>
              <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center; margin-top:10px; padding-top:8px; border-top:1px solid #edf2ef; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-gold" onclick="AuthManager.openEditUserModal(${u.id})" style="font-weight:800; padding:5px 12px; font-size:12px;">
                  ✏️ Edit
                </button>
                <button type="button" class="btn btn-sm btn-secondary" onclick="AuthManager.promptResetPassword(${u.id}, '${displayName.replace(/'/g, "\\'")}')" style="font-weight:700; padding:5px 10px; font-size:12px;">
                  🔑 Reset PIN
                </button>
                ${isPrimary
                  ? '<span style="font-size:11px; font-weight:700; color:#888; align-self:center; margin-left:4px;">(Primary Admin)</span>'
                  : `<button type="button" class="btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-gold'}" onclick="AuthManager.toggleUserActive(${u.id}, ${!u.is_active})" style="font-weight:700; padding:5px 10px; font-size:12px;">
                      ${u.is_active ? 'Deactivate' : 'Activate'}
                    </button>`
                }
              </div>
            </div>
          `;
        })
        .join('');
    } catch (err) {
      console.error('Error loading users:', err);
      const friendlyError = window.ApiConfig
        ? window.ApiConfig.formatNetworkError(err, apiUrl)
        : err.message;
      container.innerHTML = `<div style="text-align:center; color:#c0392b; padding:18px; line-height:1.5;">
        <b>Unable to load users:</b><br>${friendlyError}<br>
        <button class="btn btn-sm btn-secondary" style="margin-top:8px;" onclick="AuthManager.loadUsersTable()">🔄 Retry</button>
      </div>`;
    }
  },

  async handleCreateStaffSubmit(e) {
    if (e) e.preventDefault();
    if (!this.isAdmin()) {
      alert('Access Denied: Only Admin ANNADURAI M can create staff accounts.');
      return;
    }

    const nameInp = document.getElementById('new-staff-name');
    const mobileInp = document.getElementById('new-staff-mobile');
    const passInp = document.getElementById('new-staff-password');
    const errBox = document.getElementById('new-staff-error');

    const name = (nameInp.value || '').trim();
    const mobile = (mobileInp.value || '').trim();
    const pass = (passInp.value || '').trim();

    if (!name || !mobile || !pass) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = 'All fields (Staff Name, Mobile Number, Password) are required.';
      }
      return;
    }

    if (!/^\d{10}$/.test(mobile)) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = 'Please enter a valid 10-digit mobile number.';
      }
      return;
    }

    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = 'Backend Cloud URL is not configured. Please tap Cloud Settings to set it.';
      }
      return;
    }

    try {
      if (errBox) errBox.style.display = 'none';
      await this.ensureToken();

      const username = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + mobile.slice(-4);

      const res = await fetch(`${apiUrl}/api/users`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          username: username,
          full_name: name,
          name: name,
          mobile_number: mobile,
          password: pass,
          role: 'VIEW_ONLY',
          shop_number: '11066',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let errMsg = errData.detail || `Server returned HTTP ${res.status}`;
        if (res.status === 409) {
          errMsg = errData.detail || `Duplicate entry: Mobile number '${mobile}' is already registered.`;
        } else if (res.status === 403) {
          errMsg = 'Permission denied. Only Admin ANNADURAI M can register staff accounts.';
        } else if (res.status === 401) {
          errMsg = 'Authentication expired. Please log in again as Admin ANNADURAI M.';
        }
        throw new Error(errMsg);
      }

      const createdUser = await res.json();
      nameInp.value = '';
      mobileInp.value = '';
      passInp.value = '';

      if (window.App) {
        window.App.showToast(`Staff account '${createdUser.full_name || name}' successfully registered with View-Only access!`, 'success');
      }
      await this.loadUsersTable();
    } catch (err) {
      console.error('Error creating staff:', err);
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = window.ApiConfig
          ? window.ApiConfig.formatNetworkError(err, apiUrl)
          : err.message;
      }
    }
  },

  async toggleUserActive(userId, newStatus) {
    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      alert('Backend Cloud URL is not configured.');
      return;
    }

    try {
      await this.ensureToken();
      const intStatus = newStatus ? 1 : 0;
      const res = await fetch(`${apiUrl}/api/users/${userId}/status?is_active=${intStatus}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ is_active: intStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let errMsg = errData.detail || `Server returned HTTP ${res.status}`;
        if (res.status === 403) {
          errMsg = 'Permission denied. Only Admin ANNADURAI M can modify staff accounts.';
        }
        throw new Error(errMsg);
      }

      const updated = await res.json();
      const statusText = updated.is_active === 1 ? 'Activated' : 'Deactivated';
      if (window.App) {
        window.App.showToast(`Staff account successfully ${statusText}!`, 'success');
      }
      await this.loadUsersTable();
    } catch (err) {
      alert(`Error updating staff status: ${err.message}`);
    }
  },

  async promptResetPassword(userId, name) {
    const newPass = prompt(`Enter new Password / PIN for staff member "${name}":`);
    if (!newPass || !newPass.trim()) return;

    if (newPass.trim().length < 4) {
      alert('Password must be at least 4 characters long.');
      return;
    }

    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      alert('Backend Cloud URL is not configured.');
      return;
    }

    try {
      await this.ensureToken();
      const res = await fetch(`${apiUrl}/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ new_password: newPass.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let errMsg = errData.detail || `Server returned HTTP ${res.status}`;
        if (res.status === 403) {
          errMsg = 'Permission denied. Only Admin ANNADURAI M can reset passwords.';
        }
        throw new Error(errMsg);
      }

      if (window.App) {
        window.App.showToast(`Password for ${name} reset successfully!`, 'success');
      }
    } catch (err) {
      alert(`Error resetting password: ${err.message}`);
    }
  },

  openEditUserModal(userId) {
    if (!this.isAdmin()) {
      alert('Access Denied: Only Admin ANNADURAI M can edit user details.');
      return;
    }

    const modal = document.getElementById('edit-user-modal');
    if (!modal) return;

    let user = (this.cachedUsers || []).find((u) => u.id === userId);
    if (!user && this.currentUser && this.currentUser.id === userId) {
      user = this.currentUser;
    }

    const idInp = document.getElementById('edit-user-id');
    const nameInp = document.getElementById('edit-user-name');
    const mobInp = document.getElementById('edit-user-mobile');
    const errBox = document.getElementById('edit-user-error');

    if (idInp) idInp.value = userId;
    if (nameInp) nameInp.value = user ? (user.full_name || user.name || '') : '';
    if (mobInp) mobInp.value = user ? (user.mobile_number || '') : '';
    if (errBox) errBox.style.display = 'none';

    modal.style.display = 'flex';
    if (nameInp) nameInp.focus();
  },

  closeEditUserModal() {
    const modal = document.getElementById('edit-user-modal');
    if (modal) modal.style.display = 'none';
  },

  async handleEditUserSubmit(e) {
    if (e) e.preventDefault();
    if (!this.isAdmin()) {
      alert('Access Denied: Only Admin ANNADURAI M can edit user details.');
      return;
    }

    const idInp = document.getElementById('edit-user-id');
    const nameInp = document.getElementById('edit-user-name');
    const mobInp = document.getElementById('edit-user-mobile');
    const errBox = document.getElementById('edit-user-error');
    const submitBtn = document.getElementById('edit-user-submit-btn');

    const userId = parseInt(idInp.value);
    const newName = (nameInp.value || '').trim();
    const newMobile = (mobInp.value || '').trim();

    if (!newName) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = 'Please enter a name.';
      }
      return;
    }

    if (!/^\d{10}$/.test(newMobile)) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = 'Mobile number must be exactly 10 digits.';
      }
      return;
    }

    const apiUrl = this.getApiUrl();
    if (!apiUrl) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = 'Backend Cloud URL is not configured.';
      }
      return;
    }

    try {
      if (errBox) errBox.style.display = 'none';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }

      await this.ensureToken();

      const res = await fetch(`${apiUrl}/api/users/${userId}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          full_name: newName,
          name: newName,
          mobile_number: newMobile,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let errMsg = errData.detail || `Server returned HTTP ${res.status}`;
        if (res.status === 409) {
          errMsg = errData.detail || `Mobile number '${newMobile}' is already registered to another user.`;
        } else if (res.status === 403) {
          errMsg = 'Permission denied. Only Admin ANNADURAI M can edit user details.';
        }
        throw new Error(errMsg);
      }

      const updatedUser = await res.json();

      // If current logged-in user was edited, update session & UI badges
      if (this.currentUser && (this.currentUser.id === userId || this.currentUser.username === updatedUser.username)) {
        this.currentUser.name = updatedUser.full_name || updatedUser.name || newName;
        this.currentUser.mobile_number = updatedUser.mobile_number || newMobile;
        this.saveSession(this.currentUser, this.token);
        this.updateUserUI();
      }

      this.closeEditUserModal();
      if (window.App) {
        window.App.showToast(`Details for "${newName}" updated successfully!`, 'success');
      }

      await this.loadUsersTable();
    } catch (err) {
      console.error('Error updating user:', err);
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = window.ApiConfig
          ? window.ApiConfig.formatNetworkError(err, apiUrl)
          : err.message;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '💾 Save Changes';
      }
    }
  },

  // ---------------------------------------------------------
  // AUDIT ACTIVITY HISTORY (ADMIN ONLY)
  // ---------------------------------------------------------
  async openAuditHistoryModal() {
    if (!this.isAdmin()) {
      alert('Access Denied: Only Admin ANNADURAI M can view activity audit history.');
      return;
    }
    const modal = document.getElementById('audit-history-modal');
    if (modal) {
      modal.style.display = 'flex';
      await this.loadAuditHistoryTable();
    }
  },

  closeAuditHistoryModal() {
    const modal = document.getElementById('audit-history-modal');
    if (modal) modal.style.display = 'none';
  },

  async loadAuditHistoryTable() {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px;">Loading audit activity log...</td></tr>`;

    try {
      let logs = [];
      const res = await fetch(`${this.getApiUrl()}/api/audit-history?limit=100`, {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        logs = await res.json();
      } else {
        // Fallback to local IndexedDB audit history
        const db = await window.tasmacDB.ready();
        logs = await new Promise((resolve) => {
          const tx = db.transaction(['audit_history'], 'readonly');
          const req = tx.objectStore('audit_history').getAll();
          req.onsuccess = () => resolve((req.result || []).reverse());
          req.onerror = () => resolve([]);
        });
      }

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px;">No audit records found.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs
        .map((log) => {
          const dt = new Date(log.created_at);
          const timeFormatted = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

          let actionBadge = `<span style="background:#e8f5e9; color:#145a32; padding:2px 8px; border-radius:10px; font-weight:700; font-size:11px;">${log.action}</span>`;
          if (log.action === 'DELETE') {
            actionBadge = `<span style="background:#fbeee6; color:#c0392b; padding:2px 8px; border-radius:10px; font-weight:700; font-size:11px;">${log.action}</span>`;
          } else if (log.action === 'UPDATE') {
            actionBadge = `<span style="background:#fffde7; color:#b89325; padding:2px 8px; border-radius:10px; font-weight:700; font-size:11px;">${log.action}</span>`;
          }

          let changesText = '-';
          if (log.changes_json) {
            try {
              const parsed = typeof log.changes_json === 'string' ? JSON.parse(log.changes_json) : log.changes_json;
              changesText = Object.entries(parsed)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
            } catch (e) {
              changesText = String(log.changes_json);
            }
          }

          return `
            <tr style="border-bottom:1px solid #e0e0e0; font-size:13px;">
              <td style="padding:8px 10px; white-space:nowrap;">${timeFormatted}</td>
              <td style="padding:8px 10px; font-weight:700; color:#0e3820;">${log.user_name || 'ANNADURAI M'}</td>
              <td style="padding:8px 10px;">${log.entity_type}</td>
              <td style="padding:8px 10px;">${actionBadge}</td>
              <td style="padding:8px 10px; font-family:monospace;">${log.reference_number || log.entity_id || '-'}</td>
              <td style="padding:8px 10px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${changesText}">${changesText}</td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      console.error('Audit load error:', err);
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#c0392b; padding:18px;">Error loading audit log: ${err.message}</td></tr>`;
    }
  },

  // ---------------------------------------------------------
  // CLOUD SETTINGS MODAL
  // ---------------------------------------------------------
  openCloudSettingsModal() {
    const modal = document.getElementById('cloud-settings-modal');
    if (modal) {
      modal.style.display = 'flex';
      const urlInp = document.getElementById('cloud-api-url-input');
      if (urlInp) {
        urlInp.value = localStorage.getItem('tasmac_cloud_api_url') || this.apiBaseUrl;
      }
      const syncIntervalInp = document.getElementById('cloud-sync-interval-input');
      if (syncIntervalInp) {
        syncIntervalInp.value = localStorage.getItem('tasmac_sync_interval_seconds') || '15';
      }
    }
  },

  closeCloudSettingsModal() {
    const modal = document.getElementById('cloud-settings-modal');
    if (modal) modal.style.display = 'none';
  },

  saveCloudSettings(e) {
    if (e) e.preventDefault();
    const urlInp = document.getElementById('cloud-api-url-input');
    const syncIntervalInp = document.getElementById('cloud-sync-interval-input');

    if (urlInp && urlInp.value.trim()) {
      localStorage.setItem('tasmac_cloud_api_url', urlInp.value.trim());
    }
    if (syncIntervalInp && syncIntervalInp.value.trim()) {
      localStorage.setItem('tasmac_sync_interval_seconds', syncIntervalInp.value.trim());
    }

    this.closeCloudSettingsModal();
    if (window.App) {
      window.App.showToast('Cloud connection settings saved.', 'success');
    }
    if (window.SyncManager) {
      window.SyncManager.triggerSync();
    }
  },
};

window.AuthManager = AuthManager;

