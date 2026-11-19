/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Module 2: Vendor Bottle Management
 * ONE COMMON BOTTLE INVENTORY, Cumulative Available, Vendor Collected, Remaining
 * Warning if collected exceeds available, unified date-wise history, automatic recalculation
 */

const Module2Bottles = {
  init() {
    this.bindEvents();
    this.refresh();
  },

  bindEvents() {
    const filterStart = document.getElementById('bot-filter-start');
    const filterEnd = document.getElementById('bot-filter-end');

    if (filterStart) filterStart.addEventListener('change', () => this.renderHistory());
    if (filterEnd) filterEnd.addEventListener('change', () => this.renderHistory());

    const btnResetFilter = document.getElementById('bot-btn-reset-filter');
    if (btnResetFilter) {
      btnResetFilter.addEventListener('click', () => {
        if (filterStart) filterStart.value = '';
        if (filterEnd) filterEnd.value = '';
        this.renderHistory();
      });
    }

    const exportExcelBtn = document.getElementById('bot-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => this.exportExcel());
    }

    const exportPdfBtn = document.getElementById('bot-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => this.exportPDF());
    }

    const exportBtBtn = document.getElementById('bot-export-bt');
    if (exportBtBtn) {
      exportBtBtn.addEventListener('click', () => this.printBluetooth());
    }
  },

  async refresh() {
    await this.renderSummaryCards();
    await this.renderHistory();
  },

  async renderSummaryCards() {
    const summary = await window.tasmacDB.getInventorySummary();

    // 1. Total Buy Back Return Bottles
    const elAvailable = document.getElementById('bot-card-available');
    if (elAvailable) elAvailable.textContent = `${summary.total_available_bottles} Bottles`;

    // Initial starting date
    const elStartDate = document.getElementById('bot-card-start-date');
    if (elStartDate) {
      elStartDate.textContent = summary.initial_recorded_date
        ? `Since ${summary.initial_recorded_date}`
        : 'No records yet';
    }

    // 2. Total Vendor Empty Collected Bottles
    const elCollected = document.getElementById('bot-card-collected');
    if (elCollected) elCollected.textContent = `${summary.total_vendor_collected_bottles} Bottles`;

    // 3. Remaining Bottles Available
    const elRemaining = document.getElementById('bot-card-remaining');
    if (elRemaining) elRemaining.textContent = `${summary.remaining_bottles} Bottles`;

    // Check warning on negative / deficit
    const warningBox = document.getElementById('bot-warning-banner');
    if (warningBox) {
      if (summary.has_warning) {
        warningBox.style.display = 'flex';
        warningBox.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <b>INVENTORY WARNING:</b> Total vendor collected bottles (${summary.total_vendor_collected_bottles})
            exceed available bottles (${summary.total_available_bottles}) by ${Math.abs(summary.remaining_bottles)} bottles!
            Please verify remittance return entries and vendor receipts.
          </div>
        `;
      } else {
        warningBox.style.display = 'none';
      }
    }
  },

  async renderHistory() {
    const tableBody = document.getElementById('bot-history-tbody');
    const mobileContainer = document.getElementById('bot-history-mobile');
    if (!tableBody || !mobileContainer) return;

    const startDate = document.getElementById('bot-filter-start')?.value || null;
    const endDate = document.getElementById('bot-filter-end')?.value || null;

    const history = await window.tasmacDB.getBottleHistory(startDate, endDate);

    if (history.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 24px; color: #777;">No bottle inventory records found.</td></tr>`;
      mobileContainer.innerHTML = `<div class="text-center" style="padding: 24px; color: #777;">No bottle inventory records found.</div>`;
      return;
    }

    // Render Table
    tableBody.innerHTML = history
      .map(
        (h) => `
        <tr>
          <td class="fw-bold">${h.date}</td>
          <td class="text-right" style="color: #27ae60; font-weight: 700;">+${h.buy_back_return_bottles}</td>
          <td class="text-right" style="color: #c0392b; font-weight: 700;">-${h.vendor_collected_bottles}</td>
          <td class="text-right fw-bold" style="font-size: 15px; color: ${h.remaining_bottles < 0 ? '#c0392b' : '#0e3820'};">
            ${h.remaining_bottles}
          </td>
        </tr>`
      )
      .join('');

    // Render Mobile Cards
    mobileContainer.innerHTML = history
      .map(
        (h) => `
        <div class="history-card-item">
          <div class="history-card-header">
            <div class="history-card-date">📅 ${h.date}</div>
            <div class="fw-bold" style="font-size: 15px; color: ${h.remaining_bottles < 0 ? '#c0392b' : '#0e3820'};">
              Remaining: ${h.remaining_bottles}
            </div>
          </div>
          <div class="history-card-grid">
            <div class="history-card-row">
              <span class="label">Return Received (Mod 1)</span>
              <span class="value" style="color: #27ae60;">+${h.buy_back_return_bottles} Bottles</span>
            </div>
            <div class="history-card-row">
              <span class="label">Vendor Collected (Mod 3)</span>
              <span class="value" style="color: #c0392b;">-${h.vendor_collected_bottles} Bottles</span>
            </div>
          </div>
        </div>`
      )
      .join('');
  },

  async exportExcel() {
    const history = await window.tasmacDB.getBottleHistory();
    if (history.length === 0) {
      App.showToast('No history to export.', 'error');
      return;
    }

    const headers = [
      'Date',
      'Buy Back Return Bottles (+)',
      'Vendor Collected Bottles (-)',
      'Remaining Balance',
      'Cumulative Available',
      'Cumulative Collected',
    ];

    const rows = history.map((h) => [
      h.date,
      h.buy_back_return_bottles,
      h.vendor_collected_bottles,
      h.remaining_bottles,
      h.cumulative_available,
      h.cumulative_collected,
    ]);

    ExportUtils.downloadCSV('TASMAC_Shop11066_Bottle_Inventory_History', headers, rows);
    App.showToast('Bottle inventory exported to Excel successfully!', 'success');
  },

  async exportPDF() {
    const summary = await window.tasmacDB.getInventorySummary();
    const history = await window.tasmacDB.getBottleHistory();

    let totReturn = 0;
    let totCollected = 0;

    const tableRows = history
      .map((h) => {
        totReturn += parseInt(h.buy_back_return_bottles) || 0;
        totCollected += parseInt(h.vendor_collected_bottles) || 0;
        const remVal = parseInt(h.remaining_bottles) || 0;

        return `
        <tr>
          <td><b>${h.date}</b></td>
          <td class="text-right" style="color: #1e8449; font-weight: 700;">+${h.buy_back_return_bottles}</td>
          <td class="text-right" style="color: #c0392b; font-weight: 700;">-${h.vendor_collected_bottles}</td>
          <td class="text-right fw-bold" style="color: ${remVal < 0 ? '#c0392b' : '#0e3820'};">${h.remaining_bottles} Bottles</td>
        </tr>`;
      })
      .join('');

    const html = `
      <div class="a4-header">
        <div class="a4-org-title">TAMIL NADU STATE MARKETING CORPORATION LIMITED (TASMAC)</div>
        <div class="a4-shop-title">SHOP NO. 11066 – IN-CHARGE: ANNADURAI M</div>
        <div class="a4-report-name">UNIFIED BOTTLE INVENTORY & STOCK AUDIT REPORT</div>
      </div>

      <div class="a4-meta-bar">
        <div><b>Bottle Management:</b> One Common Pool</div>
        <div><b>Shop Number:</b> 11066</div>
        <div><b>Audit Date:</b> ${new Date().toLocaleString()}</div>
        <div><b>Baseline Date:</b> ${summary.initial_recorded_date || 'Initial'}</div>
      </div>

      <!-- Inventory KPI Status Cards -->
      <div class="a4-kpi-grid">
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Total Buy Back Return (+)</div>
          <div class="a4-kpi-value">${summary.total_available_bottles} Bottles</div>
        </div>
        <div class="a4-kpi-card danger">
          <div class="a4-kpi-label">Total Vendor Empty Collected (-)</div>
          <div class="a4-kpi-value">${summary.total_vendor_collected_bottles} Bottles</div>
        </div>
        <div class="a4-kpi-card ${summary.remaining_bottles < 0 ? 'danger' : 'gold'}">
          <div class="a4-kpi-label">Remaining Balance Available</div>
          <div class="a4-kpi-value">${summary.remaining_bottles} Bottles</div>
        </div>
      </div>

      <!-- History Register Table -->
      <div class="a4-section-title">CHRONOLOGICAL BOTTLE STOCK LEDGER</div>
      <table class="a4-table">
        <thead>
          <tr>
            <th style="width: 25%;">Transaction Date</th>
            <th style="width: 25%;" class="text-right">Buy Back Return (+)</th>
            <th style="width: 25%;" class="text-right">Vendor Collected (-)</th>
            <th style="width: 25%;" class="text-right">Remaining Balance Available</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr>
            <td>CUMULATIVE TOTALS:</td>
            <td class="text-right">+${totReturn}</td>
            <td class="text-right">-${totCollected}</td>
            <td class="text-right">${summary.remaining_bottles} Bottles</td>
          </tr>
        </tfoot>
      </table>

      <!-- Signatures Block -->
      <div class="a4-signatures">
        <div class="a4-sign-box">
          <div>SHOP IN-CHARGE SIGNATURE</div>
          <div class="a4-sign-role">ANNADURAI M (Shop No. 11066)</div>
        </div>
        <div class="a4-sign-box">
          <div>STOCK VERIFICATION OFFICER</div>
          <div class="a4-sign-role">TASMAC Inventory & Audit Cell</div>
        </div>
      </div>

      <div class="a4-footer">
        <div>Generated: ${new Date().toLocaleString()} | Official Inventory Record</div>
        <div>Page 1 of 1 | TASMAC Shop Management System</div>
      </div>
    `;

    ExportUtils.printContent('TASMAC_Bottle_Inventory_Report', html, false);
  },

  async printBluetooth() {
    const summary = await window.tasmacDB.getInventorySummary();
    const history = await window.tasmacDB.getBottleHistory();
    const escText = ExportUtils.buildBottleInventoryEscPos(summary, history);
    BluetoothPrintManager.printOrPrompt(escText);
  },
};

window.Module2Bottles = Module2Bottles;

