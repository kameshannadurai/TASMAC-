/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Automatic Internet & Multi-Device Synchronization Engine
 * Offline-First with Automatic Background Delta Pull & Push Sync
 */

const SyncManager = {
  isOnline: navigator.onLine,
  cloudConnected: false,
  isSyncing: false,
  lastSyncTime: null,
  timerId: null,
  syncIntervalMs: 15000, // 15 seconds

  init() {
    this.bindNetworkEvents();
    this.updateStatusBadge();
    this.startAutoSync();

    // Trigger initial sync after slight delay for DB readiness
    setTimeout(() => {
      this.triggerSync();
    }, 1200);

    // Periodically update the "Last sync: X min ago" text
    setInterval(() => {
      this.updateTimeDisplay();
    }, 25000);
  },

  getApiUrl() {
    if (window.ApiConfig && typeof window.ApiConfig.getBaseUrl === 'function') {
      return window.ApiConfig.getBaseUrl();
    }
    if (window.AuthManager && window.AuthManager.getApiUrl) {
      const authUrl = window.AuthManager.getApiUrl();
      if (authUrl && authUrl.startsWith('http')) return authUrl;
    }
    const custom = localStorage.getItem('tasmac_cloud_api_url');
    if (custom && custom.startsWith('http')) return custom.replace(/\/$/, '');

    // Web browser environment on http/https
    if (window.location && window.location.protocol && window.location.protocol.startsWith('http')) {
      return window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
        ? 'http://localhost:8000'
        : window.location.origin;
    }

    return 'https://tasmac-shop-11066-backend.onrender.com';
  },

  bindNetworkEvents() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateStatusBadge();
      if (window.App) {
        window.App.showToast('Internet connection active. Synchronizing data...', 'info');
      }
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.cloudConnected = false;
      this.updateStatusBadge();
      if (window.App) {
        window.App.showToast('Device offline. 100% Offline Local DB active.', 'info');
      }
    });

    window.addEventListener('focus', () => {
      if (navigator.onLine) {
        this.isOnline = true;
        this.triggerSync();
      }
    });

    // Foreground return via Page Visibility API
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.isOnline = true;
        this.triggerSync();
      }
    });

    // Capacitor / Cordova app resume event
    document.addEventListener('resume', () => {
      if (navigator.onLine) {
        this.isOnline = true;
        this.triggerSync();
      }
    });
  },

  startAutoSync() {
    if (this.timerId) clearInterval(this.timerId);
    const configuredSec = parseInt(localStorage.getItem('tasmac_sync_interval_seconds')) || 15;
    this.syncIntervalMs = configuredSec * 1000;

    this.timerId = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.triggerSync();
      }
    }, this.syncIntervalMs);
  },

  async triggerSync() {
    if (this.isSyncing) return;
    this.isOnline = navigator.onLine;

    const apiUrl = this.getApiUrl();

    // Standalone Local Mode (e.g. Android APK before cloud server URL is entered)
    if (!apiUrl) {
      this.cloudConnected = false;
      this.updateStatusBadge();
      return;
    }

    this.isSyncing = true;
    this.updateStatusBadge('syncing');

    let pulledCount = 0;
    let pushedCount = 0;

    try {
      // -------------------------------------------------------------
      // STEP 1: PUSH PENDING MUTATIONS (Admin Only)
      // -------------------------------------------------------------
      const pendingQueue = await window.tasmacDB.getPendingSyncQueue();
      if (pendingQueue && pendingQueue.length > 0) {
        if (window.AuthManager && window.AuthManager.isAdmin()) {
          const deviceId = localStorage.getItem('tasmac_device_id') || ('device_' + Math.random().toString(36).substr(2, 8));
          localStorage.setItem('tasmac_device_id', deviceId);

          const formattedMutations = pendingQueue.map((item) => ({
            table: item.table || (item.entity_type === 'REMITTANCE' ? 'remittances' : 'vendor_receipts'),
            action: item.action,
            data: item.data,
            client_mutation_id: item.client_mutation_id || `mut_${item.id}_${item.created_at || Date.now()}`,
          }));

          const resPush = await fetch(`${apiUrl}/api/sync/push`, {
            method: 'POST',
            headers: window.AuthManager.getAuthHeaders(),
            body: JSON.stringify({
              mutations: formattedMutations,
              device_id: deviceId,
            }),
          });

          if (resPush.ok) {
            const pushResult = await resPush.json();
            pushedCount = pushResult.applied_count || pushResult.applied || 0;
            // Clean processed queue items
            for (const item of pendingQueue) {
              await window.tasmacDB.removeSyncQueueItem(item.id);
            }
          } else if (resPush.status === 403) {
            console.warn('Push sync rejected (Forbidden). Non-admin cannot push mutations.');
          }
        }
      }

      // -------------------------------------------------------------
      // STEP 2: PULL REMOTE UPDATES (All Authorized Phones)
      // -------------------------------------------------------------
      const lastSyncTimestamp = localStorage.getItem('tasmac_last_sync_timestamp') || '';
      const pullUrl = lastSyncTimestamp
        ? `${apiUrl}/api/sync/pull?since=${encodeURIComponent(lastSyncTimestamp)}`
        : `${apiUrl}/api/sync/pull`;

      const headers = window.AuthManager ? window.AuthManager.getAuthHeaders() : { 'Content-Type': 'application/json' };
      const resPull = await fetch(pullUrl, { headers });

      if (resPull.ok) {
        const pullData = await resPull.json();

        // 1. Ingest Remittances
        if (pullData.remittances && pullData.remittances.length > 0) {
          for (const rem of pullData.remittances) {
            await window.tasmacDB.saveRemittanceFromSync(rem);
            pulledCount++;
          }
        }

        // 2. Ingest Vendor Receipts
        if (pullData.vendor_receipts && pullData.vendor_receipts.length > 0) {
          for (const rc of pullData.vendor_receipts) {
            await window.tasmacDB.saveVendorReceiptFromSync(rc);
            pulledCount++;
          }
        }

        // Store sync timestamp
        const nowIso = pullData.current_timestamp || new Date().toISOString();
        localStorage.setItem('tasmac_last_sync_timestamp', nowIso);
        this.lastSyncTime = new Date(nowIso);
        this.cloudConnected = true;
        this.isOnline = true;
        this.updateStatusBadge('success');

        // Refresh UI view if new data was ingested
        if (pulledCount > 0 || pushedCount > 0) {
          if (window.App) {
            window.App.refreshAllData();
          }
        }
      } else {
        this.cloudConnected = false;
        this.updateStatusBadge('cloud_error');
      }
    } catch (err) {
      console.warn('Sync connection error:', err);
      this.cloudConnected = false;
      this.isOnline = navigator.onLine;
      this.updateStatusBadge('offline');
    } finally {
      this.isSyncing = false;
    }
  },

  updateStatusBadge(state) {
    const pill = document.getElementById('sync-status-badge');
    const labelEl = document.getElementById('sync-status-label');
    if (!pill) return;

    if (state === 'syncing') {
      pill.className = 'badge-sync state-syncing';
      pill.innerHTML = `
        <span class="badge-dot dot-syncing"></span>
        <span id="sync-status-label">SYNCING...</span>
      `;
    } else if (this.cloudConnected) {
      pill.className = 'badge-sync state-online';
      pill.innerHTML = `
        <span class="badge-dot dot-online"></span>
        <span id="sync-status-label">ONLINE · ☁️ Synced</span>
      `;
    } else if (this.isOnline) {
      pill.className = 'badge-sync state-online';
      pill.innerHTML = `
        <span class="badge-dot dot-online"></span>
        <span id="sync-status-label">ONLINE · 💾 Local DB</span>
      `;
    } else {
      pill.className = 'badge-sync state-offline';
      pill.innerHTML = `
        <span class="badge-dot dot-offline"></span>
        <span id="sync-status-label">OFFLINE · 💾 Local DB</span>
      `;
    }

    this.updateTimeDisplay();
  },

  updateTimeDisplay() {
    const timeEl = document.getElementById('sync-last-time');
    if (!timeEl) return;

    if (!this.lastSyncTime) {
      const stored = localStorage.getItem('tasmac_last_sync_timestamp');
      if (stored) {
        this.lastSyncTime = new Date(stored);
      }
    }

    if (!this.lastSyncTime) {
      timeEl.textContent = this.isOnline ? 'Sync: Ready' : 'Sync: Offline Mode';
      return;
    }

    const diffMs = Date.now() - this.lastSyncTime.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 45) {
      timeEl.textContent = 'Sync: Just now';
    } else if (diffMin < 60) {
      timeEl.textContent = `Sync: ${diffMin}m ago`;
    } else {
      const diffHours = Math.floor(diffMin / 60);
      timeEl.textContent = `Sync: ${diffHours}h ago`;
    }
  },

  async testCloudConnection(candidateUrl) {
    const url = (candidateUrl || this.getApiUrl() || '').trim().replace(/\/$/, '');
    if (!url || !url.startsWith('http')) {
      throw new Error('Please enter a valid HTTP/HTTPS URL (e.g. http://192.168.1.100:8000).');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { success: true, data };
      } else {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Connection timed out after 6 seconds. Please verify the IP/port and ensure the phone is on the same Wi-Fi network.');
      }
      throw err;
    }
  },

  async testFromModal() {
    const urlInp = document.getElementById('cloud-api-url-input');
    const resultBox = document.getElementById('cloud-test-result');
    if (!urlInp || !resultBox) return;

    const url = (urlInp.value || '').trim();
    if (!url) {
      resultBox.style.display = 'block';
      resultBox.style.background = '#fbeee6';
      resultBox.style.color = '#c0392b';
      resultBox.textContent = 'Please enter a Cloud or Host IP URL to test.';
      return;
    }

    resultBox.style.display = 'block';
    resultBox.style.background = '#fef9e7';
    resultBox.style.color = '#b89325';
    resultBox.textContent = 'Testing connection to server...';

    try {
      if (window.ApiConfig && typeof window.ApiConfig.testConnection === 'function') {
        const testRes = await window.ApiConfig.testConnection(url);
        if (testRes.success) {
          resultBox.style.background = '#e8f5e9';
          resultBox.style.color = '#145a32';
          resultBox.textContent = `✅ ${testRes.message}`;
          this.cloudConnected = true;
          this.updateStatusBadge();
        } else {
          resultBox.style.background = '#fbeee6';
          resultBox.style.color = '#c0392b';
          resultBox.textContent = `❌ ${testRes.message}`;
        }
      } else {
        await this.testCloudConnection(url);
        resultBox.style.background = '#e8f5e9';
        resultBox.style.color = '#145a32';
        resultBox.textContent = '✅ Connected successfully! TASMAC Server is active and reachable.';
        this.cloudConnected = true;
        this.updateStatusBadge();
      }
    } catch (err) {
      resultBox.style.background = '#fbeee6';
      resultBox.style.color = '#c0392b';
      resultBox.textContent = `❌ ${err.message}`;
    }
  },
};

window.SyncManager = SyncManager;
