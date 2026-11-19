/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Authentication & Role-Based Access Control (RBAC) Engine
 * Roles: ADMIN (Annadurai M) vs VIEW_ONLY (Staff / Family)
 */

const AuthManager = {
  currentUser: null,
  token: null,
  apiBaseUrl: window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:8000'
    : window.location.origin,

  init() {
    this.loadSession();
    this.bindEvents();
    this.updateUserUI();
    this.applyRoleRestrictions();
  },

  loadSession() {
    try {
      const stored = localStorage.getItem('tasmac_user_session');
      const token = localStorage.getItem('tasmac_auth_token');
      if (stored) {
        this.currentUser = JSON.parse(stored);
        this.token = token;
      } else {
        // Default session: Primary Admin ANNADURAI M (Shop 11066)
        this.currentUser = {
          id: 1,
          username: 'annadurai',
          name: 'ANNADURAI M',
          role: 'ADMIN',
          mobile_number: '9842111066',
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
        mobile_number: '9842111066',
        shop_number: '11066',
      };
    }
  },

  saveSession(user, token) {
    this.currentUser = user;
    this.token = token || null;
    localStorage.setItem('tasmac_user_session', JSON.stringify(user));
    if (token) {
      localStorage.setItem('tasmac_auth_token', token);
    } else {
      localStorage.removeItem('tasmac_auth_token');
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

  async login(identifier, password) {
    const trimmedId = (identifier || '').trim();
    const trimmedPass = (password || '').trim();

    if (!trimmedId || !trimmedPass) {
      throw new Error('Please enter your Username or Mobile Number and Password.');
    }

    const apiUrl = this.getApiUrl();

    // If cloud API is configured and reachable, try backend API
    if (apiUrl) {
      try {
        const res = await fetch(`${apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: trimmedId, password: trimmedPass }),
        });

        if (res.ok) {
          const data = await res.json();
          const user = {
            id: data.user.id,
            username: data.user.username,
            name: data.user.name,
            role: data.user.role,
            mobile_number: data.user.mobile_number,
            shop_number: data.user.shop_number || '11066',
          };
          this.saveSession(user, data.access_token);
          return user;
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || 'Invalid username/mobile or password.');
        }
      } catch (err) {
        if (!err.message.includes('Invalid')) {
          console.warn('Backend unreachable, checking offline credentials...');
        } else {
          throw err;
        }
      }
    }

    // Local / Offline Verification
    if (
      (trimmedId.toLowerCase() === 'annadurai' || trimmedId === '9842111066') &&
      (trimmedPass === '11066' || trimmedPass === 'admin11066' || trimmedPass === 'tasmac11066')
    ) {
      const offlineAdmin = {
        id: 1,
        username: 'annadurai',
        name: 'ANNADURAI M',
        role: 'ADMIN',
        mobile_number: '9842111066',
        shop_number: '11066',
      };
      this.saveSession(offlineAdmin, null);
      return offlineAdmin;
    }

    throw new Error('Invalid username/mobile number or password. For Admin access use: annadurai / 11066');
  },

  logout() {
    // Switch to View-Only guest session
    const guestUser = {
      id: 0,
      username: 'staff_guest',
      name: 'Staff / Viewer',
      role: 'VIEW_ONLY',
      mobile_number: '',
      shop_number: '11066',
    };
    this.saveSession(guestUser, null);
    if (window.App) {
      window.App.showToast('Switched to View-Only access mode.', 'info');
    }
  },

  getApiUrl() {
    const custom = localStorage.getItem('tasmac_cloud_api_url');
    if (custom && custom.startsWith('http')) return custom.replace(/\/$/, '');
    if (window.location.protocol.startsWith('http')) {
      return window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
        ? 'http://localhost:8000'
        : window.location.origin;
    }
    return null;
  },

  resetToLocalOnly() {
    localStorage.removeItem('tasmac_cloud_api_url');
    const inp = document.getElementById('cloud-api-url-input');
    if (inp) inp.value = '';
    const resBox = document.getElementById('cloud-test-result');
    if (resBox) {
      resBox.style.display = 'block';
      resBox.style.background = '#e8f5e9';
      resBox.style.color = '#145a32';
      resBox.textContent = 'Switched to 100% Standalone Local Database Mode.';
    }
    if (window.SyncManager) {
      window.SyncManager.cloudConnected = false;
      window.SyncManager.triggerSync();
    }
    if (window.App) {
      window.App.showToast('Reset to Standalone Local Database Mode.', 'info');
    }
  },

  getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
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

  openLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
      modal.style.display = 'flex';
      const userInp = document.getElementById('login-identifier');
      if (userInp) {
        userInp.value = '';
        userInp.focus();
      }
      const passInp = document.getElementById('login-password');
      if (passInp) passInp.value = '';
      const errBox = document.getElementById('login-error-msg');
      if (errBox) errBox.style.display = 'none';
    }
  },

  closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
  },

  async handleLoginFormSubmit(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('login-identifier').value;
    const pass = document.getElementById('login-password').value;
    const errBox = document.getElementById('login-error-msg');
    const submitBtn = document.getElementById('login-submit-btn');

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';
      }
      if (errBox) errBox.style.display = 'none';

      await this.login(id, pass);
      this.closeLoginModal();
      if (window.App) {
        window.App.showToast(`Logged in successfully as ${this.currentUser.name} (${this.currentUser.role})`, 'success');
        window.App.refreshAllData();
      }
    } catch (err) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = err.message || 'Login failed. Please check credentials.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
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
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px;">Loading staff accounts...</td></tr>`;

    try {
      let users = [];
      const res = await fetch(`${this.getApiUrl()}/api/users`, {
        headers: this.getAuthHeaders(),
      });
      if (res.ok) {
        users = await res.json();
      } else {
        // Fallback to primary admin representation
        users = [
          {
            id: 1,
            username: 'annadurai',
            name: 'ANNADURAI M',
            role: 'ADMIN',
            mobile_number: '9842111066',
            is_active: true,
          },
        ];
      }

      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px;">No staff accounts registered yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = users
        .map((u) => {
          const isPrimary = u.username === 'annadurai';
          const roleBadge =
            u.role === 'ADMIN'
              ? `<span style="background:#d4af37; color:#0e3820; padding:2px 8px; border-radius:12px; font-weight:800; font-size:12px;">👑 ADMIN</span>`
              : `<span style="background:#e8f5e9; color:#145a32; padding:2px 8px; border-radius:12px; font-weight:800; font-size:12px;">👁️ VIEW-ONLY</span>`;

          const statusBadge = u.is_active
            ? `<span style="color:#27ae60; font-weight:700;">🟢 Active</span>`
            : `<span style="color:#c0392b; font-weight:700;">🔴 Inactive</span>`;

          const actionBtns = isPrimary
            ? `<span style="color:#888; font-size:12px; font-weight:600;">Primary Admin (Protected)</span>`
            : `<button class="btn btn-sm btn-secondary" onclick="AuthManager.toggleUserActive(${u.id}, ${!u.is_active})">
                 ${u.is_active ? 'Deactivate' : 'Activate'}
               </button>
               <button class="btn btn-sm btn-gold" style="margin-left:4px;" onclick="AuthManager.promptResetPassword(${u.id}, '${u.name}')">
                 Reset PIN
               </button>`;

          return `
            <tr style="border-bottom:1px solid #e0e0e0;">
              <td style="padding:10px 12px; font-weight:700;">${u.name}</td>
              <td style="padding:10px 12px;">${u.mobile_number || '-'}</td>
              <td style="padding:10px 12px;">${roleBadge}</td>
              <td style="padding:10px 12px;">${statusBadge}</td>
              <td style="padding:10px 12px; text-align:right;">${actionBtns}</td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      console.error('Error loading users:', err);
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#c0392b; padding:18px;">Unable to load users: ${err.message}</td></tr>`;
    }
  },

  async handleCreateStaffSubmit(e) {
    if (e) e.preventDefault();
    if (!this.isAdmin()) return;

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
        errBox.textContent = 'All fields (Name, Mobile Number, Password) are required.';
      }
      return;
    }

    try {
      if (errBox) errBox.style.display = 'none';
      const username = name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + mobile.slice(-4);

      const res = await fetch(`${this.getApiUrl()}/api/users`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          username,
          name,
          mobile_number: mobile,
          password: pass,
          role: 'VIEW_ONLY', // Strictly forced to VIEW_ONLY!
          shop_number: '11066',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to create staff account.');
      }

      nameInp.value = '';
      mobileInp.value = '';
      passInp.value = '';
      if (window.App) {
        window.App.showToast(`Staff account for ${name} created with View-Only access!`, 'success');
      }
      await this.loadUsersTable();
    } catch (err) {
      if (errBox) {
        errBox.style.display = 'block';
        errBox.textContent = err.message;
      }
    }
  },

  async toggleUserActive(userId, newStatus) {
    try {
      const res = await fetch(`${this.getApiUrl()}/api/users/${userId}/status?is_active=${newStatus}`, {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Could not update user status.');
      }
      if (window.App) {
        window.App.showToast(`User status updated to ${newStatus ? 'Active' : 'Inactive'}`, 'success');
      }
      await this.loadUsersTable();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  },

  async promptResetPassword(userId, name) {
    const newPass = prompt(`Enter new Password / PIN for staff member "${name}":`);
    if (!newPass || !newPass.trim()) return;

    try {
      const res = await fetch(`${this.getApiUrl()}/api/users/${userId}/reset-password`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ new_password: newPass.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to reset password.');
      }
      if (window.App) {
        window.App.showToast(`Password for ${name} reset successfully!`, 'success');
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
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

