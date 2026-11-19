/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Sample realistic shop data loader for evaluation & testing
 */

const SampleDataLoader = {
  async loadSampleData() {
    const confirmLoad = confirm(
      "Load realistic sample shop data for TASMAC Shop No. 11066?\n" +
      "This will populate 5 days of daily remittances and 3 vendor receipts."
    );
    if (!confirmLoad) return;

    try {
      await window.tasmacDB.resetDatabase();

      // Sample Remittances (5 days)
      const sampleRemittances = [
        {
          date: "2026-11-01",
          total_sales_amount: 48500.0,
          scan_amount: 47200.0,
          upi_amount: 14500.0,
          card_amount: 5200.0,
          online_amount: 19700.0,
          buy_back_sold_bottle: 120, // 1200
          buy_back_return_bottle: 100, // 1000
          notes: "Sunday opening shift - smooth operations",
        },
        {
          date: "2026-11-02",
          total_sales_amount: 42100.0,
          scan_amount: 41000.0,
          upi_amount: 12000.0,
          card_amount: 4000.0,
          online_amount: 16000.0,
          buy_back_sold_bottle: 90,
          buy_back_return_bottle: 80,
          notes: "Monday regular collections",
        },
        {
          date: "2026-11-03",
          total_sales_amount: 51200.0,
          scan_amount: 50100.0,
          upi_amount: 16800.0,
          card_amount: 6100.0,
          online_amount: 22900.0,
          buy_back_sold_bottle: 140,
          buy_back_return_bottle: 120,
          notes: "Tuesday evening peak sales",
        },
        {
          date: "2026-11-04",
          total_sales_amount: 39800.0,
          scan_amount: 38900.0,
          upi_amount: 11000.0,
          card_amount: 3500.0,
          online_amount: 14500.0,
          buy_back_sold_bottle: 85,
          buy_back_return_bottle: 95,
          notes: "Wednesday shift verified",
        },
        {
          date: "2026-11-05",
          total_sales_amount: 54600.0,
          scan_amount: 53200.0,
          upi_amount: 18200.0,
          card_amount: 7400.0,
          online_amount: 25600.0,
          buy_back_sold_bottle: 160,
          buy_back_return_bottle: 130,
          notes: "Thursday shift - stock refilled",
        },
      ];

      for (const r of sampleRemittances) {
        await window.tasmacDB.saveRemittance(r);
      }

      // Sample Vendor Handover Receipts (3 receipts)
      // Cumulative returns = 100 + 80 + 120 + 95 + 130 = 525 bottles available
      const sampleReceipts = [
        {
          receipt_date: "2026-11-02",
          receipt_time: "14:30",
          scanner_number: "SCN-01",
          tin_number: "TIN-3398711066",
          vendor_name: "Murugan Agencies (Madurai)",
          vendor_mobile: "9842156780",
          liquor_items: [
            { size_label: "1000 ML", rate: 4.25, quantity: 25 },
            { size_label: "750/700/650 ML", rate: 3.25, quantity: 40 },
            { size_label: "375/360/355/350/325/320/300 ML", rate: 0.7, quantity: 30 },
            { size_label: "200/180/100 ML", rate: 0.59, quantity: 25 },
          ],
          beer_items: [
            { size_label: "650 ML", rate: 1.45, quantity: 30 },
            { size_label: "500/480/440 ML", rate: 0.72, quantity: 10 },
            { size_label: "325 ML", rate: 0.67, quantity: 0 },
          ],
          notes: "First batch bottle handover",
        },
        {
          receipt_date: "2026-11-04",
          receipt_time: "16:00",
          scanner_number: "SCN-02",
          tin_number: "TIN-3398711066",
          vendor_name: "Sri Ram Bottle Traders",
          vendor_mobile: "9443219876",
          liquor_items: [
            { size_label: "1000 ML", rate: 4.25, quantity: 30 },
            { size_label: "750/700/650 ML", rate: 3.25, quantity: 50 },
            { size_label: "375/360/355/350/325/320/300 ML", rate: 0.7, quantity: 45 },
            { size_label: "200/180/100 ML", rate: 0.59, quantity: 35 },
          ],
          beer_items: [
            { size_label: "650 ML", rate: 1.45, quantity: 40 },
            { size_label: "500/480/440 ML", rate: 0.72, quantity: 15 },
            { size_label: "325 ML", rate: 0.67, quantity: 10 },
          ],
          notes: "Mid-week empty bottle collection",
        },
      ];

      for (const rc of sampleReceipts) {
        await window.tasmacDB.saveVendorReceipt(rc);
      }

      App.showToast("Sample data loaded successfully!", "success");
      await App.refreshAllData();
      Module1Remittance.renderHistory();
      Module2Bottles.refresh();
      Module3Vendor.renderHistory();
      ReportsView.loadReports();
    } catch (err) {
      console.error(err);
      App.showToast("Failed to load sample data: " + err.message, "error");
    }
  },
};

window.SampleDataLoader = SampleDataLoader;

