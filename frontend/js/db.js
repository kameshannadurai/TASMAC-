/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Offline Local Database Engine (IndexedDB)
 * 100% Offline, Zero Internet Dependency, Permanent Local Storage
 */

const DB_NAME = 'TASMAC_SHOP_11066_DB';
const DB_VERSION = 2;

class TasmacDatabase {
  constructor() {
    this.db = null;
    this.readyPromise = this.init();
  }

  init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Table 1: Daily Remittances
        if (!db.objectStoreNames.contains('remittances')) {
          const remStore = db.createObjectStore('remittances', { keyPath: 'id', autoIncrement: true });
          remStore.createIndex('date', 'date', { unique: true });
        }

        // Table 2: Vendor Receipts
        if (!db.objectStoreNames.contains('vendor_receipts')) {
          const recStore = db.createObjectStore('vendor_receipts', { keyPath: 'id', autoIncrement: true });
          recStore.createIndex('receipt_number', 'receipt_number', { unique: true });
          recStore.createIndex('receipt_date', 'receipt_date', { unique: false });
          recStore.createIndex('vendor_name', 'vendor_name', { unique: false });
        }

        // Table 3: Audit History
        if (!db.objectStoreNames.contains('audit_history')) {
          const auditStore = db.createObjectStore('audit_history', { keyPath: 'id', autoIncrement: true });
          auditStore.createIndex('entity_type', 'entity_type', { unique: false });
          auditStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // Table 4: App Settings & User info
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Table 5: Pending Sync Queue (Offline-first mutation buffer)
        if (!db.objectStoreNames.contains('pending_sync_queue')) {
          const syncStore = db.createObjectStore('pending_sync_queue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // Table 6: Local Cached Users
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          userStore.createIndex('username', 'username', { unique: true });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async ready() {
    if (!this.db) {
      await this.readyPromise;
    }
    return this.db;
  }

  // ---------------------------------------------------------
  // AUDIT HISTORY
  // ---------------------------------------------------------
  async logAudit(entity_type, entity_id, action, changes) {
    const db = await this.ready();
    const currentUser = window.AuthManager ? window.AuthManager.getCurrentUser() : null;
    const userName = currentUser ? currentUser.name : 'ANNADURAI M';
    const userRole = currentUser ? currentUser.role : 'ADMIN';

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['audit_history'], 'readwrite');
      const store = tx.objectStore('audit_history');
      store.add({
        entity_type,
        entity_id: Number(entity_id) || 0,
        action,
        user_name: userName,
        user_role: userRole,
        changes_json: JSON.stringify(changes || {}),
        created_at: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------------------------------------------------------
  // SYNC QUEUE & REMOTE SYNC UPSERTS
  // ---------------------------------------------------------
  async enqueueSync(action, entity_type, entity_id, data) {
    try {
      const db = await this.ready();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['pending_sync_queue'], 'readwrite');
        const store = tx.objectStore('pending_sync_queue');
        const item = {
          action, // 'CREATE' | 'UPDATE' | 'DELETE'
          entity_type, // 'REMITTANCE' | 'VENDOR_RECEIPT'
          entity_id: Number(entity_id) || 0,
          data: data || {},
          created_at: new Date().toISOString(),
        };
        const req = store.add(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('enqueueSync failed:', e);
    }
  }

  async getPendingSyncQueue() {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['pending_sync_queue'], 'readonly');
      const store = tx.objectStore('pending_sync_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async removeSyncQueueItem(id) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['pending_sync_queue'], 'readwrite');
      const store = tx.objectStore('pending_sync_queue');
      const req = store.delete(Number(id));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async clearSyncQueue() {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['pending_sync_queue'], 'readwrite');
      const store = tx.objectStore('pending_sync_queue');
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async saveRemittanceFromSync(remoteItem) {
    const db = await this.ready();
    const existing = await this.getRemittanceByDate(remoteItem.date);
    const calculated = this.calculateRemittanceValues(remoteItem);
    calculated.created_at = remoteItem.created_at || new Date().toISOString();
    calculated.updated_at = remoteItem.updated_at || new Date().toISOString();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances'], 'readwrite');
      const store = tx.objectStore('remittances');
      if (existing) {
        // Last-write-wins conflict resolution
        calculated.id = existing.id;
        const req = store.put(calculated);
        req.onsuccess = () => resolve(calculated);
        req.onerror = () => reject(req.error);
      } else {
        delete calculated.id;
        const req = store.add(calculated);
        req.onsuccess = (e) => {
          calculated.id = e.target.result;
          resolve(calculated);
        };
        req.onerror = () => reject(req.error);
      }
    });
  }

  async deleteRemittanceFromSync(date) {
    const existing = await this.getRemittanceByDate(date);
    if (!existing) return false;
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances'], 'readwrite');
      const store = tx.objectStore('remittances');
      const req = store.delete(Number(existing.id));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async saveVendorReceiptFromSync(remoteItem) {
    const db = await this.ready();
    const all = await this.getAllVendorReceipts();
    const existing = all.find((r) => r.receipt_number === remoteItem.receipt_number);
    const totals = this.calculateReceiptTotals(remoteItem.liquor_items, remoteItem.beer_items);

    const receipt = {
      ...remoteItem,
      ...totals,
      created_at: remoteItem.created_at || new Date().toISOString(),
      updated_at: remoteItem.updated_at || new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['vendor_receipts'], 'readwrite');
      const store = tx.objectStore('vendor_receipts');
      if (existing) {
        receipt.id = existing.id;
        const req = store.put(receipt);
        req.onsuccess = () => resolve(receipt);
        req.onerror = () => reject(req.error);
      } else {
        delete receipt.id;
        const req = store.add(receipt);
        req.onsuccess = (e) => {
          receipt.id = e.target.result;
          resolve(receipt);
        };
        req.onerror = () => reject(req.error);
      }
    });
  }

  async deleteVendorReceiptFromSync(receipt_number) {
    const all = await this.getAllVendorReceipts();
    const existing = all.find((r) => r.receipt_number === receipt_number);
    if (!existing) return false;
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['vendor_receipts'], 'readwrite');
      const store = tx.objectStore('vendor_receipts');
      const req = store.delete(Number(existing.id));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ---------------------------------------------------------
  // MODULE 1: REMITTANCE CALCULATIONS & CRUD
  // ---------------------------------------------------------
  calculateRemittanceValues(data) {
    const scan = parseFloat(data.scan_amount) || 0.0;
    const upi = parseFloat(data.upi_amount) || 0.0;
    const card = parseFloat(data.card_amount) || 0.0;
    const online = parseFloat(data.online_amount) || 0.0;
    const opening_buyback = parseFloat(data.buyback_opening_balance) || 0.0;

    const sold_bottles = parseInt(data.buy_back_sold_bottle) || 0;
    const return_bottles = parseInt(data.buy_back_return_bottle) || 0;

    // 2. Sales Bottle = Buyback Sold Bottle
    const sales_btls = sold_bottles;

    // 3. Buyback Sold Amount = Buyback Sold Bottle * 10
    const buy_back_sold_amount = sold_bottles * 10;

    // 4. Total Sales Amount = TOTAL SCAN COLLECTION AMOUNT - Buyback Sold Amount
    let total_sales = 0.0;
    if (scan > 0 || !data.total_sales_amount) {
      total_sales = scan - buy_back_sold_amount;
    } else {
      total_sales = parseFloat(data.total_sales_amount) || 0.0;
    }

    // 5. Buyback Return Amount = Buyback Return Bottle * 10
    const buy_back_return_amount = return_bottles * 10;

    // 6. Previous Buyback Remittance = Buyback Opening Balance - Buyback Return Amount Paid
    const previous_buyback_remittance = opening_buyback - buy_back_return_amount;

    // 7. NEW FORMULA: Actual Cash Submitted = TOTAL SCAN COLLECTION AMOUNT - Buyback Sold Amount - UPI Amount - Card Amount + Previous Buyback Remittance
    const act_cash = scan - buy_back_sold_amount - upi - card + previous_buyback_remittance;

    // 8. Total Collection = Total Sales Amount + Buyback Sold Amount
    const total_collection = total_sales + buy_back_sold_amount;

    // 9. Cash Remittance = Total Sales Amount - UPI Amount - Card Amount - Online Amount + Previous Buyback Remittance
    const cash_remittance = total_sales - upi - card - online + previous_buyback_remittance;

    // Buyback Closing Cash in Hand = Buyback Sold Amount
    const buyback_closing_cash_in_hand = buy_back_sold_amount;

    // Total Remittance Amount = Total Sales Amount + Previous Buyback Remittance
    const total_remittance_amount = total_sales + previous_buyback_remittance;

    // Cash Difference = Actual Cash Submitted - Cash Remittance
    const cash_difference = act_cash - cash_remittance;

    // Compatibility fields:
    const cash_sales = cash_remittance;
    const total_all_payments = total_collection;

    return {
      date: data.date,
      shop_number: String(data.shop_number || '11066'),
      serial_number: String(data.serial_number || ''),
      scan_amount: scan,
      total_sales_amount: Math.round(total_sales * 100) / 100,
      sales_bottle: sales_btls,
      upi_amount: upi,
      card_amount: card,
      online_amount: online,
      buyback_opening_balance: opening_buyback,
      buy_back_sold_bottle: sold_bottles,
      buy_back_sold_amount: buy_back_sold_amount,
      buy_back_return_bottle: return_bottles,
      buy_back_return_amount: buy_back_return_amount,
      previous_buyback_remittance: Math.round(previous_buyback_remittance * 100) / 100,
      total_collection: Math.round(total_collection * 100) / 100,
      cash_remittance: Math.round(cash_remittance * 100) / 100,
      buyback_amount_return_paid: buy_back_return_amount,
      buyback_closing_cash_in_hand: buyback_closing_cash_in_hand,
      total_remittance_amount: Math.round(total_remittance_amount * 100) / 100,
      actual_cash_submitted: Math.round(act_cash * 100) / 100,
      cash_difference: Math.round(cash_difference * 100) / 100,
      cash_sales: Math.round(cash_sales * 100) / 100,
      total_all_payments: Math.round(total_all_payments * 100) / 100,
      notes: data.notes || '',
      updated_at: new Date().toISOString(),
    };
  }

  async getPreviousRemittance(dateStr) {
    const list = await this.getAllRemittances();
    const prev = list.filter((r) => r.date < dateStr).sort((a, b) => b.date.localeCompare(a.date));
    return prev.length > 0 ? prev[0] : null;
  }

  async generateRemittanceSerial(dateStr) {
    const list = await this.getAllRemittances();
    const count = list.length + 1;
    const cleanDate = (dateStr || '').replace(/-/g, '');
    return `REM-11066-${cleanDate}-${String(count).padStart(3, '0')}`;
  }

  async getRemittanceByDate(dateStr) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances'], 'readonly');
      const store = tx.objectStore('remittances');
      const index = store.index('date');
      const req = index.get(dateStr);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getRemittanceById(id) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances'], 'readonly');
      const store = tx.objectStore('remittances');
      const req = store.get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllRemittances() {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances'], 'readonly');
      const store = tx.objectStore('remittances');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => b.date.localeCompare(a.date));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveRemittance(data) {
    const db = await this.ready();
    const existing = await this.getRemittanceByDate(data.date);
    if (existing) {
      throw new Error(`A remittance record already exists for ${data.date}. Please edit the existing entry.`);
    }

    const calculated = this.calculateRemittanceValues(data);
    calculated.created_at = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances'], 'readwrite');
      const store = tx.objectStore('remittances');
      const req = store.add(calculated);
      req.onsuccess = async (e) => {
        const id = e.target.result;
        calculated.id = id;
        this.logAudit('REMITTANCE', id, 'CREATE', { date: calculated.date, return_bottles: calculated.buy_back_return_bottle });
        await this.enqueueSync('CREATE', 'REMITTANCE', id, calculated);
        if (window.SyncManager) window.SyncManager.triggerSync();
        resolve(calculated);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async updateRemittance(id, data) {
    const db = await this.ready();
    const existing = await this.getRemittanceById(id);
    if (!existing) {
      throw new Error('Remittance entry not found.');
    }

    const calculated = this.calculateRemittanceValues({ ...existing, ...data });
    calculated.id = Number(id);
    calculated.created_at = existing.created_at;

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances'], 'readwrite');
      const store = tx.objectStore('remittances');
      const req = store.put(calculated);
      req.onsuccess = async () => {
        this.logAudit('REMITTANCE', id, 'UPDATE', data);
        await this.enqueueSync('UPDATE', 'REMITTANCE', id, calculated);
        if (window.SyncManager) window.SyncManager.triggerSync();
        resolve(calculated);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteRemittance(id) {
    const db = await this.ready();
    const existing = await this.getRemittanceById(id);
    if (!existing) {
      throw new Error('Remittance entry not found.');
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances'], 'readwrite');
      const store = tx.objectStore('remittances');
      const req = store.delete(Number(id));
      req.onsuccess = async () => {
        this.logAudit('REMITTANCE', id, 'DELETE', { date: existing.date, return_bottles: existing.buy_back_return_bottle });
        await this.enqueueSync('DELETE', 'REMITTANCE', id, { date: existing.date });
        if (window.SyncManager) window.SyncManager.triggerSync();
        resolve(true);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------
  // MODULE 3: VENDOR RECEIPT CALCULATIONS & CRUD
  // ---------------------------------------------------------
  calculateReceiptTotals(liquor_items, beer_items) {
    let total_liquor_qty = 0;
    let total_liquor_amount = 0.0;
    const processedLiquor = (liquor_items || []).map((item) => {
      const qty = parseInt(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0.0;
      const amount = Math.round(qty * rate * 100) / 100;
      total_liquor_qty += qty;
      total_liquor_amount += amount;
      return { size_label: item.size_label, rate, quantity: qty, amount };
    });

    let total_beer_qty = 0;
    let total_beer_amount = 0.0;
    const processedBeer = (beer_items || []).map((item) => {
      const qty = parseInt(item.quantity) || 0;
      const rate = parseFloat(item.rate) || 0.0;
      const amount = Math.round(qty * rate * 100) / 100;
      total_beer_qty += qty;
      total_beer_amount += amount;
      return { size_label: item.size_label, rate, quantity: qty, amount };
    });

    const total_bottles = total_liquor_qty + total_beer_qty;
    const total_payable = Math.round((total_liquor_amount + total_beer_amount) * 100) / 100;

    return {
      liquor_items: processedLiquor,
      beer_items: processedBeer,
      total_liquor_bottles: total_liquor_qty,
      total_liquor_amount: Math.round(total_liquor_amount * 100) / 100,
      total_beer_bottles: total_beer_qty,
      total_beer_amount: Math.round(total_beer_amount * 100) / 100,
      total_bottles,
      total_payable,
    };
  }

  async getAllVendorReceipts() {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['vendor_receipts'], 'readonly');
      const store = tx.objectStore('vendor_receipts');
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => b.receipt_date.localeCompare(a.receipt_date) || (b.id - a.id));
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getVendorReceiptById(id) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['vendor_receipts'], 'readonly');
      const store = tx.objectStore('vendor_receipts');
      const req = store.get(Number(id));
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async generateReceiptNumber(receipt_date) {
    const all = await this.getAllVendorReceipts();
    const dateFormatted = receipt_date.replace(/-/g, '');
    const countToday = all.filter((r) => r.receipt_date === receipt_date).length;
    const seq = String(countToday + 1).padStart(3, '0');
    return `RCP-11066-${dateFormatted}-${seq}`;
  }

  async saveVendorReceipt(data) {
    const db = await this.ready();
    const totals = this.calculateReceiptTotals(data.liquor_items, data.beer_items);
    const receipt_number = data.receipt_number || (await this.generateReceiptNumber(data.receipt_date));

    const receipt = {
      receipt_number,
      receipt_date: data.receipt_date,
      receipt_time: data.receipt_time || new Date().toTimeString().slice(0, 5),
      shop_number: '11066',
      scanner_number: data.scanner_number || '',
      tin_number: data.tin_number || '',
      vendor_name: (data.vendor_name !== undefined && data.vendor_name !== null) ? data.vendor_name.trim() : '',
      vendor_mobile: data.vendor_mobile || '',
      ...totals,
      notes: data.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['vendor_receipts'], 'readwrite');
      const store = tx.objectStore('vendor_receipts');
      const req = store.add(receipt);
      req.onsuccess = async (e) => {
        receipt.id = e.target.result;
        this.logAudit('VENDOR_RECEIPT', receipt.id, 'CREATE', { receipt_number, total_bottles: receipt.total_bottles });
        await this.enqueueSync('CREATE', 'VENDOR_RECEIPT', receipt.id, receipt);
        if (window.SyncManager) window.SyncManager.triggerSync();
        resolve(receipt);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async updateVendorReceipt(id, data) {
    const db = await this.ready();
    const existing = await this.getVendorReceiptById(id);
    if (!existing) {
      throw new Error('Vendor receipt not found.');
    }

    const totals = this.calculateReceiptTotals(
      data.liquor_items !== undefined ? data.liquor_items : existing.liquor_items,
      data.beer_items !== undefined ? data.beer_items : existing.beer_items
    );

    const updated = {
      ...existing,
      receipt_date: data.receipt_date || existing.receipt_date,
      receipt_time: data.receipt_time || existing.receipt_time,
      scanner_number: data.scanner_number !== undefined ? data.scanner_number : existing.scanner_number,
      tin_number: data.tin_number !== undefined ? data.tin_number : existing.tin_number,
      vendor_name: data.vendor_name !== undefined ? (data.vendor_name || '').trim() : existing.vendor_name,
      vendor_mobile: data.vendor_mobile !== undefined ? data.vendor_mobile : existing.vendor_mobile,
      notes: data.notes !== undefined ? data.notes : existing.notes,
      ...totals,
      updated_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['vendor_receipts'], 'readwrite');
      const store = tx.objectStore('vendor_receipts');
      const req = store.put(updated);
      req.onsuccess = async () => {
        this.logAudit('VENDOR_RECEIPT', id, 'UPDATE', { vendor: updated.vendor_name, total_bottles: updated.total_bottles });
        await this.enqueueSync('UPDATE', 'VENDOR_RECEIPT', id, updated);
        if (window.SyncManager) window.SyncManager.triggerSync();
        resolve(updated);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteVendorReceipt(id) {
    const db = await this.ready();
    const existing = await this.getVendorReceiptById(id);
    if (!existing) {
      throw new Error('Vendor receipt not found.');
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['vendor_receipts'], 'readwrite');
      const store = tx.objectStore('vendor_receipts');
      const req = store.delete(Number(id));
      req.onsuccess = async () => {
        this.logAudit('VENDOR_RECEIPT', id, 'DELETE', { receipt_number: existing.receipt_number, bottles: existing.total_bottles });
        await this.enqueueSync('DELETE', 'VENDOR_RECEIPT', id, { receipt_number: existing.receipt_number });
        if (window.SyncManager) window.SyncManager.triggerSync();
        resolve(true);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ---------------------------------------------------------
  // MODULE 2: BOTTLE INVENTORY SUMMARY & HISTORY
  // ---------------------------------------------------------
  async getInventorySummary() {
    const remittances = await this.getAllRemittances();
    const receipts = await this.getAllVendorReceipts();

    // 1. Total Bottles Available = Cumulative Buy Back Return Bottle entries
    let total_available = 0;
    let initial_date = null;
    if (remittances.length > 0) {
      // Find oldest date
      const sortedByDate = [...remittances].sort((a, b) => a.date.localeCompare(b.date));
      initial_date = sortedByDate[0].date;
      for (const r of remittances) {
        total_available += parseInt(r.buy_back_return_bottle) || 0;
      }
    }

    // 2. Total Vendor Empty Collected Bottles = Sum of saved vendor receipts
    let total_collected = 0;
    for (const rc of receipts) {
      total_collected += parseInt(rc.total_bottles) || 0;
    }

    // 3. Remaining Bottles = Available - Collected
    const remaining = total_available - total_collected;
    const has_warning = remaining < 0;

    return {
      initial_recorded_date: initial_date,
      total_available_bottles: total_available,
      total_vendor_collected_bottles: total_collected,
      remaining_bottles: remaining,
      has_warning: has_warning,
      warning_message: has_warning
        ? `WARNING: Vendor collected bottles (${total_collected}) exceed available bottles (${total_available}) by ${Math.abs(remaining)} bottles!`
        : null,
    };
  }

  async getBottleHistory(startDate, endDate) {
    const remittances = await this.getAllRemittances();
    const receipts = await this.getAllVendorReceipts();

    // Map by date
    const dateMap = new Map();

    for (const r of remittances) {
      const d = r.date;
      if (!dateMap.has(d)) dateMap.set(d, { returns: 0, collected: 0 });
      dateMap.get(d).returns += parseInt(r.buy_back_return_bottle) || 0;
    }

    for (const rc of receipts) {
      const d = rc.receipt_date;
      if (!dateMap.has(d)) dateMap.set(d, { returns: 0, collected: 0 });
      dateMap.get(d).collected += parseInt(rc.total_bottles) || 0;
    }

    const allDates = Array.from(dateMap.keys()).sort();
    const history = [];
    let runningAvailable = 0;
    let runningCollected = 0;

    for (const d of allDates) {
      const item = dateMap.get(d);
      runningAvailable += item.returns;
      runningCollected += item.collected;
      const remaining = runningAvailable - runningCollected;

      if ((!startDate || d >= startDate) && (!endDate || d <= endDate)) {
        history.push({
          date: d,
          buy_back_return_bottles: item.returns,
          vendor_collected_bottles: item.collected,
          remaining_bottles: remaining,
          cumulative_available: runningAvailable,
          cumulative_collected: runningCollected,
        });
      }
    }

    history.reverse();
    return history;
  }

  async getDashboardStats(todayStr) {
    const inv = await this.getInventorySummary();
    const todayRemittance = await this.getRemittanceByDate(todayStr);

    return {
      today_date: todayStr,
      today_total_sales: todayRemittance ? todayRemittance.total_sales_amount : 0.0,
      today_return_bottles: todayRemittance ? todayRemittance.buy_back_return_bottle : 0,
      total_available_bottles: inv.total_available_bottles,
      total_vendor_collected_bottles: inv.total_vendor_collected_bottles,
      remaining_bottles: inv.remaining_bottles,
      has_warning: inv.has_warning,
      warning_message: inv.warning_message,
    };
  }

  // ---------------------------------------------------------
  // BACKUP & RESTORE
  // ---------------------------------------------------------
  async exportBackupJSON() {
    const remittances = await this.getAllRemittances();
    const receipts = await this.getAllVendorReceipts();
    return {
      shop_number: '11066',
      welcome_name: 'ANNADURAI M',
      app_title: 'TASMAC SHOP NO. 11066',
      exported_at: new Date().toISOString(),
      remittances,
      vendor_receipts: receipts,
    };
  }

  async restoreBackupJSON(jsonData) {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances', 'vendor_receipts', 'audit_history'], 'readwrite');
      const remStore = tx.objectStore('remittances');
      const recStore = tx.objectStore('vendor_receipts');
      const auditStore = tx.objectStore('audit_history');

      remStore.clear();
      recStore.clear();
      auditStore.clear();

      for (const r of jsonData.remittances || []) {
        delete r.id; // re-index cleanly
        remStore.add(this.calculateRemittanceValues(r));
      }

      for (const rc of jsonData.vendor_receipts || []) {
        delete rc.id;
        const totals = this.calculateReceiptTotals(rc.liquor_items, rc.beer_items);
        recStore.add({ ...rc, ...totals });
      }

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async resetDatabase() {
    const db = await this.ready();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['remittances', 'vendor_receipts', 'audit_history', 'pending_sync_queue'], 'readwrite');
      tx.objectStore('remittances').clear();
      tx.objectStore('vendor_receipts').clear();
      tx.objectStore('audit_history').clear();
      if (tx.objectStoreNames.contains('pending_sync_queue')) {
        tx.objectStore('pending_sync_queue').clear();
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Global Singleton Instance
window.tasmacDB = new TasmacDatabase();

