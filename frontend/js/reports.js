/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Reports & Analytics Section
 * Aggregated metrics, Date Range Filters, Vendor Breakdown, Print & Excel Export
 */

const ReportsView = {
  init() {
    this.bindEvents();
    this.setDefaultDates();
  },

  setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0];

    const startInput = document.getElementById('rep-filter-start');
    const endInput = document.getElementById('rep-filter-end');

    if (startInput && !startInput.value) startInput.value = firstDayOfMonth;
    if (endInput && !endInput.value) endInput.value = today;

    this.loadReports();
  },

  bindEvents() {
    const applyBtn = document.getElementById('rep-btn-apply');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.loadReports());
    }

    const exportExcelBtn = document.getElementById('rep-btn-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => this.exportExcel());
    }

    const printBtn = document.getElementById('rep-btn-print');
    if (printBtn) {
      printBtn.addEventListener('click', () => this.printReport());
    }

    const btBtn = document.getElementById('rep-btn-bt');
    if (btBtn) {
      btBtn.addEventListener('click', () => this.printBluetooth());
    }
  },

  async loadReports() {
    const startDate = document.getElementById('rep-filter-start')?.value || null;
    const endDate = document.getElementById('rep-filter-end')?.value || null;

    const remittances = await window.tasmacDB.getAllRemittances();
    const receipts = await window.tasmacDB.getAllVendorReceipts();
    const invSummary = await window.tasmacDB.getInventorySummary();

    // Filter Remittances
    const filteredRem = remittances.filter((r) => {
      if (startDate && r.date < startDate) return false;
      if (endDate && r.date > endDate) return false;
      return true;
    });

    // Filter Receipts
    const filteredRec = receipts.filter((r) => {
      if (startDate && r.receipt_date < startDate) return false;
      if (endDate && r.receipt_date > endDate) return false;
      return true;
    });

    // Remittance Aggregates
    let totalSales = 0;
    let totalUpi = 0;
    let totalCard = 0;
    let totalOnline = 0;
    let totalScan = 0;
    let totalCash = 0;
    let totalAllPayments = 0;
    let totalSoldBottles = 0;
    let totalReturnBottles = 0;

    for (const r of filteredRem) {
      totalSales += r.total_sales_amount || 0;
      totalUpi += r.upi_amount || 0;
      totalCard += r.card_amount || 0;
      totalOnline += r.online_amount || 0;
      totalScan += r.scan_amount || 0;
      totalCash += r.cash_sales || 0;
      totalAllPayments += r.total_all_payments || 0;
      totalSoldBottles += r.buy_back_sold_bottle || 0;
      totalReturnBottles += r.buy_back_return_bottle || 0;
    }

    // Vendor Aggregates
    let vendorBottles = 0;
    let vendorPayable = 0;
    const vendorMap = new Map();

    for (const rc of filteredRec) {
      vendorBottles += rc.total_bottles || 0;
      vendorPayable += rc.total_payable || 0;

      const vName = rc.vendor_name || 'Vendor';
      if (!vendorMap.has(vName)) {
        vendorMap.set(vName, { receipts: 0, bottles: 0, payable: 0 });
      }
      const item = vendorMap.get(vName);
      item.receipts += 1;
      item.bottles += rc.total_bottles || 0;
      item.payable += rc.total_payable || 0;
    }

    // Render Stats to DOM
    this.setText('rep-total-sales', ExportUtils.formatINR(totalSales));
    this.setText('rep-all-payments', ExportUtils.formatINR(totalAllPayments));
    this.setText('rep-cash-sales', ExportUtils.formatINR(totalCash));
    this.setText('rep-upi-card', `${ExportUtils.formatINR(totalUpi)} / ${ExportUtils.formatINR(totalCard)}`);
    this.setText('rep-scan-online', `${ExportUtils.formatINR(totalScan)} / ${ExportUtils.formatINR(totalOnline)}`);
    this.setText('rep-bottle-flow', `+${totalReturnBottles} Ret / -${totalSoldBottles} Sold`);

    // Bottles
    this.setText('rep-inv-available', `${invSummary.total_available_bottles} Bottles`);
    this.setText('rep-inv-collected', `${invSummary.total_vendor_collected_bottles} Bottles`);
    this.setText('rep-inv-remaining', `${invSummary.remaining_bottles} Bottles`);

    // Vendor table
    const venTbody = document.getElementById('rep-vendor-breakdown-tbody');
    if (venTbody) {
      const vendorList = Array.from(vendorMap.entries()).sort((a, b) => b[1].bottles - a[1].bottles);
      if (vendorList.length === 0) {
        venTbody.innerHTML = `<tr><td colspan="4" class="text-center" style="padding: 16px; color: #777;">No vendor receipts in this period.</td></tr>`;
      } else {
        venTbody.innerHTML = vendorList
          .map(
            ([name, data]) => `
          <tr>
            <td class="fw-bold">${name}</td>
            <td class="text-center">${data.receipts} Receipts</td>
            <td class="text-right fw-bold" style="color: #c0392b;">${data.bottles} Bottles</td>
            <td class="text-right fw-bold" style="color: #0e3820;">${ExportUtils.formatINR(data.payable)}</td>
          </tr>`
          )
          .join('');
      }
    }
  },

  setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  async exportExcel() {
    const startDate = document.getElementById('rep-filter-start')?.value || 'All';
    const endDate = document.getElementById('rep-filter-end')?.value || 'All';

    const remittances = await window.tasmacDB.getAllRemittances();
    const receipts = await window.tasmacDB.getAllVendorReceipts();

    // Build consolidated summary CSV
    const headers = ['Category', 'Metric', 'Value'];
    const rows = [
      ['Date Range', 'Filter Period', `${startDate} to ${endDate}`],
      ['Remittance', 'Total Sales Amount', document.getElementById('rep-total-sales')?.textContent || ''],
      ['Remittance', 'Total All Payments', document.getElementById('rep-all-payments')?.textContent || ''],
      ['Remittance', 'Cash Sales', document.getElementById('rep-cash-sales')?.textContent || ''],
      ['Remittance', 'UPI & Card', document.getElementById('rep-upi-card')?.textContent || ''],
      ['Remittance', 'Scan & Online', document.getElementById('rep-scan-online')?.textContent || ''],
      ['Inventory', 'Total Available Bottles', document.getElementById('rep-inv-available')?.textContent || ''],
      ['Inventory', 'Total Vendor Collected', document.getElementById('rep-inv-collected')?.textContent || ''],
      ['Inventory', 'Remaining Balance', document.getElementById('rep-inv-remaining')?.textContent || ''],
    ];

    ExportUtils.downloadCSV(`TASMAC_Shop11066_Summary_Report_${startDate}_${endDate}`, headers, rows);
    App.showToast('Comprehensive report exported to Excel!', 'success');
  },

  printReport() {
    const startDate = document.getElementById('rep-filter-start')?.value || 'All';
    const endDate = document.getElementById('rep-filter-end')?.value || 'All';

    const sales = document.getElementById('rep-total-sales')?.textContent || '₹0.00';
    const payments = document.getElementById('rep-all-payments')?.textContent || '₹0.00';
    const cash = document.getElementById('rep-cash-sales')?.textContent || '₹0.00';
    const upiCard = document.getElementById('rep-upi-card')?.textContent || '₹0.00 / ₹0.00';
    const scanOnline = document.getElementById('rep-scan-online')?.textContent || '₹0.00 / ₹0.00';
    const bottleFlow = document.getElementById('rep-bottle-flow')?.textContent || '+0 Ret / -0 Sold';

    const avail = document.getElementById('rep-inv-available')?.textContent || '0 Bottles';
    const coll = document.getElementById('rep-inv-collected')?.textContent || '0 Bottles';
    const rem = document.getElementById('rep-inv-remaining')?.textContent || '0 Bottles';

    const vendorRows = document.getElementById('rep-vendor-breakdown-tbody')?.innerHTML || '';

    const html = `
      <div class="a4-header">
        <div class="a4-org-title">TAMIL NADU STATE MARKETING CORPORATION LIMITED (TASMAC)</div>
        <div class="a4-shop-title">SHOP NO. 11066 – IN-CHARGE: ANNADURAI M</div>
        <div class="a4-report-name">PERIODIC EXECUTIVE AUDIT & PERFORMANCE REPORT</div>
      </div>

      <div class="a4-meta-bar">
        <div><b>Reporting Period:</b> ${startDate} to ${endDate}</div>
        <div><b>Shop Number:</b> 11066</div>
        <div><b>Generated:</b> ${new Date().toLocaleString()}</div>
        <div><b>Mode:</b> 100% Offline</div>
      </div>

      <!-- Section 1: Remittance & Sales Summary -->
      <div class="a4-section-title">1. REMITTANCE & FINANCIAL SUMMARY</div>
      <div class="a4-kpi-grid">
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Total Sales Amount</div>
          <div class="a4-kpi-value">${sales}</div>
        </div>
        <div class="a4-kpi-card gold">
          <div class="a4-kpi-label">Total All Payments</div>
          <div class="a4-kpi-value">${payments}</div>
        </div>
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Cash Sales</div>
          <div class="a4-kpi-value">${cash}</div>
        </div>
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">UPI / Card Collections</div>
          <div class="a4-kpi-value" style="font-size: 11pt;">${upiCard}</div>
        </div>
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Scan / Online Collections</div>
          <div class="a4-kpi-value" style="font-size: 11pt;">${scanOnline}</div>
        </div>
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Buy Back Bottles Flow</div>
          <div class="a4-kpi-value" style="font-size: 11pt;">${bottleFlow}</div>
        </div>
      </div>

      <!-- Section 2: Bottle Inventory Summary -->
      <div class="a4-section-title">2. BOTTLE INVENTORY SUMMARY (ONE COMMON POOL)</div>
      <div class="a4-kpi-grid">
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Total Available Bottles</div>
          <div class="a4-kpi-value">${avail}</div>
        </div>
        <div class="a4-kpi-card danger">
          <div class="a4-kpi-label">Total Vendor Collected</div>
          <div class="a4-kpi-value">${coll}</div>
        </div>
        <div class="a4-kpi-card ${rem.includes('-') ? 'danger' : 'gold'}">
          <div class="a4-kpi-label">Remaining Balance Available</div>
          <div class="a4-kpi-value">${rem}</div>
        </div>
      </div>

      <!-- Section 3: Vendor Handover Breakdown -->
      <div class="a4-section-title">3. VENDOR EMPTY BOTTLE HANDOVER BREAKDOWN</div>
      <table class="a4-table">
        <thead>
          <tr>
            <th style="width: 35%;">Vendor Name</th>
            <th style="width: 20%;" class="text-center">Receipts Count</th>
            <th style="width: 20%;" class="text-right">Bottles Collected</th>
            <th style="width: 25%;" class="text-right">Total Payable (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${vendorRows}
        </tbody>
      </table>

      <!-- Signatures Section -->
      <div class="a4-signatures">
        <div class="a4-sign-box">
          <div>SHOP IN-CHARGE SIGNATURE</div>
          <div class="a4-sign-role">ANNADURAI M (Shop No. 11066)</div>
        </div>
        <div class="a4-sign-box">
          <div>DISTRICT MANAGER / AUDIT SUPERVISOR</div>
          <div class="a4-sign-role">TASMAC Internal Audit & Verification</div>
        </div>
      </div>

      <div class="a4-footer">
        <div>Generated: ${new Date().toLocaleString()} | Official Shop Records Copy</div>
        <div>Page 1 of 1 | TASMAC Shop Management System</div>
      </div>
    `;

    ExportUtils.printContent('TASMAC_Executive_Report', html, false);
  },

  async printBluetooth() {
    const startDate = document.getElementById('rep-filter-start')?.value || 'All';
    const endDate = document.getElementById('rep-filter-end')?.value || 'All';

    const sales = document.getElementById('rep-total-sales')?.textContent || '₹0.00';
    const payments = document.getElementById('rep-all-payments')?.textContent || '₹0.00';
    const cash = document.getElementById('rep-cash-sales')?.textContent || '₹0.00';
    const upiCard = document.getElementById('rep-upi-card')?.textContent || '₹0.00 / ₹0.00';
    const scanOnline = document.getElementById('rep-scan-online')?.textContent || '₹0.00 / ₹0.00';
    const bottleFlow = document.getElementById('rep-bottle-flow')?.textContent || '+0 Ret / -0 Sold';

    const avail = document.getElementById('rep-inv-available')?.textContent || '0 Bottles';
    const coll = document.getElementById('rep-inv-collected')?.textContent || '0 Bottles';
    const rem = document.getElementById('rep-inv-remaining')?.textContent || '0 Bottles';

    const upiParts = upiCard.split('/');
    const scanParts = scanOnline.split('/');

    // Gather vendor breakdown
    const receipts = await window.tasmacDB.getAllVendorReceipts();
    const filteredRec = receipts.filter((r) => {
      if (startDate !== 'All' && r.receipt_date < startDate) return false;
      if (endDate !== 'All' && r.receipt_date > endDate) return false;
      return true;
    });

    const vendorMap = new Map();
    filteredRec.forEach((rc) => {
      const vName = rc.vendor_name || 'Vendor';
      if (!vendorMap.has(vName)) {
        vendorMap.set(vName, { name: vName, receipts: 0, bottles: 0, payable: 0 });
      }
      const item = vendorMap.get(vName);
      item.receipts += 1;
      item.bottles += parseInt(rc.total_bottles) || 0;
      item.payable += parseFloat(rc.total_payable) || 0;
    });

    const vendorList = Array.from(vendorMap.values()).sort((a, b) => b.bottles - a.bottles);

    const repData = {
      startDate,
      endDate,
      sales,
      payments,
      cash,
      upi: upiParts[0]?.trim() || '₹0.00',
      card: upiParts[1]?.trim() || '₹0.00',
      scan: scanParts[0]?.trim() || '₹0.00',
      online: scanParts[1]?.trim() || '₹0.00',
      bottleFlow,
      avail,
      coll,
      rem,
      vendors: vendorList,
    };

    const escText = ExportUtils.buildReportsEscPos(repData);
    BluetoothPrintManager.printOrPrompt(escText);
  },
};

window.ReportsView = ReportsView;

