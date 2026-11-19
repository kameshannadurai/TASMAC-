/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Module 3: Vendor Information Details
 * Resembles physical TASMAC Handover Receipt, Fixed Rates,
 * Live bottle & payable calculation, Thermal Print, PDF, History & Module 2 sync
 */

const Module3Vendor = {
  editingId: null,
  activePreviewReceipt: null,

  // Fixed Standard Rates specified by TASMAC
  LIQUOR_CONFIG: [
    { size_label: '1000 ML', rate: 4.25 },
    { size_label: '750/700/650 ML', rate: 3.25 },
    { size_label: '375/360/355/350/325/320/300 ML', rate: 0.70 },
    { size_label: '200/180/100 ML', rate: 0.59 },
  ],

  BEER_CONFIG: [
    { size_label: '650 ML', rate: 1.45 },
    { size_label: '500/480/440 ML', rate: 0.72 },
    { size_label: '325 ML', rate: 0.67 },
  ],

  init() {
    this.renderFormTables();
    this.bindEvents();
    this.setDefaultDateTime();
    this.calculateTotalsLive();
    this.renderHistory();
  },

  setDefaultDateTime() {
    const d = document.getElementById('ven-date');
    const t = document.getElementById('ven-time');
    const now = new Date();
    if (d && !d.value) d.value = now.toISOString().split('T')[0];
    if (t && !t.value) t.value = now.toTimeString().slice(0, 5);
  },

  renderFormTables() {
    const liquorTbody = document.getElementById('ven-liquor-tbody');
    const beerTbody = document.getElementById('ven-beer-tbody');

    if (liquorTbody) {
      liquorTbody.innerHTML = this.LIQUOR_CONFIG.map(
        (item, idx) => `
        <tr>
          <td class="fw-bold">${item.size_label}</td>
          <td class="text-right">₹${item.rate.toFixed(2)}</td>
          <td class="text-right">
            <input type="number" min="0" step="1" inputmode="numeric" 
                   class="table-input ven-liquor-qty" 
                   data-idx="${idx}" data-rate="${item.rate}" data-size="${item.size_label}"
                   value="0" />
          </td>
          <td class="text-right fw-bold ven-liquor-amt" id="ven-liq-amt-${idx}">₹0.00</td>
        </tr>`
      ).join('');
    }

    if (beerTbody) {
      beerTbody.innerHTML = this.BEER_CONFIG.map(
        (item, idx) => `
        <tr>
          <td class="fw-bold">${item.size_label}</td>
          <td class="text-right">₹${item.rate.toFixed(2)}</td>
          <td class="text-right">
            <input type="number" min="0" step="1" inputmode="numeric" 
                   class="table-input ven-beer-qty" 
                   data-idx="${idx}" data-rate="${item.rate}" data-size="${item.size_label}"
                   value="0" />
          </td>
          <td class="text-right fw-bold ven-beer-amt" id="ven-beer-amt-${idx}">₹0.00</td>
        </tr>`
      ).join('');
    }
  },

  bindEvents() {
    // Listen to quantity changes in both tables
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('ven-liquor-qty') || e.target.classList.contains('ven-beer-qty')) {
        this.calculateTotalsLive();
      }
    });

    const form = document.getElementById('vendor-receipt-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveReceipt();
      });
    }

    const clearBtn = document.getElementById('ven-btn-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearForm());
    }

    const printBtn = document.getElementById('ven-btn-print-current');
    if (printBtn) {
      printBtn.addEventListener('click', () => this.printCurrentForm());
    }

    const pdfBtn = document.getElementById('ven-btn-pdf-current');
    if (pdfBtn) {
      pdfBtn.addEventListener('click', () => this.downloadCurrentPDF());
    }

    const searchInput = document.getElementById('ven-history-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderHistory());
    }

    const dateFilter = document.getElementById('ven-history-date-filter');
    if (dateFilter) {
      dateFilter.addEventListener('change', () => this.renderHistory());
    }

    const exportExcelBtn = document.getElementById('ven-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => this.exportExcel());
    }

    const exportPdfBtn = document.getElementById('ven-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => this.exportPDF());
    }

    const exportBtBtn = document.getElementById('ven-export-bt');
    if (exportBtBtn) {
      exportBtBtn.addEventListener('click', () => this.printHistoryBluetooth());
    }
  },

  getFormReceiptData() {
    const liquorInputs = Array.from(document.querySelectorAll('.ven-liquor-qty'));
    const beerInputs = Array.from(document.querySelectorAll('.ven-beer-qty'));

    const liquorItems = liquorInputs.map((input) => ({
      size_label: input.dataset.size,
      rate: parseFloat(input.dataset.rate),
      quantity: parseInt(input.value) || 0,
    }));

    const beerItems = beerInputs.map((input) => ({
      size_label: input.dataset.size,
      rate: parseFloat(input.dataset.rate),
      quantity: parseInt(input.value) || 0,
    }));

    return {
      receipt_date: document.getElementById('ven-date').value,
      receipt_time: document.getElementById('ven-time').value,
      shop_number: '11066',
      scanner_number: document.getElementById('ven-scanner').value || '',
      tin_number: document.getElementById('ven-tin').value || '',
      vendor_name: (document.getElementById('ven-name').value || '').trim(),
      vendor_mobile: document.getElementById('ven-mobile').value || '',
      liquor_items: liquorItems,
      beer_items: beerItems,
      notes: document.getElementById('ven-notes').value || '',
    };
  },

  calculateTotalsLive() {
    const raw = this.getFormReceiptData();
    const totals = window.tasmacDB.calculateReceiptTotals(raw.liquor_items, raw.beer_items);

    // Update individual row amounts
    totals.liquor_items.forEach((item, idx) => {
      const el = document.getElementById(`ven-liq-amt-${idx}`);
      if (el) el.textContent = `₹${item.amount.toFixed(2)}`;
    });

    totals.beer_items.forEach((item, idx) => {
      const el = document.getElementById(`ven-beer-amt-${idx}`);
      if (el) el.textContent = `₹${item.amount.toFixed(2)}`;
    });

    // Update Totals Display
    const elLiquorSubtotal = document.getElementById('ven-liquor-subtotal-text');
    if (elLiquorSubtotal) elLiquorSubtotal.textContent = `${totals.total_liquor_bottles} Bottles (₹${totals.total_liquor_amount.toFixed(2)})`;

    const elBeerSubtotal = document.getElementById('ven-beer-subtotal-text');
    if (elBeerSubtotal) elBeerSubtotal.textContent = `${totals.total_beer_bottles} Bottles (₹${totals.total_beer_amount.toFixed(2)})`;

    const elTotalBottles = document.getElementById('ven-total-bottles-text');
    if (elTotalBottles) elTotalBottles.textContent = `${totals.total_bottles} Bottles`;

    const elTotalPayable = document.getElementById('ven-total-payable-text');
    if (elTotalPayable) elTotalPayable.textContent = ExportUtils.formatINR(totals.total_payable);

    return totals;
  },

  async saveReceipt() {
    if (window.AuthManager && !window.AuthManager.isAdmin()) {
      App.showToast('Access Denied: View-Only users cannot create vendor receipts.', 'error');
      return;
    }

    const raw = this.getFormReceiptData();
    if (!raw.receipt_date) {
      App.showToast('Please enter a receipt date.', 'error');
      return;
    }

    const totals = this.calculateTotalsLive();
    if (totals.total_bottles <= 0) {
      const confirmZero = confirm('Total bottle quantity is 0. Do you still want to save this receipt?');
      if (!confirmZero) return;
    }

    try {
      let savedReceipt;
      if (this.editingId) {
        savedReceipt = await window.tasmacDB.updateVendorReceipt(this.editingId, raw);
        App.showToast(`Receipt ${savedReceipt.receipt_number} updated successfully!`, 'success');
        this.clearForm();
      } else {
        savedReceipt = await window.tasmacDB.saveVendorReceipt(raw);
        App.showToast(`Receipt ${savedReceipt.receipt_number} saved! Bottles deducted from Module 2.`, 'success');
        this.clearForm();
      }

      await this.renderHistory();
      App.refreshAllData();

      // Show receipt confirmation modal
      this.showReceiptModal(savedReceipt);
    } catch (err) {
      console.error(err);
      App.showToast(err.message || 'Error saving vendor receipt.', 'error');
    }
  },

  async editReceipt(id) {
    if (window.AuthManager && !window.AuthManager.isAdmin()) {
      App.showToast('Access Denied: Only Admin (ANNADURAI M) can edit vendor receipts.', 'error');
      return;
    }

    const receipt = await window.tasmacDB.getVendorReceiptById(id);
    if (!receipt) return;

    this.editingId = receipt.id;
    document.getElementById('ven-date').value = receipt.receipt_date;
    document.getElementById('ven-time').value = receipt.receipt_time || '';
    document.getElementById('ven-scanner').value = receipt.scanner_number || '';
    document.getElementById('ven-tin').value = receipt.tin_number || '';
    document.getElementById('ven-name').value = receipt.vendor_name || '';
    document.getElementById('ven-mobile').value = receipt.vendor_mobile || '';
    document.getElementById('ven-notes').value = receipt.notes || '';

    // Populate liquor inputs
    const liquorInputs = Array.from(document.querySelectorAll('.ven-liquor-qty'));
    (receipt.liquor_items || []).forEach((item, idx) => {
      if (liquorInputs[idx]) liquorInputs[idx].value = item.quantity;
    });

    // Populate beer inputs
    const beerInputs = Array.from(document.querySelectorAll('.ven-beer-qty'));
    (receipt.beer_items || []).forEach((item, idx) => {
      if (beerInputs[idx]) beerInputs[idx].value = item.quantity;
    });

    const submitBtn = document.getElementById('ven-btn-submit');
    if (submitBtn) {
      submitBtn.innerHTML = `✏️ UPDATE RECEIPT (${receipt.receipt_number})`;
      submitBtn.className = 'btn btn-gold';
    }

    this.calculateTotalsLive();
    document.getElementById('vendor-receipt-form').scrollIntoView({ behavior: 'smooth' });
    App.showToast(`Editing receipt ${receipt.receipt_number}. Make changes and click Update.`, 'info');
  },

  async deleteReceipt(id) {
    if (window.AuthManager && !window.AuthManager.isAdmin()) {
      App.showToast('Access Denied: Only Admin (ANNADURAI M) can delete vendor receipts.', 'error');
      return;
    }

    const receipt = await window.tasmacDB.getVendorReceiptById(id);
    if (!receipt) return;

    const ok = confirm(
      `Are you sure you want to delete receipt ${receipt.receipt_number} (${receipt.total_bottles} Bottles)?\n` +
      `This will automatically restore ${receipt.total_bottles} bottles back to Module 2 available balance.`
    );
    if (!ok) return;

    try {
      await window.tasmacDB.deleteVendorReceipt(id);
      App.showToast(`Receipt ${receipt.receipt_number} deleted. Bottles restored to Module 2.`, 'success');
      if (this.editingId === id) this.clearForm();
      await this.renderHistory();
      App.refreshAllData();
    } catch (err) {
      App.showToast(err.message || 'Error deleting receipt.', 'error');
    }
  },

  clearForm() {
    this.editingId = null;
    const form = document.getElementById('vendor-receipt-form');
    if (form) form.reset();
    this.setDefaultDateTime();

    // Reset table inputs to 0
    document.querySelectorAll('.ven-liquor-qty').forEach((el) => (el.value = 0));
    document.querySelectorAll('.ven-beer-qty').forEach((el) => (el.value = 0));

    const submitBtn = document.getElementById('ven-btn-submit');
    if (submitBtn) {
      submitBtn.innerHTML = `💾 SAVE RECEIPT`;
      submitBtn.className = 'btn btn-primary';
    }

    this.calculateTotalsLive();
  },

  showReceiptModal(receipt) {
    this.activePreviewReceipt = receipt;
    const modal = document.getElementById('receipt-preview-modal');
    const container = document.getElementById('receipt-modal-content');
    if (!modal || !container) return;

    container.innerHTML = ExportUtils.buildVendorReceiptHTML(receipt);
    modal.style.display = 'flex';
    modal.classList.add('active');

    // Dismiss on clicking outside modal-box
    modal.onclick = (e) => {
      if (e.target === modal) this.closeReceiptModal();
    };
  },

  closeReceiptModal() {
    const modal = document.getElementById('receipt-preview-modal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
    this.activePreviewReceipt = null;
  },

  printActiveReceipt(isThermal = true) {
    if (!this.activePreviewReceipt) return;
    const html = isThermal
      ? ExportUtils.buildVendorReceiptHTML(this.activePreviewReceipt)
      : ExportUtils.buildVendorReceiptA4HTML(this.activePreviewReceipt);
    ExportUtils.printContent(this.activePreviewReceipt.receipt_number, html, isThermal);
  },

  printActiveBluetooth() {
    if (!this.activePreviewReceipt) return;
    ExportUtils.printBluetoothReceipt(this.activePreviewReceipt);
    App.showToast('Sending receipt to Bluetooth printer...', 'info');
  },

  printCurrentBluetooth() {
    const raw = this.getFormReceiptData();
    const totals = this.calculateTotalsLive();
    const tempReceipt = {
      ...raw,
      receipt_number: this.editingId ? `DRAFT-EDIT` : `DRAFT-${Date.now().toString().slice(-4)}`,
      ...totals,
    };
    ExportUtils.printBluetoothReceipt(tempReceipt);
    App.showToast('Sending receipt to Bluetooth printer...', 'info');
  },

  printCurrentForm(isThermal = true) {
    const raw = this.getFormReceiptData();
    const totals = this.calculateTotalsLive();
    const tempReceipt = {
      ...raw,
      receipt_number: this.editingId ? `DRAFT-EDIT` : `DRAFT-${Date.now().toString().slice(-4)}`,
      ...totals,
    };
    const html = isThermal
      ? ExportUtils.buildVendorReceiptHTML(tempReceipt)
      : ExportUtils.buildVendorReceiptA4HTML(tempReceipt);
    ExportUtils.printContent(tempReceipt.receipt_number, html, isThermal);
  },

  downloadCurrentPDF() {
    // Generate clean official A4 Portrait PDF / Print for current form data
    this.printCurrentForm(false);
  },

  async renderHistory() {
    const tableBody = document.getElementById('ven-history-tbody');
    const mobileContainer = document.getElementById('ven-history-mobile');
    if (!tableBody || !mobileContainer) return;

    const all = await window.tasmacDB.getAllVendorReceipts();
    const searchQuery = (document.getElementById('ven-history-search')?.value || '').toLowerCase().trim();
    const dateFilter = document.getElementById('ven-history-date-filter')?.value || '';

    const filtered = all.filter((r) => {
      const vName = (r.vendor_name || '').toLowerCase();
      const rNum = (r.receipt_number || '').toLowerCase();
      if (searchQuery && !vName.includes(searchQuery) && !rNum.includes(searchQuery)) {
        return false;
      }
      if (dateFilter && r.receipt_date !== dateFilter) {
        return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 24px; color: #777;">No vendor receipts found.</td></tr>`;
      mobileContainer.innerHTML = `<div class="text-center" style="padding: 24px; color: #777;">No vendor receipts found.</div>`;
      return;
    }

    const isAdmin = window.AuthManager ? window.AuthManager.isAdmin() : true;

    // Render Table
    tableBody.innerHTML = filtered
      .map(
        (r) => `
        <tr>
          <td class="fw-bold">${r.receipt_date}</td>
          <td><span class="shop-num-pill" style="font-size: 11px;">${r.receipt_number}</span></td>
          <td class="fw-bold">${r.vendor_name || '—'}</td>
          <td class="text-right fw-bold" style="color: #c0392b;">${r.total_bottles} Bottles</td>
          <td class="text-right fw-bold" style="color: #0e3820;">${ExportUtils.formatINR(r.total_payable)}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-secondary" onclick="Module3Vendor.showReceiptById(${r.id})" title="View / Print Receipt">🖨️</button>
            ${isAdmin ? `
              <button class="btn btn-sm btn-secondary" style="margin-left: 4px;" onclick="Module3Vendor.editReceipt(${r.id})" title="Edit">✏️</button>
              <button class="btn btn-sm btn-danger" style="margin-left: 4px;" onclick="Module3Vendor.deleteReceipt(${r.id})" title="Delete">🗑️</button>
            ` : ''}
          </td>
        </tr>`
      )
      .join('');

    // Render Mobile Cards
    mobileContainer.innerHTML = filtered
      .map(
        (r) => `
        <div class="history-card-item">
          <div class="history-card-header">
            <div>
              <div class="history-card-date">🧾 ${r.vendor_name || 'Vendor Receipt'}</div>
              <div style="font-size: 11px; color: #666;">${r.receipt_number} &nbsp;|&nbsp; ${r.receipt_date}</div>
            </div>
            <div>
              <button class="btn btn-sm btn-secondary" onclick="Module3Vendor.showReceiptById(${r.id})">Print</button>
              ${isAdmin ? `
                <button class="btn btn-sm btn-secondary" onclick="Module3Vendor.editReceipt(${r.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="Module3Vendor.deleteReceipt(${r.id})">Del</button>
              ` : ''}
            </div>
          </div>
          <div class="history-card-grid">
            <div class="history-card-row">
              <span class="label">Total Bottles Collected</span>
              <span class="value" style="color: #c0392b;">${r.total_bottles} Bottles</span>
            </div>
            <div class="history-card-row">
              <span class="label">Total Payable</span>
              <span class="value" style="color: #0e3820;">${ExportUtils.formatINR(r.total_payable)}</span>
            </div>
            <div class="history-card-row">
              <span class="label">Scanner / TIN</span>
              <span class="value">${r.scanner_number || '-'} / ${r.tin_number || '-'}</span>
            </div>
            <div class="history-card-row">
              <span class="label">Mobile</span>
              <span class="value">${r.vendor_mobile || '-'}</span>
            </div>
          </div>
        </div>`
      )
      .join('');
  },

  async showReceiptById(id) {
    const receipt = await window.tasmacDB.getVendorReceiptById(id);
    if (receipt) this.showReceiptModal(receipt);
  },

  async exportExcel() {
    const records = await window.tasmacDB.getAllVendorReceipts();
    if (records.length === 0) {
      App.showToast('No vendor receipts to export.', 'error');
      return;
    }

    const headers = [
      'Receipt No',
      'Date',
      'Time',
      'Shop No',
      'Scanner No',
      'TIN No',
      'Vendor Name',
      'Vendor Mobile',
      'Liquor Bottles',
      'Liquor Amount (₹)',
      'Beer Bottles',
      'Beer Amount (₹)',
      'Total Bottles',
      'Total Payable (₹)',
      'Notes',
    ];

    const rows = records.map((r) => [
      r.receipt_number,
      r.receipt_date,
      r.receipt_time || '',
      r.shop_number,
      r.scanner_number || '',
      r.tin_number || '',
      r.vendor_name || '',
      r.vendor_mobile || '',
      r.total_liquor_bottles,
      r.total_liquor_amount,
      r.total_beer_bottles,
      r.total_beer_amount,
      r.total_bottles,
      r.total_payable,
      r.notes || '',
    ]);

    ExportUtils.downloadCSV('TASMAC_Shop11066_Vendor_Receipts', headers, rows);
    App.showToast('Vendor receipts exported to Excel successfully!', 'success');
  },

  async exportPDF() {
    const records = await window.tasmacDB.getAllVendorReceipts();
    if (records.length === 0) {
      App.showToast('No records to print or export.', 'error');
      return;
    }

    let totBottles = 0;
    let totPayable = 0;

    const tableRows = records
      .map((r) => {
        totBottles += parseInt(r.total_bottles) || 0;
        totPayable += parseFloat(r.total_payable) || 0;

        return `
        <tr>
          <td>${r.receipt_date}</td>
          <td><b>${r.receipt_number}</b></td>
          <td>${r.vendor_name || '—'}</td>
          <td>${r.scanner_number || '-'}</td>
          <td class="text-right fw-bold" style="color: #c0392b;">${r.total_bottles}</td>
          <td class="text-right fw-bold" style="color: #0e3820;">${ExportUtils.formatINR(r.total_payable)}</td>
        </tr>`;
      })
      .join('');

    const html = `
      <div class="a4-header">
        <div class="a4-org-title">TAMIL NADU STATE MARKETING CORPORATION LIMITED (TASMAC)</div>
        <div class="a4-shop-title">SHOP NO. 11066 – IN-CHARGE: ANNADURAI M</div>
        <div class="a4-report-name">VENDOR EMPTY BOTTLE HANDOVER RECEIPTS REGISTER</div>
      </div>

      <div class="a4-meta-bar">
        <div><b>Total Receipts Issued:</b> ${records.length}</div>
        <div><b>Shop Number:</b> 11066</div>
        <div><b>Generated:</b> ${new Date().toLocaleString()}</div>
        <div><b>Storage:</b> 100% Offline Database</div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="a4-kpi-grid">
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Total Receipts Issued</div>
          <div class="a4-kpi-value">${records.length} Receipts</div>
        </div>
        <div class="a4-kpi-card danger">
          <div class="a4-kpi-label">Total Empty Bottles Handed Over</div>
          <div class="a4-kpi-value">${totBottles} Bottles</div>
        </div>
        <div class="a4-kpi-card gold">
          <div class="a4-kpi-label">Cumulative Total Payable</div>
          <div class="a4-kpi-value">${ExportUtils.formatINR(totPayable)}</div>
        </div>
      </div>

      <!-- Receipts Register Table -->
      <div class="a4-section-title">CHRONOLOGICAL VENDOR HANDOVER LOG</div>
      <table class="a4-table">
        <thead>
          <tr>
            <th style="width: 14%;">Date</th>
            <th style="width: 22%;">Receipt No</th>
            <th style="width: 26%;">Vendor Name</th>
            <th style="width: 14%;">Scanner / TIN</th>
            <th style="width: 10%;" class="text-right">Bottles</th>
            <th style="width: 14%;" class="text-right">Total Payable</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4">CUMULATIVE TOTALS:</td>
            <td class="text-right">${totBottles}</td>
            <td class="text-right">${ExportUtils.formatINR(totPayable)}</td>
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
          <div>VENDOR AUDIT / VERIFICATION OFFICER</div>
          <div class="a4-sign-role">TASMAC Bottle Clearing Accounts</div>
        </div>
      </div>

      <div class="a4-footer">
        <div>Generated: ${new Date().toLocaleString()} | Official Vendor Register</div>
        <div>Page 1 of 1 | TASMAC Shop Management System</div>
      </div>
    `;

    ExportUtils.printContent('TASMAC_Vendor_Receipts_Summary', html, false);
  },

  async printHistoryBluetooth() {
    const records = await window.tasmacDB.getAllVendorReceipts();
    if (records.length === 0) {
      App.showToast('No vendor receipts found to print.', 'error');
      return;
    }
    const escText = ExportUtils.buildVendorHistoryEscPos(records);
    BluetoothPrintManager.printOrPrompt(escText);
  },
};

window.Module3Vendor = Module3Vendor;

