/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * In-App Automated Self-Diagnostic & Test Runner
 * Validates Test Cases 1 through 7 directly within the device database
 */

const DiagnosticTests = {
  isRunning: false,

  async runAllTests(renderCallback) {
    if (this.isRunning) return;
    this.isRunning = true;

    const results = [];
    const updateLog = (testNum, name, status, details) => {
      results.push({ testNum, name, status, details });
      if (renderCallback) renderCallback([...results]);
    };

    try {
      // Backup existing data before running test
      const originalBackup = await window.tasmacDB.exportBackupJSON();

      // TEST 1: Buy Back Return = 100 -> Expected Available = 100
      updateLog(1, 'TEST 1 – Buy Back Return (Day 1)', 'RUNNING', 'Saving 100 return bottles...');
      await window.tasmacDB.resetDatabase();
      await window.tasmacDB.saveRemittance({
        date: '2026-11-01',
        total_sales_amount: 15000,
        upi_amount: 3000,
        card_amount: 2000,
        buy_back_sold_bottle: 20,
        buy_back_return_bottle: 100,
      });
      let inv1 = await window.tasmacDB.getInventorySummary();
      if (inv1.total_available_bottles === 100 && inv1.remaining_bottles === 100) {
        updateLog(1, 'TEST 1 – Buy Back Return (Day 1)', 'PASSED', 'Available Bottles = 100 (Expected: 100)');
      } else {
        updateLog(1, 'TEST 1 – Buy Back Return (Day 1)', 'FAILED', `Available Bottles = ${inv1.total_available_bottles}`);
      }

      // TEST 2: Next day Buy Back Return = 50 -> Expected Available = 150
      updateLog(2, 'TEST 2 – Additional Return (Day 2)', 'RUNNING', 'Adding 50 return bottles on Day 2...');
      await window.tasmacDB.saveRemittance({
        date: '2026-11-02',
        total_sales_amount: 18000,
        upi_amount: 4000,
        card_amount: 1000,
        buy_back_sold_bottle: 30,
        buy_back_return_bottle: 50,
      });
      let inv2 = await window.tasmacDB.getInventorySummary();
      if (inv2.total_available_bottles === 150 && inv2.remaining_bottles === 150) {
        updateLog(2, 'TEST 2 – Additional Return (Day 2)', 'PASSED', 'Available Bottles = 150 (Cumulative: 100 + 50)');
      } else {
        updateLog(2, 'TEST 2 – Additional Return (Day 2)', 'FAILED', `Available Bottles = ${inv2.total_available_bottles}`);
      }

      // TEST 3: Vendor Receipt Total Bottles = 80 -> Available = 150, Collected = 80, Remaining = 70
      updateLog(3, 'TEST 3 – Vendor Collection (80 Bottles)', 'RUNNING', 'Saving vendor receipt with 80 bottles...');
      const rc1 = await window.tasmacDB.saveVendorReceipt({
        receipt_date: '2026-11-03',
        receipt_time: '11:00',
        vendor_name: 'Murugan Agencies',
        liquor_items: [
          { size_label: '1000 ML', rate: 4.25, quantity: 20 },
          { size_label: '750/700/650 ML', rate: 3.25, quantity: 30 },
          { size_label: '375/360/355/350/325/320/300 ML', rate: 0.70, quantity: 10 },
          { size_label: '200/180/100 ML', rate: 0.59, quantity: 0 },
        ],
        beer_items: [
          { size_label: '650 ML', rate: 1.45, quantity: 20 },
          { size_label: '500/480/440 ML', rate: 0.72, quantity: 0 },
          { size_label: '325 ML', rate: 0.67, quantity: 0 },
        ],
      });
      let inv3 = await window.tasmacDB.getInventorySummary();
      if (inv3.total_available_bottles === 150 && inv3.total_vendor_collected_bottles === 80 && inv3.remaining_bottles === 70) {
        updateLog(3, 'TEST 3 – Vendor Collection (80 Bottles)', 'PASSED', 'Available = 150, Collected = 80, Remaining = 70');
      } else {
        updateLog(3, 'TEST 3 – Vendor Collection (80 Bottles)', 'FAILED', `Remaining = ${inv3.remaining_bottles}`);
      }

      // TEST 4: Edit Receipt from 80 to 90 -> Remaining = 60
      updateLog(4, 'TEST 4 – Edit Vendor Receipt (80 -> 90)', 'RUNNING', 'Updating receipt to 90 bottles...');
      await window.tasmacDB.updateVendorReceipt(rc1.id, {
        liquor_items: [
          { size_label: '1000 ML', rate: 4.25, quantity: 30 }, // +10 bottles
          { size_label: '750/700/650 ML', rate: 3.25, quantity: 30 },
          { size_label: '375/360/355/350/325/320/300 ML', rate: 0.70, quantity: 10 },
          { size_label: '200/180/100 ML', rate: 0.59, quantity: 0 },
        ],
        beer_items: [
          { size_label: '650 ML', rate: 1.45, quantity: 20 },
          { size_label: '500/480/440 ML', rate: 0.72, quantity: 0 },
          { size_label: '325 ML', rate: 0.67, quantity: 0 },
        ],
      });
      let inv4 = await window.tasmacDB.getInventorySummary();
      if (inv4.remaining_bottles === 60) {
        updateLog(4, 'TEST 4 – Edit Vendor Receipt (80 -> 90)', 'PASSED', 'Remaining Bottles = 60 (150 - 90 = 60)');
      } else {
        updateLog(4, 'TEST 4 – Edit Vendor Receipt (80 -> 90)', 'FAILED', `Remaining = ${inv4.remaining_bottles}`);
      }

      // TEST 5: Delete Receipt of 90 -> Remaining = 150
      updateLog(5, 'TEST 5 – Delete Vendor Receipt (90)', 'RUNNING', 'Deleting receipt...');
      await window.tasmacDB.deleteVendorReceipt(rc1.id);
      let inv5 = await window.tasmacDB.getInventorySummary();
      if (inv5.total_available_bottles === 150 && inv5.total_vendor_collected_bottles === 0 && inv5.remaining_bottles === 150) {
        updateLog(5, 'TEST 5 – Delete Vendor Receipt (90)', 'PASSED', 'Remaining Bottles restored to 150');
      } else {
        updateLog(5, 'TEST 5 – Delete Vendor Receipt (90)', 'FAILED', `Remaining = ${inv5.remaining_bottles}`);
      }

      // TEST 6: Application Persistence Verification
      updateLog(6, 'TEST 6 – Database Persistence Test', 'RUNNING', 'Checking IndexedDB tables...');
      const remList = await window.tasmacDB.getAllRemittances();
      if (remList.length === 2) {
        updateLog(6, 'TEST 6 – Database Persistence Test', 'PASSED', 'Saved records confirmed in local storage');
      } else {
        updateLog(6, 'TEST 6 – Database Persistence Test', 'FAILED', `Expected 2 entries, found ${remList.length}`);
      }

      // TEST 7: Offline Calculation & Warning Test
      updateLog(7, 'TEST 7 – Deficit Warning Test', 'RUNNING', 'Checking negative bottle balance warning...');
      const rcOver = await window.tasmacDB.saveVendorReceipt({
        receipt_date: '2026-11-04',
        vendor_name: 'Over-collector',
        liquor_items: [{ size_label: '1000 ML', rate: 4.25, quantity: 200 }],
        beer_items: [],
      });
      let inv7 = await window.tasmacDB.getInventorySummary();
      if (inv7.remaining_bottles === -50 && inv7.has_warning === true) {
        updateLog(7, 'TEST 7 – Deficit Warning Test', 'PASSED', 'Warning triggered: Collections (200) > Available (150)');
      } else {
        updateLog(7, 'TEST 7 – Deficit Warning Test', 'FAILED', 'Deficit warning did not trigger correctly');
      }

      // Restore user's original data if they had any
      if (originalBackup && (originalBackup.remittances?.length > 0 || originalBackup.vendor_receipts?.length > 0)) {
        await window.tasmacDB.restoreBackupJSON(originalBackup);
      } else {
        // Clear test entries
        await window.tasmacDB.resetDatabase();
      }

      App.refreshAllData();
    } catch (err) {
      console.error(err);
      results.push({ testNum: 'ERR', name: 'Error during self-test', status: 'FAILED', details: err.message });
      if (renderCallback) renderCallback([...results]);
    } finally {
      this.isRunning = false;
    }
  },
};

window.DiagnosticTests = DiagnosticTests;

