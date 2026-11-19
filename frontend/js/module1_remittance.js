/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Module 1: Total Remittance Management
 * Complete TASMAC Daily Remittance Register & Handwritten Daily Register Accounting
 * Field Exchange & Formula Updates:
 * - Section A, No. 4: TOTAL SALES AMOUNT = TOTAL SCAN COLLECTION AMOUNT - Buyback Sold Amount
 * - Section B, No. 5: TOTAL SCAN COLLECTION AMOUNT (manual entry)
 * - Sales Bottle = Buyback Sold Bottle (auto-copied)
 * - Actual Cash Submitted = TOTAL SCAN COLLECTION AMOUNT - Buyback Sold Amount
 * - Total Collection = Total Sales Amount + Buyback Sold Amount
 * - Previous Buyback Remittance = Buyback Opening Balance - Buyback Return Amount Paid
 * - Cash Remittance = Total Sales Amount - UPI - Card - Online + Previous Buyback Remittance
 * - Section F: 17 Remittance Metrics Display
 */

const Module1Remittance = {
  editingId: null,

  async init() {
    this.bindEvents();
    this.setDefaultDate();
    await this.onDateChanged();
    this.calculateLive();
    await this.renderHistory();
  },

  setDefaultDate() {
    const dateInput = document.getElementById('rem-date');
    if (dateInput && !dateInput.value) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }
  },

  bindEvents() {
    // Two-Way Sync for Bottle Quantity (Sales Bottle <-> Buyback Sold Bottle)
    const salesBottleEl = document.getElementById('rem-sales-bottle');
    const soldBottleEl = document.getElementById('rem-sold-bottle');
    let isSyncingBottles = false;

    if (salesBottleEl) {
      const onSalesBottleChange = () => {
        if (isSyncingBottles) return;
        isSyncingBottles = true;
        if (soldBottleEl) {
          soldBottleEl.value = salesBottleEl.value;
        }
        this.calculateLive();
        isSyncingBottles = false;
      };
      salesBottleEl.addEventListener('input', onSalesBottleChange);
      salesBottleEl.addEventListener('change', onSalesBottleChange);
    }

    if (soldBottleEl) {
      const onSoldBottleChange = () => {
        if (isSyncingBottles) return;
        isSyncingBottles = true;
        if (salesBottleEl) {
          salesBottleEl.value = soldBottleEl.value;
        }
        this.calculateLive();
        isSyncingBottles = false;
      };
      soldBottleEl.addEventListener('input', onSoldBottleChange);
      soldBottleEl.addEventListener('change', onSoldBottleChange);
    }

    // Inputs that trigger live recalculation
    const inputs = [
      'rem-scan',
      'rem-return-bottle',
      'rem-upi',
      'rem-card',
      'rem-online',
      'rem-buyback-opening',
    ];

    inputs.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => this.calculateLive());
        el.addEventListener('change', () => this.calculateLive());
      }
    });

    // Date change event – auto carry forward previous buyback balance & serial number
    const dateEl = document.getElementById('rem-date');
    if (dateEl) {
      dateEl.addEventListener('change', () => this.onDateChanged());
    }

    const form = document.getElementById('remittance-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveEntry();
      });
    }

    const clearBtn = document.getElementById('rem-btn-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearForm());
    }

    const searchInput = document.getElementById('rem-history-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderHistory());
    }

    const filterPeriod = document.getElementById('rem-filter-period');
    const monthPicker = document.getElementById('rem-month-picker');

    if (filterPeriod) {
      filterPeriod.addEventListener('change', () => {
        if (filterPeriod.value === 'monthly') {
          if (monthPicker) {
            monthPicker.style.display = 'block';
            if (!monthPicker.value) {
              const now = new Date();
              const yr = now.getFullYear();
              const mo = String(now.getMonth() + 1).padStart(2, '0');
              monthPicker.value = `${yr}-${mo}`;
            }
          }
        } else {
          if (monthPicker) monthPicker.style.display = 'none';
        }
        this.renderHistory();
      });
    }

    if (monthPicker) {
      monthPicker.addEventListener('change', () => this.renderHistory());
    }

    const exportExcelBtn = document.getElementById('rem-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => this.exportExcel());
    }

    const exportPdfBtn = document.getElementById('rem-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => this.exportPDF());
    }

    const exportBtBtn = document.getElementById('rem-export-bt');
    if (exportBtBtn) {
      exportBtBtn.addEventListener('click', () => this.printBluetooth());
    }
  },

  // Called when date changes: auto-generates serial number and fetches previous day closing buyback cash
  async onDateChanged() {
    const dateInput = document.getElementById('rem-date');
    if (!dateInput || !dateInput.value) return;

    const selectedDate = dateInput.value;

    // 1. Auto generate serial number if empty or not in editing mode
    const serialInput = document.getElementById('rem-serial-number');
    if (serialInput && (!this.editingId || !serialInput.value)) {
      if (window.tasmacDB && typeof window.tasmacDB.generateRemittanceSerial === 'function') {
        serialInput.value = window.tasmacDB.generateRemittanceSerial(selectedDate);
      }
    }

    // 2. Auto carry forward previous day's closing buyback cash
    if (!this.editingId) {
      const openingInput = document.getElementById('rem-buyback-opening');
      const openingBadge = document.getElementById('rem-opening-badge');

      if (window.tasmacDB && typeof window.tasmacDB.getPreviousRemittance === 'function') {
        try {
          const prev = await window.tasmacDB.getPreviousRemittance(selectedDate);
          if (prev && typeof prev.buyback_closing_cash_in_hand === 'number') {
            if (openingInput) openingInput.value = prev.buyback_closing_cash_in_hand.toFixed(2);
            if (openingBadge) {
              openingBadge.textContent = `Auto Carried (${prev.date})`;
              openingBadge.style.color = '#1e8449';
            }
          } else {
            if (openingInput && (!openingInput.value || openingInput.value === '0.00')) {
              openingInput.value = '0.00';
            }
            if (openingBadge) {
              openingBadge.textContent = 'Manual / Day 1';
              openingBadge.style.color = '#777';
            }
          }
        } catch (e) {
          console.warn('Error fetching previous remittance:', e);
        }
      }
    }

    this.calculateLive();
  },

  // Read raw values from form
  getFormValues() {
    const scanVal = parseFloat(document.getElementById('rem-scan')?.value) || 0.0;

    // Two-way sync: get bottle quantity from active input or either field
    const salesBottleEl = document.getElementById('rem-sales-bottle');
    const soldBottleEl = document.getElementById('rem-sold-bottle');
    let soldBottleVal = 0;
    if (document.activeElement === salesBottleEl) {
      soldBottleVal = parseInt(salesBottleEl?.value, 10) || 0;
    } else {
      soldBottleVal = parseInt(soldBottleEl?.value, 10) || parseInt(salesBottleEl?.value, 10) || 0;
    }

    const upiVal = parseFloat(document.getElementById('rem-upi')?.value) || 0.0;
    const cardVal = parseFloat(document.getElementById('rem-card')?.value) || 0.0;
    const openingVal = parseFloat(document.getElementById('rem-buyback-opening')?.value) || 0.0;
    const returnBottleVal = parseInt(document.getElementById('rem-return-bottle')?.value) || 0;
    const prevBuybackRemittance = openingVal - (returnBottleVal * 10);
    const actualCashSubmitted = scanVal - (soldBottleVal * 10) - upiVal - cardVal + prevBuybackRemittance;

    return {
      date: document.getElementById('rem-date')?.value || '',
      shop_number: document.getElementById('rem-shop-number')?.value || '11066',
      serial_number: document.getElementById('rem-serial-number')?.value || '',
      scan_amount: scanVal,
      total_sales_amount: scanVal - (soldBottleVal * 10),
      sales_bottle: soldBottleVal, // Sales Bottle = Buyback Sold Bottle
      upi_amount: upiVal,
      card_amount: cardVal,
      online_amount: parseFloat(document.getElementById('rem-online')?.value) || 0.0,
      buyback_opening_balance: openingVal,
      buy_back_sold_bottle: soldBottleVal,
      buy_back_return_bottle: returnBottleVal,
      actual_cash_submitted: actualCashSubmitted,
      notes: document.getElementById('rem-notes')?.value || '',
    };
  },

  // Calculate live and update summary cards + section calculated labels
  calculateLive() {
    const raw = this.getFormValues();
    const calculated = window.tasmacDB.calculateRemittanceValues(raw);

    // Section A live calculation: 4. Total Sales Amount = Scan Amount - Buyback Sold Amount
    this.updateSpanText('calc-val-total-sales', ExportUtils.formatINR(calculated.total_sales_amount));
    const hiddenTotalSales = document.getElementById('rem-total-sales');
    if (hiddenTotalSales) hiddenTotalSales.value = calculated.total_sales_amount;

    // Section B & C live auto-sync: Sales Bottle <-> Buyback Sold Bottle
    const salesBottleInput = document.getElementById('rem-sales-bottle');
    const soldBottleInput = document.getElementById('rem-sold-bottle');
    if (salesBottleInput && soldBottleInput) {
      const active = document.activeElement;
      if (active === salesBottleInput) {
        soldBottleInput.value = salesBottleInput.value;
      } else if (active === soldBottleInput) {
        salesBottleInput.value = soldBottleInput.value;
      } else {
        const syncVal = salesBottleInput.value !== '' ? salesBottleInput.value : (soldBottleInput.value !== '' ? soldBottleInput.value : (calculated.sales_bottle || ''));
        salesBottleInput.value = syncVal;
        soldBottleInput.value = syncVal;
      }
    }

    // Section C live calculations
    this.updateSpanText('calc-val-sold-amount', ExportUtils.formatINR(calculated.buy_back_sold_amount));
    this.updateSpanText('calc-val-return-amount', ExportUtils.formatINR(calculated.buy_back_return_amount));

    // Section D live calculation (Previous Buyback Remittance = Opening - Return Amount Paid)
    this.updateSpanText('calc-val-prev-buyback-remittance', ExportUtils.formatINR(calculated.previous_buyback_remittance));

    // Section E live calculations
    this.updateSpanText('calc-val-total-collection', ExportUtils.formatINR(calculated.total_collection));
    this.updateSpanText('calc-val-cash-remittance', ExportUtils.formatINR(calculated.cash_remittance));
    this.updateSpanText('calc-val-return-paid', ExportUtils.formatINR(calculated.buyback_amount_return_paid));
    this.updateSpanText('calc-val-closing-cash', ExportUtils.formatINR(calculated.buyback_closing_cash_in_hand));

    // 20. Actual Cash Submitted = Scan Amount - Buyback Sold - UPI - Card + Prev Buyback Remittance
    this.updateSpanText('calc-val-actual-cash', ExportUtils.formatINR(calculated.actual_cash_submitted));
    const hiddenActualCash = document.getElementById('rem-actual-cash');
    if (hiddenActualCash) hiddenActualCash.value = calculated.actual_cash_submitted;

    // 21. Cash Difference (Actual Submitted - Required Cash Remittance)
    const diffEl = document.getElementById('calc-val-cash-difference');
    if (diffEl) {
      if (Math.abs(calculated.cash_difference) < 0.01) {
        diffEl.textContent = `${ExportUtils.formatINR(0)} (Balanced)`;
        diffEl.style.color = '#145a32';
      } else if (calculated.cash_difference < 0) {
        diffEl.textContent = `${ExportUtils.formatINR(calculated.cash_difference)} (Shortage)`;
        diffEl.style.color = '#c0392b'; // Red
      } else {
        diffEl.textContent = `+${ExportUtils.formatINR(calculated.cash_difference)} (Excess)`;
        diffEl.style.color = '#d35400'; // Orange
      }
    }

    // Mismatch / Shortage Banner
    const banner = document.getElementById('rem-mismatch-banner');
    if (banner) {
      if (calculated.cash_difference < -0.01) {
        const shortage = Math.abs(calculated.cash_difference);
        banner.style.display = 'block';
        banner.style.background = '#fde8e8';
        banner.style.color = '#9b1c1c';
        banner.style.border = '1.5px solid #f98080';
        banner.innerHTML = `⚠️ <b>CASH SHORTAGE DETECTED:</b> Short by <b>${ExportUtils.formatINR(shortage)}</b>. Actual cash submitted (${ExportUtils.formatINR(calculated.actual_cash_submitted)}) is less than required Cash Remittance (${ExportUtils.formatINR(calculated.cash_remittance)}).`;
      } else if (calculated.cash_difference > 0.01) {
        const excess = calculated.cash_difference;
        banner.style.display = 'block';
        banner.style.background = '#fef08a';
        banner.style.color = '#854d0e';
        banner.style.border = '1.5px solid #eab308';
        banner.innerHTML = `ℹ️ <b>CASH EXCESS DETECTED:</b> Excess by <b>${ExportUtils.formatINR(excess)}</b>. Actual cash submitted (${ExportUtils.formatINR(calculated.actual_cash_submitted)}) exceeds required Cash Remittance (${ExportUtils.formatINR(calculated.cash_remittance)}).`;
      } else {
        banner.style.display = 'none';
      }
    }

    // Section F: 16 Summary Cards (Hero highlight on Actual Cash Submitted)
    this.updateCardText('card-scan-amt', ExportUtils.formatINR(calculated.scan_amount));
    this.updateCardText('card-total-sales', ExportUtils.formatINR(calculated.total_sales_amount));
    this.updateCardText('card-sales-bottle', calculated.sales_bottle + ' Bottles');
    this.updateCardText('card-sold-bottle', calculated.buy_back_sold_bottle + ' Bottles');
    this.updateCardText('card-sold-amt', ExportUtils.formatINR(calculated.buy_back_sold_amount));
    this.updateCardText('card-total-collection', ExportUtils.formatINR(calculated.total_collection));
    this.updateCardText('card-upi-amt', ExportUtils.formatINR(calculated.upi_amount));
    this.updateCardText('card-card-amt', ExportUtils.formatINR(calculated.card_amount));
    this.updateCardText('card-online-amt', ExportUtils.formatINR(calculated.online_amount));
    this.updateCardText('card-buyback-opening', ExportUtils.formatINR(calculated.buyback_opening_balance));
    this.updateCardText('card-prev-buyback-remittance', ExportUtils.formatINR(calculated.previous_buyback_remittance));
    this.updateCardText('card-cash-remittance', ExportUtils.formatINR(calculated.cash_remittance));
    this.updateCardText('card-return-bottle', calculated.buy_back_return_bottle + ' Bottles');
    this.updateCardText('card-return-amt', ExportUtils.formatINR(calculated.buy_back_return_amount));
    this.updateCardText('card-closing-cash', ExportUtils.formatINR(calculated.buyback_closing_cash_in_hand));
    this.updateCardText('card-actual-cash', ExportUtils.formatINR(calculated.actual_cash_submitted));

    return calculated;
  },

  updateSpanText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  updateCardText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  async saveEntry() {
    if (window.AuthManager && !window.AuthManager.isAdmin()) {
      App.showToast('Access Denied: View-Only users cannot add or modify remittances.', 'error');
      return;
    }

    const data = this.getFormValues();
    if (!data.date) {
      App.showToast('Please select a valid date.', 'error');
      return;
    }

    try {
      if (this.editingId) {
        await window.tasmacDB.updateRemittance(this.editingId, data);
        App.showToast(`Remittance for ${data.date} updated successfully!`, 'success');
        this.clearForm();
      } else {
        // Prevent accidental duplicate daily entry
        const existing = await window.tasmacDB.getRemittanceByDate(data.date);
        if (existing) {
          const confirmEdit = confirm(
            `A record for date ${data.date} already exists.\nDo you want to edit and update that record?`
          );
          if (confirmEdit) {
            await this.editEntry(existing.id);
          }
          return;
        }

        await window.tasmacDB.saveRemittance(data);
        App.showToast(`Daily remittance for ${data.date} saved successfully!`, 'success');
        this.clearForm();
      }

      await this.renderHistory();
      // Notify other modules to recalculate
      App.refreshAllData();
    } catch (err) {
      console.error(err);
      App.showToast(err.message || 'Error saving remittance.', 'error');
    }
  },

  async editEntry(id) {
    if (window.AuthManager && !window.AuthManager.isAdmin()) {
      App.showToast('Access Denied: Only Admin (ANNADURAI M) can edit remittance entries.', 'error');
      return;
    }

    const item = await window.tasmacDB.getRemittanceById(id);
    if (!item) return;

    this.editingId = item.id;
    document.getElementById('rem-date').value = item.date;
    document.getElementById('rem-date').readOnly = true;

    if (document.getElementById('rem-shop-number')) {
      document.getElementById('rem-shop-number').value = item.shop_number || '11066';
    }
    if (document.getElementById('rem-serial-number')) {
      document.getElementById('rem-serial-number').value = item.serial_number || '';
    }

    // Section B No. 5: Total Scan Collection Amount
    document.getElementById('rem-scan').value = item.scan_amount || '';

    // Section C Buyback Sold Bottle & Section B Sales Bottle
    const soldBtls = item.buy_back_sold_bottle !== undefined ? item.buy_back_sold_bottle : 0;
    document.getElementById('rem-sold-bottle').value = soldBtls || '';
    if (document.getElementById('rem-sales-bottle')) {
      document.getElementById('rem-sales-bottle').value = soldBtls || '';
    }

    document.getElementById('rem-upi').value = item.upi_amount || '';
    document.getElementById('rem-card').value = item.card_amount || '';
    document.getElementById('rem-online').value = item.online_amount || '';
    if (document.getElementById('rem-buyback-opening')) {
      document.getElementById('rem-buyback-opening').value = item.buyback_opening_balance !== undefined ? item.buyback_opening_balance : '';
    }
    document.getElementById('rem-return-bottle').value = item.buy_back_return_bottle || '';
    document.getElementById('rem-notes').value = item.notes || '';

    const openingBadge = document.getElementById('rem-opening-badge');
    if (openingBadge) {
      openingBadge.textContent = 'Editing Mode';
      openingBadge.style.color = '#d35400';
    }

    const submitBtn = document.getElementById('rem-btn-submit');
    if (submitBtn) {
      submitBtn.innerHTML = `✏️ UPDATE REMITTANCE (${item.date})`;
      submitBtn.className = 'btn btn-gold';
    }

    this.calculateLive();
    document.getElementById('remittance-form').scrollIntoView({ behavior: 'smooth' });
    App.showToast(`Editing record for ${item.date}. Make changes and click Update.`, 'info');
  },

  async deleteEntry(id) {
    if (window.AuthManager && !window.AuthManager.isAdmin()) {
      App.showToast('Access Denied: Only Admin (ANNADURAI M) can delete remittance entries.', 'error');
      return;
    }

    const item = await window.tasmacDB.getRemittanceById(id);
    if (!item) return;

    const ok = confirm(
      `Are you sure you want to delete the remittance for ${item.date}?\nThis will also update the available bottle inventory balance.`
    );
    if (!ok) return;

    try {
      await window.tasmacDB.deleteRemittance(id);
      App.showToast(`Remittance for ${item.date} deleted.`, 'success');
      if (this.editingId === id) this.clearForm();
      await this.renderHistory();
      App.refreshAllData();
    } catch (err) {
      App.showToast(err.message || 'Error deleting remittance.', 'error');
    }
  },

  async clearForm() {
    this.editingId = null;
    const form = document.getElementById('remittance-form');
    if (form) form.reset();
    const dateEl = document.getElementById('rem-date');
    if (dateEl) dateEl.readOnly = false;
    this.setDefaultDate();

    const submitBtn = document.getElementById('rem-btn-submit');
    if (submitBtn) {
      submitBtn.innerHTML = `💾 SAVE DAILY REMITTANCE`;
      submitBtn.className = 'btn btn-primary';
    }

    await this.onDateChanged();
  },

  async renderHistory() {
    const listContainer = document.getElementById('rem-history-container');
    const tableBody = document.getElementById('rem-history-tbody');
    const monthlyBar = document.getElementById('rem-monthly-summary-bar');
    if (!listContainer || !tableBody) return;

    const all = await window.tasmacDB.getAllRemittances();
    const searchQuery = (document.getElementById('rem-history-search')?.value || '').trim();
    const filterPeriod = document.getElementById('rem-filter-period')?.value || 'all';
    const monthPickerVal = document.getElementById('rem-month-picker')?.value || '';

    const now = new Date();
    let filtered = all.filter((r) => {
      // Date search filter
      if (searchQuery && !r.date.includes(searchQuery)) return false;

      // Period filter
      if (filterPeriod === 'weekly') {
        const itemDate = new Date(r.date);
        const diffDays = (now - itemDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 7) return false;
      } else if (filterPeriod === 'monthly') {
        if (monthPickerVal) {
          if (!r.date.startsWith(monthPickerVal)) return false;
        } else {
          const itemDate = new Date(r.date);
          if (
            itemDate.getFullYear() !== now.getFullYear() ||
            itemDate.getMonth() !== now.getMonth()
          ) {
            return false;
          }
        }
      }
      return true;
    });

    // Render Monthly Aggregated Bar if monthly filter is selected
    if (monthlyBar) {
      if (filterPeriod === 'monthly') {
        monthlyBar.style.display = 'block';
        const displayMonth = monthPickerVal || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const titleEl = document.getElementById('rem-monthly-summary-title');
        const countEl = document.getElementById('rem-monthly-record-count');
        if (titleEl) titleEl.textContent = `MONTHLY REMITTANCE REPORT (${displayMonth})`;
        if (countEl) countEl.textContent = `${filtered.length} Days Recorded`;

        let mSales = 0, mColl = 0, mCash = 0, mDigital = 0, mSold = 0, mRet = 0, mTotalRem = 0;
        filtered.forEach((r) => {
          mSales += parseFloat(r.total_sales_amount) || 0;
          mColl += parseFloat(r.total_collection !== undefined ? r.total_collection : (r.scan_amount || 0)) || 0;
          mCash += parseFloat(r.cash_remittance !== undefined ? r.cash_remittance : r.cash_sales) || 0;
          mDigital += (parseFloat(r.upi_amount) || 0) + (parseFloat(r.card_amount) || 0) + (parseFloat(r.online_amount) || 0);
          mSold += parseInt(r.buy_back_sold_bottle) || 0;
          mRet += parseInt(r.buy_back_return_bottle) || 0;
          mTotalRem += parseFloat(r.total_remittance_amount !== undefined ? r.total_remittance_amount : r.total_all_payments) || 0;
        });

        const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setT('rem-mon-sales', ExportUtils.formatINR(mSales));
        setT('rem-mon-collections', ExportUtils.formatINR(mColl));
        setT('rem-mon-cash', ExportUtils.formatINR(mCash));
        setT('rem-mon-digital', ExportUtils.formatINR(mDigital));
        setT('rem-mon-bottles', `${mSold} Sold / ${mRet} Ret`);
        setT('rem-mon-total-remittance', ExportUtils.formatINR(mTotalRem));
      } else {
        monthlyBar.style.display = 'none';
      }
    }

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="12" class="text-center" style="padding: 24px; color: #777;">No remittance records found.</td></tr>`;
      listContainer.innerHTML = `<div class="text-center" style="padding: 24px; color: #777;">No remittance records found.</div>`;
      return;
    }

    const isAdmin = window.AuthManager ? window.AuthManager.isAdmin() : true;

    // Render Desktop Table Rows
    tableBody.innerHTML = filtered
      .map((r) => {
        const cashRem = r.cash_remittance !== undefined ? r.cash_remittance : r.cash_sales;
        const totalRem = r.total_remittance_amount !== undefined ? r.total_remittance_amount : r.total_all_payments;
        const prevRem = r.previous_buyback_remittance !== undefined ? r.previous_buyback_remittance : 0;
        const diff = r.cash_difference !== undefined ? r.cash_difference : 0;
        let diffBadge = '';
        if (diff < -0.01) {
          diffBadge = `<span style="display:inline-block; font-size:10px; background:#fde8e8; color:#9b1c1c; padding:2px 5px; border-radius:3px; margin-top:2px;">Short ${ExportUtils.formatINR(Math.abs(diff))}</span>`;
        } else if (diff > 0.01) {
          diffBadge = `<span style="display:inline-block; font-size:10px; background:#fef08a; color:#854d0e; padding:2px 5px; border-radius:3px; margin-top:2px;">Excess ${ExportUtils.formatINR(diff)}</span>`;
        }

        return `
        <tr>
          <td class="fw-bold">
            <div>${r.date}</div>
            <div style="font-size:10px; color:#666;">${r.serial_number || ''}</div>
          </td>
          <td class="text-right">
            <div>${ExportUtils.formatINR(r.total_sales_amount)}</div>
            <div style="font-size:10px; color:#555;">${r.sales_bottle ? r.sales_bottle + ' bot' : ''}</div>
          </td>
          <td class="text-right">${ExportUtils.formatINR(r.scan_amount)}</td>
          <td class="text-right">${ExportUtils.formatINR(r.upi_amount)}</td>
          <td class="text-right">${ExportUtils.formatINR(r.card_amount)}</td>
          <td class="text-right">${ExportUtils.formatINR(r.online_amount)}</td>
          <td class="text-right">${r.buy_back_return_bottle}</td>
          <td class="text-right" style="color:#0e3820; font-weight:600;">${ExportUtils.formatINR(prevRem)}</td>
          <td class="text-right fw-bold" style="color: #145a32;">
            <div>${ExportUtils.formatINR(cashRem)}</div>
            ${diffBadge}
          </td>
          <td class="text-right fw-bold" style="color: #0e3820;">${ExportUtils.formatINR(totalRem)}</td>
          <td class="text-center">
            ${isAdmin ? `
              <button class="btn btn-sm btn-secondary" onclick="Module1Remittance.editEntry(${r.id})">✏️</button>
              <button class="btn btn-sm btn-danger" style="margin-left: 4px;" onclick="Module1Remittance.deleteEntry(${r.id})">🗑️</button>
            ` : `<span style="font-size:12px; color:#888;">👁️ View</span>`}
          </td>
        </tr>`;
      })
      .join('');

    // Render Mobile Cards
    listContainer.innerHTML = filtered
      .map((r) => {
        const cashRem = r.cash_remittance !== undefined ? r.cash_remittance : r.cash_sales;
        const totalRem = r.total_remittance_amount !== undefined ? r.total_remittance_amount : r.total_all_payments;
        const prevRem = r.previous_buyback_remittance !== undefined ? r.previous_buyback_remittance : 0;
        const diff = r.cash_difference !== undefined ? r.cash_difference : 0;

        let diffHtml = '';
        if (diff < -0.01) {
          diffHtml = `<div class="history-card-row" style="background:#fde8e8; padding:4px 6px; border-radius:4px;">
            <span class="label" style="color:#9b1c1c; font-weight:700;">⚠️ Cash Shortage</span>
            <span class="value" style="color:#9b1c1c; font-weight:800;">-${ExportUtils.formatINR(Math.abs(diff))}</span>
          </div>`;
        } else if (diff > 0.01) {
          diffHtml = `<div class="history-card-row" style="background:#fef08a; padding:4px 6px; border-radius:4px;">
            <span class="label" style="color:#854d0e; font-weight:700;">ℹ️ Cash Excess</span>
            <span class="value" style="color:#854d0e; font-weight:800;">+${ExportUtils.formatINR(diff)}</span>
          </div>`;
        }

        return `
        <div class="history-card-item">
          <div class="history-card-header">
            <div>
              <div class="history-card-date">📅 ${r.date}</div>
              <div style="font-size:11px; color:#666; font-weight:600;"># ${r.serial_number || 'REM-11066'}</div>
            </div>
            <div>
              ${isAdmin ? `
                <button class="btn btn-sm btn-secondary" onclick="Module1Remittance.editEntry(${r.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="Module1Remittance.deleteEntry(${r.id})">Delete</button>
              ` : `<span style="font-size:11px; color:#888; background:#e8f5e9; padding:2px 6px; border-radius:4px; font-weight:700;">👁️ View-Only</span>`}
            </div>
          </div>
          <div class="history-card-grid">
            <div class="history-card-row">
              <span class="label">Total Scan Collection</span>
              <span class="value" style="color: #0e3820; font-weight:800;">${ExportUtils.formatINR(r.scan_amount)}</span>
            </div>
            <div class="history-card-row">
              <span class="label">Total Sales Amount</span>
              <span class="value" style="color: #145a32; font-weight:800;">${ExportUtils.formatINR(r.total_sales_amount)}</span>
            </div>
            <div class="history-card-row">
              <span class="label">Total Remittance Amount</span>
              <span class="value" style="color: #0e3820; font-weight:800;">${ExportUtils.formatINR(totalRem)}</span>
            </div>
            <div class="history-card-row">
              <span class="label">Cash Remittance (Req.)</span>
              <span class="value" style="color: #145a32; font-weight:700;">${ExportUtils.formatINR(cashRem)}</span>
            </div>
            <div class="history-card-row">
              <span class="label">Actual Cash Submitted</span>
              <span class="value" style="color: #145a32; font-weight:700;">${ExportUtils.formatINR(r.actual_cash_submitted !== undefined ? r.actual_cash_submitted : r.total_sales_amount)}</span>
            </div>
            ${diffHtml}
            <div class="history-card-row">
              <span class="label">Prev Buyback Remittance</span>
              <span class="value" style="font-weight:600;">${ExportUtils.formatINR(prevRem)}</span>
            </div>
            <div class="history-card-row">
              <span class="label">UPI / Card / Online</span>
              <span class="value">${ExportUtils.formatINR(r.upi_amount)} / ${ExportUtils.formatINR(r.card_amount)} / ${ExportUtils.formatINR(r.online_amount)}</span>
            </div>
            <div class="history-card-row">
              <span class="label">Bottles (Sold / Return)</span>
              <span class="value">${r.buy_back_sold_bottle || 0} Sold / ${r.buy_back_return_bottle || 0} Ret</span>
            </div>
            <div class="history-card-row">
              <span class="label">Buyback Cash in Hand</span>
              <span class="value" style="font-weight:700; color:#0e3820;">${ExportUtils.formatINR(r.buyback_closing_cash_in_hand !== undefined ? r.buyback_closing_cash_in_hand : (r.buy_back_sold_bottle * 10))}</span>
            </div>
          </div>
        </div>`;
      })
      .join('');
  },

  async exportExcel() {
    const records = await window.tasmacDB.getAllRemittances();
    if (records.length === 0) {
      App.showToast('No records to export.', 'error');
      return;
    }

    const headers = [
      'Date',
      'Serial Number',
      'Shop Number',
      'Total Scan Collection Amount (₹)',
      'Total Sales Amount (₹)',
      'Sales Bottles',
      'UPI Amount (₹)',
      'Card Amount (₹)',
      'Online Amount (₹)',
      'Buyback Opening Balance (₹)',
      'Buyback Sold Bottles',
      'Buyback Sold Amount (₹)',
      'Buyback Return Bottles',
      'Buyback Return Amount (₹)',
      'Previous Buyback Remittance (₹)',
      'Total Collection (₹)',
      'Cash Remittance (₹)',
      'Buyback Closing Cash in Hand (₹)',
      'Actual Cash Submitted (₹)',
      'Cash Difference (₹)',
      'Total Remittance Amount (₹)',
      'Remarks',
    ];

    const rows = records.map((r) => [
      r.date,
      r.serial_number || '',
      r.shop_number || '11066',
      r.scan_amount,
      r.total_sales_amount,
      r.sales_bottle || r.buy_back_sold_bottle || 0,
      r.upi_amount,
      r.card_amount,
      r.online_amount,
      r.buyback_opening_balance !== undefined ? r.buyback_opening_balance : 0,
      r.buy_back_sold_bottle,
      r.buy_back_sold_amount,
      r.buy_back_return_bottle,
      r.buy_back_return_amount,
      r.previous_buyback_remittance !== undefined ? r.previous_buyback_remittance : 0,
      r.total_collection !== undefined ? r.total_collection : (r.scan_amount || 0),
      r.cash_remittance !== undefined ? r.cash_remittance : r.cash_sales,
      r.buyback_closing_cash_in_hand !== undefined ? r.buyback_closing_cash_in_hand : r.buy_back_sold_amount,
      r.actual_cash_submitted !== undefined && r.actual_cash_submitted !== null ? r.actual_cash_submitted : r.total_sales_amount,
      r.cash_difference !== undefined ? r.cash_difference : 0,
      r.total_remittance_amount !== undefined ? r.total_remittance_amount : r.total_all_payments,
      r.notes || '',
    ]);

    ExportUtils.downloadCSV('TASMAC_Shop11066_Daily_Remittance_Register', headers, rows);
    App.showToast('Daily Remittance exported to Excel successfully!', 'success');
  },

  async exportPDF() {
    const records = await window.tasmacDB.getAllRemittances();
    if (records.length === 0) {
      App.showToast('No records to print or export.', 'error');
      return;
    }

    let totScan = 0, totSales = 0, totSalesBot = 0, totUpi = 0, totCard = 0, totOnline = 0;
    let totSoldBot = 0, totRetBot = 0, totPrevRem = 0, totCashRem = 0, totTotalRem = 0;

    const tableRows = records
      .map((r) => {
        totScan += parseFloat(r.scan_amount) || 0;
        totSales += parseFloat(r.total_sales_amount) || 0;
        totSalesBot += parseInt(r.sales_bottle || r.buy_back_sold_bottle) || 0;
        totUpi += parseFloat(r.upi_amount) || 0;
        totCard += parseFloat(r.card_amount) || 0;
        totOnline += parseFloat(r.online_amount) || 0;
        totSoldBot += parseInt(r.buy_back_sold_bottle) || 0;
        totRetBot += parseInt(r.buy_back_return_bottle) || 0;
        const prevR = r.previous_buyback_remittance !== undefined ? r.previous_buyback_remittance : 0;
        const cashR = r.cash_remittance !== undefined ? r.cash_remittance : r.cash_sales;
        const totalR = r.total_remittance_amount !== undefined ? r.total_remittance_amount : r.total_all_payments;
        totPrevRem += prevR;
        totCashRem += cashR;
        totTotalRem += totalR;

        return `
        <tr>
          <td>
            <b>${r.date}</b><br/>
            <span style="font-size:8.5pt; color:#666;">${r.serial_number || ''}</span>
          </td>
          <td class="text-right">${ExportUtils.formatINR(r.scan_amount)}</td>
          <td class="text-right">
            ${ExportUtils.formatINR(r.total_sales_amount)}<br/>
            <span style="font-size:8.5pt; color:#555;">${r.sales_bottle ? r.sales_bottle + ' bot' : ''}</span>
          </td>
          <td class="text-right">${ExportUtils.formatINR(r.upi_amount)}</td>
          <td class="text-right">${ExportUtils.formatINR(r.card_amount)}</td>
          <td class="text-right">${ExportUtils.formatINR(r.online_amount)}</td>
          <td class="text-right">${r.buy_back_sold_bottle} / ${r.buy_back_return_bottle}</td>
          <td class="text-right">${ExportUtils.formatINR(prevR)}</td>
          <td class="text-right fw-bold" style="color: #145a32;">${ExportUtils.formatINR(cashR)}</td>
          <td class="text-right fw-bold" style="color: #0e3820;">${ExportUtils.formatINR(totalR)}</td>
        </tr>`;
      })
      .join('');

    const html = `
      <div class="a4-header">
        <div class="a4-org-title">TAMIL NADU STATE MARKETING CORPORATION LIMITED (TASMAC)</div>
        <div class="a4-shop-title">SHOP NO. 11066 – IN-CHARGE: ANNADURAI M</div>
        <div class="a4-report-name">DAILY REMITTANCE & SALES TRANSACTION AUDIT REGISTER</div>
      </div>

      <div class="a4-meta-bar">
        <div><b>Total Days Recorded:</b> ${records.length} Day(s)</div>
        <div><b>Shop Number:</b> 11066</div>
        <div><b>Generated:</b> ${new Date().toLocaleString()}</div>
        <div><b>Database:</b> Offline Local Storage</div>
      </div>

      <!-- Financial KPI Cards -->
      <div class="a4-kpi-grid">
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Cumulative Total Scan Collection</div>
          <div class="a4-kpi-value">${ExportUtils.formatINR(totScan)}</div>
        </div>
        <div class="a4-kpi-card gold">
          <div class="a4-kpi-label">Cumulative Total Sales Amount</div>
          <div class="a4-kpi-value">${ExportUtils.formatINR(totSales)}</div>
        </div>
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Required Cash Remittance</div>
          <div class="a4-kpi-value">${ExportUtils.formatINR(totCashRem)}</div>
        </div>
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Cumulative Total Remittance</div>
          <div class="a4-kpi-value">${ExportUtils.formatINR(totTotalRem)}</div>
        </div>
      </div>

      <!-- Transactions Register Table -->
      <div class="a4-section-title">DAILY REMITTANCE REGISTER (OFFICIAL REGISTER FORMAT)</div>
      <table class="a4-table">
        <thead>
          <tr>
            <th style="width: 12%;">Date & Serial</th>
            <th style="width: 11%;" class="text-right">Scan Coll</th>
            <th style="width: 11%;" class="text-right">Total Sales</th>
            <th style="width: 8%;" class="text-right">UPI</th>
            <th style="width: 8%;" class="text-right">Card</th>
            <th style="width: 8%;" class="text-right">Online</th>
            <th style="width: 10%;" class="text-right">Sold / Ret</th>
            <th style="width: 10%;" class="text-right">Prev BB Rem</th>
            <th style="width: 11%;" class="text-right">Cash Rem</th>
            <th style="width: 11%;" class="text-right">Total Rem</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
        <tfoot>
          <tr>
            <td>TOTALS:</td>
            <td class="text-right">${ExportUtils.formatINR(totScan)}</td>
            <td class="text-right">${ExportUtils.formatINR(totSales)}</td>
            <td class="text-right">${ExportUtils.formatINR(totUpi)}</td>
            <td class="text-right">${ExportUtils.formatINR(totCard)}</td>
            <td class="text-right">${ExportUtils.formatINR(totOnline)}</td>
            <td class="text-right">${totSoldBot} / ${totRetBot}</td>
            <td class="text-right">${ExportUtils.formatINR(totPrevRem)}</td>
            <td class="text-right">${ExportUtils.formatINR(totCashRem)}</td>
            <td class="text-right">${ExportUtils.formatINR(totTotalRem)}</td>
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
          <div>DISTRICT AUDIT / ACCOUNTS OFFICER</div>
          <div class="a4-sign-role">TASMAC Financial Verification</div>
        </div>
      </div>

      <div class="a4-footer">
        <div>Generated: ${new Date().toLocaleString()} | Official Remittance Record</div>
        <div>TASMAC Shop Management System (Shop No. 11066)</div>
      </div>
    `;

    ExportUtils.printContent('TASMAC_Remittance_Register_Report', html, false);
  },

  async printBluetooth() {
    const records = await window.tasmacDB.getAllRemittances();
    if (records.length === 0) {
      App.showToast('No remittance records found to print.', 'error');
      return;
    }
    const escText = ExportUtils.buildRemittanceEscPos(records);
    BluetoothPrintManager.printOrPrompt(escText);
  },
};

window.Module1Remittance = Module1Remittance;
