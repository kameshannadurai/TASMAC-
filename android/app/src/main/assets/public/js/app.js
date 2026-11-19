/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Main Application Coordinator
 * Splash screen, view routing, live dashboard, toast alerts
 */

const App = {
  currentView: 'dashboard',

  async init() {
    this.handleSplashScreen();
    this.bindNavigation();
    this.initPWA();
    await window.tasmacDB.ready();

    // Initialize Security & Cloud Sync
    if (window.AuthManager) window.AuthManager.init();
    if (window.SyncManager) window.SyncManager.init();

    // Initialize sub-modules
    Module1Remittance.init();
    Module2Bottles.init();
    Module3Vendor.init();
    ReportsView.init();
    BackupManager.init();

    await this.refreshAllData();
  },

  handleSplashScreen() {
    const splash = document.getElementById('splash-screen');
    const skipBtn = document.getElementById('splash-btn-skip');

    const dismissSplash = () => {
      if (splash && !splash.classList.contains('fade-out')) {
        splash.classList.add('fade-out');
        setTimeout(() => {
          splash.style.display = 'none';
        }, 600);
      }
    };

    if (skipBtn) {
      skipBtn.addEventListener('click', dismissSplash);
    }

    // Auto-dismiss after 2 seconds for smooth opening experience
    setTimeout(dismissSplash, 2100);
  },

  bindNavigation() {
    // Mobile bottom navigation items & desktop header buttons
    const navButtons = document.querySelectorAll('[data-nav-target]');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const targetView = btn.dataset.navTarget;
        this.navigateTo(targetView);
      });
    });

    // 3 Large Navigation Cards on Home Dashboard
    const optRemittance = document.getElementById('nav-card-remittance');
    if (optRemittance) {
      optRemittance.addEventListener('click', () => this.navigateTo('remittance'));
    }

    const optBottles = document.getElementById('nav-card-bottles');
    if (optBottles) {
      optBottles.addEventListener('click', () => this.navigateTo('bottles'));
    }

    const optVendor = document.getElementById('nav-card-vendor');
    if (optVendor) {
      optVendor.addEventListener('click', () => this.navigateTo('vendor'));
    }
  },

  navigateTo(viewName) {
    this.currentView = viewName;

    // Toggle active view sections
    document.querySelectorAll('.view-section').forEach((sec) => {
      sec.classList.remove('active');
    });

    const activeSec = document.getElementById(`view-${viewName}`);
    if (activeSec) {
      activeSec.classList.add('active');
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      if (document.documentElement) document.documentElement.scrollLeft = 0;
      if (document.body) document.body.scrollLeft = 0;
    }

    // Update nav buttons active state
    document.querySelectorAll('[data-nav-target]').forEach((btn) => {
      if (btn.dataset.navTarget === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Refresh data on view change
    if (viewName === 'dashboard') {
      this.refreshDashboard();
    } else if (viewName === 'remittance') {
      Module1Remittance.renderHistory();
    } else if (viewName === 'bottles') {
      Module2Bottles.refresh();
    } else if (viewName === 'vendor') {
      Module3Vendor.renderHistory();
    } else if (viewName === 'reports') {
      ReportsView.loadReports();
    }
  },

  async refreshDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const stats = await window.tasmacDB.getDashboardStats(today);

    // Today Date
    const dObj = new Date();
    const formattedDate = `${String(dObj.getDate()).padStart(2, '0')}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${dObj.getFullYear()}`;
    const elDate = document.getElementById('dash-today-date');
    if (elDate) elDate.textContent = formattedDate;

    // Today's Total Sales
    const elSales = document.getElementById('dash-today-sales');
    if (elSales) elSales.textContent = ExportUtils.formatINR(stats.today_total_sales);

    // Today's Buy Back Return Bottles
    const elTodayBot = document.getElementById('dash-today-returns');
    if (elTodayBot) elTodayBot.textContent = `${stats.today_return_bottles} Bottles`;

    // Total Available Bottles
    const elAvail = document.getElementById('dash-total-available');
    if (elAvail) elAvail.textContent = `${stats.total_available_bottles} Bottles`;

    // Total Vendor Empty Collected Bottles
    const elColl = document.getElementById('dash-total-collected');
    if (elColl) elColl.textContent = `${stats.total_vendor_collected_bottles} Bottles`;

    // Remaining Bottles
    const elRem = document.getElementById('dash-remaining-bottles');
    if (elRem) {
      elRem.textContent = `${stats.remaining_bottles} Bottles`;
      elRem.style.color = stats.remaining_bottles < 0 ? '#c0392b' : '#0e3820';
    }

    // Warning Banner on Dashboard
    const warnBox = document.getElementById('dash-warning-box');
    if (warnBox) {
      if (stats.has_warning) {
        warnBox.style.display = 'flex';
        warnBox.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>${stats.warning_message}</div>
        `;
      } else {
        warnBox.style.display = 'none';
      }
    }
  },

  async refreshAllData() {
    await this.refreshDashboard();
    await Module2Bottles.refresh();
    if (window.AuthManager) window.AuthManager.applyRoleRestrictions();
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s, transform 0.4s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 400);
    }, 3200);
  },

  initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('./sw.js')
          .then((reg) => console.log('Offline Service Worker Registered:', reg.scope))
          .catch((err) => console.log('Service Worker registration skipped:', err));
      });
    }
  },
};

window.App = App;

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

