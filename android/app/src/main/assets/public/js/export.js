/**
 * TASMAC SHOP NO. 11066 – ANNADURAI M
 * Thermal Receipt Printing System – Optimized for RUGTEK BP03R (80mm Paper, 72mm Printable Width)
 * Exact Typography: 20px Bold Shop Header, 18px Bold Title, 16px Bold Body, 20px Bold Total
 * Single continuous roll, zero excess feed, no auto-cut on manual tear-bar
 */

const ExportUtils = {
  // Format Currency in Indian Rupee
  formatINR(val) {
    const num = parseFloat(val) || 0.0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  // Export any array of objects to CSV/Excel
  downloadCSV(filename, headers, rows) {
    let csvContent = '\uFEFF';
    csvContent += headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n';

    rows.forEach((row) => {
      const line = row.map((cell) => {
        const val = cell === null || cell === undefined ? '' : String(cell);
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
      csvContent += line + '\r\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Export to Excel HTML Spreadsheet (.xls)
  downloadExcelTable(filename, title, tableHTML) {
    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
        <x:Name>${filename.slice(0, 31)}</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          body { font-family: Arial, sans-serif; }
          .header { background-color: #0e3820; color: #ffffff; font-size: 16pt; font-weight: bold; text-align: center; }
          .sub { background-color: #145a32; color: #ffffff; font-size: 11pt; text-align: center; }
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #1e8449; color: #ffffff; border: 1px solid #000; padding: 6px; }
          td { border: 1px solid #ccc; padding: 5px; text-align: right; }
          td.text { text-align: left; }
          .total { font-weight: bold; background-color: #e8f5e9; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="12" class="header">TASMAC SHOP NO. 11066</td></tr>
          <tr><td colspan="12" class="sub">${title} | ANNADURAI M | Generated: ${new Date().toLocaleString()}</td></tr>
          <tr><td colspan="12"></td></tr>
        </table>
        ${tableHTML}
      </body>
      </html>
    `;

    const blob = new Blob([template], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  _isPrinting: false,

  /**
   * HTML Print Document for RUGTEK BP03R (80mm roll, 72mm printable width)
   * Exact User Typography: 20px Bold Shop Heading, 18px Bold Title, 16px Bold Body, 20px Bold Total
   * Continuous single-roll, zero excess margin, no page cuts
   */
  buildThermalPrintDocument(htmlTitle, printableBodyHTML) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${htmlTitle}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=72mm, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          @page {
            size: 80mm auto;
            margin: 0 !important;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 auto !important;
            padding: 0 1mm 2mm 1mm !important;
            background: #fff;
            color: #000;
            font-family: 'Courier New', Courier, monospace;
            font-size: 16px !important;
            font-weight: 700 !important;
            line-height: 1.25 !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          .receipt-box {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 1mm 0 2mm 0 !important;
            border: none !important;
            height: auto !important;
            min-height: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .fw-bold { font-weight: 800; }
          
          /* Exact User Typography Requirements for RUGTEK BP03R */
          .heading-shop {
            font-size: 20px !important;
            font-weight: 900 !important;
            text-align: center;
            margin: 0;
            line-height: 1.2;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .heading-title {
            font-size: 18px !important;
            font-weight: 800 !important;
            text-align: center;
            margin: 2px 0 3px 0;
            line-height: 1.2;
            text-transform: uppercase;
          }
          .body-text, table, tr, td, th {
            font-size: 16px !important;
            font-weight: 700 !important;
            color: #000 !important;
          }
          .total-amount-highlight {
            font-size: 20px !important;
            font-weight: 900 !important;
            color: #000 !important;
            line-height: 1.2;
          }
          
          .divider {
            border-top: 1.5px dashed #000;
            margin: 4px 0 !important;
          }
          .double-divider {
            border-top: 2px solid #000;
            margin: 4px 0 !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse;
            margin: 2px 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          th {
            border-bottom: 1.5px solid #000;
            padding: 3px 1px !important;
            text-align: right;
            font-size: 15px !important;
            font-weight: 800 !important;
          }
          th:first-child { text-align: left; }
          td {
            padding: 2px 1px !important;
            text-align: right;
            font-size: 16px !important;
            font-weight: 700 !important;
            vertical-align: top;
          }
          td:first-child { text-align: left; }
          .sign-box {
            margin-top: 8px !important;
            display: flex;
            justify-content: space-between;
            font-size: 14px !important;
            font-weight: 800 !important;
            padding-bottom: 2px;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body class="is-thermal-receipt">
        <div class="receipt-box">
          ${printableBodyHTML}
        </div>
      </body>
      </html>
    `;
  },

  /**
   * HTML Print Document for Standard A4 Portrait Office Reports
   * Reports, Remittance History, Bottle Inventory History
   * Professional TASMAC Green branding, compact tables, no huge blank gaps
   */
  buildA4PrintDocument(htmlTitle, printableBodyHTML) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>${htmlTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 14mm 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #1a201c;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 11.5pt;
            line-height: 1.4;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
          }
          .a4-container {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            padding: 0;
          }
          
          /* TASMAC Official Header Banner */
          .a4-header {
            border-bottom: 3px double #0e3820;
            padding-bottom: 10px;
            margin-bottom: 14px;
            text-align: center;
          }
          .a4-org-title {
            font-size: 17pt;
            font-weight: 900;
            color: #0e3820;
            letter-spacing: 0.5px;
            margin: 0;
            text-transform: uppercase;
          }
          .a4-shop-title {
            font-size: 14pt;
            font-weight: 800;
            color: #145a32;
            margin: 3px 0 0 0;
          }
          .a4-report-name {
            font-size: 13pt;
            font-weight: 800;
            color: #b8860b;
            margin: 4px 0 0 0;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .a4-meta-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f4f7f5;
            border: 1px solid #d4ded7;
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 11pt;
            margin-bottom: 14px;
            color: #2c3e34;
            font-weight: 700;
            flex-wrap: wrap;
            gap: 8px;
          }
          
          /* KPI Summary Cards Grid */
          .a4-kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 10px;
            margin-bottom: 14px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .a4-kpi-card {
            background: #fcfdfc;
            border: 1px solid #dce4df;
            border-left: 4px solid #0e3820;
            border-radius: 4px;
            padding: 8px 12px;
          }
          .a4-kpi-card.gold {
            border-left-color: #b8860b;
          }
          .a4-kpi-card.danger {
            border-left-color: #c0392b;
          }
          .a4-kpi-label {
            font-size: 10pt;
            font-weight: 700;
            color: #597063;
            text-transform: uppercase;
            margin-bottom: 4px;
          }
          .a4-kpi-value {
            font-size: 15pt;
            font-weight: 900;
            color: #0e3820;
            line-height: 1.2;
          }
          .a4-kpi-card.danger .a4-kpi-value {
            color: #c0392b;
          }

          /* Section Headings */
          .a4-section-title {
            font-size: 13pt;
            font-weight: 800;
            color: #0e3820;
            background: #eef4f0;
            border-left: 4px solid #0e3820;
            padding: 6px 10px;
            margin: 12px 0 8px 0;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            page-break-after: avoid;
            break-after: avoid;
          }

          /* Professional Data Tables */
          table.a4-table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 6px 0 12px 0 !important;
            font-size: 11pt !important;
            page-break-inside: auto;
          }
          table.a4-table thead {
            display: table-header-group;
          }
          table.a4-table tfoot {
            display: table-footer-group;
          }
          table.a4-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table.a4-table th {
            background: #0e3820 !important;
            color: #ffffff !important;
            font-size: 11pt !important;
            font-weight: 800 !important;
            padding: 7px 8px !important;
            border: 1px solid #0e3820 !important;
            text-align: left;
            vertical-align: middle;
            white-space: nowrap;
          }
          table.a4-table td {
            padding: 6px 8px !important;
            border: 1px solid #dce4df !important;
            color: #1a201c !important;
            vertical-align: middle;
          }
          table.a4-table tbody tr:nth-child(even) {
            background-color: #fbfdfc;
          }
          table.a4-table tfoot td {
            background: #eaf2ed !important;
            font-weight: 900 !important;
            font-size: 12pt !important;
            color: #0e3820 !important;
            border-top: 2px solid #0e3820 !important;
            border-bottom: 2px solid #0e3820 !important;
          }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .text-left { text-align: left !important; }
          .fw-bold { font-weight: 800 !important; }

          /* Signatures Section */
          .a4-signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 22px;
            padding-top: 6px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .a4-sign-box {
            width: 44%;
            text-align: center;
            border-top: 1.5px solid #0e3820;
            padding-top: 6px;
            font-size: 9pt;
            font-weight: 700;
            color: #0e3820;
          }
          .a4-sign-role {
            font-size: 8pt;
            color: #666;
            font-weight: 500;
            margin-top: 2px;
          }

          /* Footer */
          .a4-footer {
            border-top: 1px solid #d4ded7;
            margin-top: 12px;
            padding-top: 6px;
            font-size: 8pt;
            color: #667;
            display: flex;
            justify-content: space-between;
            page-break-inside: avoid;
          }
          
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="a4-container">
          ${printableBodyHTML}
        </div>
      </body>
      </html>
    `;
  },

  buildPrintDocument(htmlTitle, printableBodyHTML, isThermal = true) {
    return isThermal
      ? this.buildThermalPrintDocument(htmlTitle, printableBodyHTML)
      : this.buildA4PrintDocument(htmlTitle, printableBodyHTML);
  },

  // Reliable Universal Printing: Native Android PrintManager or Hidden IFrame
  printContent(htmlTitle, printableBodyHTML, isThermal = true) {
    if (this._isPrinting) {
      console.warn('Print job already in progress, ignoring duplicate call.');
      return;
    }
    this._isPrinting = true;
    setTimeout(() => {
      this._isPrinting = false;
    }, 1500);

    const fullHTML = this.buildPrintDocument(htmlTitle, printableBodyHTML, isThermal);

    // 1. Android Native PrintManager integration
    if (window.AndroidNative && typeof window.AndroidNative.printReceipt === 'function') {
      try {
        if (typeof window.AndroidNative.printDocument === 'function') {
          window.AndroidNative.printDocument(fullHTML, htmlTitle, isThermal);
          return;
        }
        window.AndroidNative.printReceipt(fullHTML, htmlTitle, isThermal);
        return;
      } catch (e) {
        window.AndroidNative.printReceipt(fullHTML, htmlTitle);
        return;
      }
    }

    // 2. Browser fallback: use hidden <iframe> with adaptive width
    let frame = document.getElementById('tasmac-print-frame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'tasmac-print-frame';
      frame.style.position = 'fixed';
      frame.style.top = '-9999px';
      frame.style.left = '-9999px';
      frame.style.border = '0';
      document.body.appendChild(frame);
    }

    // Set frame width according to document type
    frame.style.width = isThermal ? '72mm' : '210mm';
    frame.style.height = isThermal ? '100px' : '297mm';

    try {
      const doc = frame.contentWindow.document;
      doc.open();
      doc.write(fullHTML);
      doc.close();

      setTimeout(() => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
        } catch (e) {
          console.error('Frame print fallback', e);
          window.print();
        }
      }, 350);
    } catch (err) {
      console.warn('IFrame error, fallback window', err);
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(fullHTML);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 350);
      } else {
        window.print();
      }
    }
  },

  // Direct Bluetooth Printing optimized for RUGTEK BP03R (72mm / 48 columns)
  printBluetoothReceipt(receipt) {
    const plainText = this.buildEscPosPlainText(receipt);

    // Call Android Native Bluetooth printing if running inside Android App
    if (window.AndroidNative && typeof window.AndroidNative.printBluetooth === 'function') {
      window.AndroidNative.printBluetooth(plainText);
      return;
    }

    // Fallback: System print
    const html = this.buildVendorReceiptHTML(receipt);
    this.printContent(receipt.receipt_number, html, true);
  },

  /**
   * ESC/POS Plain Text for RUGTEK BP03R (80mm Paper, 72mm Printable Width, 48 Columns)
   * Exact 48-character alignment, bold headers, zero trailing blank space, manual tear-bar
   */
  buildEscPosPlainText(receipt) {
    const padR = (str, len) => (String(str || '') + ' '.repeat(len)).slice(0, len);
    const padL = (str, len) => (' '.repeat(len) + String(str || '')).slice(-len);
    const line = '-'.repeat(48) + '\n';
    const doubleLine = '='.repeat(48) + '\n';

    let out = '';

    // Heading: TASMAC SHOP NO. 11066 (20px bold equivalent)
    out += '            TASMAC SHOP NO. 11066\n';
    out += '           VENDOR HANDOVER RECEIPT\n';
    out += line;

    // Receipt Meta: Body text (16px bold equivalent)
    out += `Receipt No : ${receipt.receipt_number}\n`;
    out += `Date & Time: ${receipt.receipt_date} ${receipt.receipt_time || ''}\n`;
    if (receipt.vendor_name) {
      out += `Vendor Name: ${receipt.vendor_name}\n`;
    }
    if (receipt.vendor_mobile) {
      out += `Mobile No  : ${receipt.vendor_mobile}\n`;
    }
    if (receipt.scanner_number || receipt.tin_number) {
      out += `Scanner/TIN: ${receipt.scanner_number || '-'} / ${receipt.tin_number || '-'}\n`;
    }
    out += line;

    // Filter items with quantity > 0
    const activeLiquor = (receipt.liquor_items || []).filter((i) => (parseInt(i.quantity) || 0) > 0);
    const activeBeer = (receipt.beer_items || []).filter((i) => (parseInt(i.quantity) || 0) > 0);

    // 48 Column Layout:
    // SIZE (20) | RATE (8) | QTY (7) | AMOUNT (13) = 48
    const colHeader = `${padR('BOTTLE SIZE', 20)}${padL('RATE', 8)}${padL('QTY', 7)}${padL('AMOUNT', 13)}\n`;

    // 1. LIQUOR SECTION
    if (activeLiquor.length > 0) {
      out += 'LIQUOR DETAILS:\n';
      out += colHeader;
      out += line;
      activeLiquor.forEach((item) => {
        const sz = padR(item.size_label.split('/')[0] + (item.size_label.includes('/') ? '..' : ''), 20);
        const rt = padL('Rs.' + parseFloat(item.rate).toFixed(2), 8);
        const qt = padL(item.quantity, 7);
        const am = padL('Rs.' + parseFloat(item.amount).toFixed(2), 13);
        out += `${sz}${rt}${qt}${am}\n`;
      });
      out += line;
    }

    // 2. BEER SECTION
    if (activeBeer.length > 0) {
      out += 'BEER DETAILS:\n';
      out += colHeader;
      out += line;
      activeBeer.forEach((item) => {
        const sz = padR(item.size_label, 20);
        const rt = padL('Rs.' + parseFloat(item.rate).toFixed(2), 8);
        const qt = padL(item.quantity, 7);
        const am = padL('Rs.' + parseFloat(item.amount).toFixed(2), 13);
        out += `${sz}${rt}${qt}${am}\n`;
      });
      out += line;
    }

    // GRAND TOTALS (20px bold equivalent)
    out += doubleLine;
    const totBotStr = `${receipt.total_bottles} Bottles`;
    const totPayStr = `Rs. ${parseFloat(receipt.total_payable).toFixed(2)}`;
    out += `TOTAL BOTTLES : ${padL(totBotStr, 32)}\n`;
    out += `TOTAL PAYABLE : ${padL(totPayStr, 32)}\n`;
    out += doubleLine;

    // SIGNATURES (Compact, clean)
    out += `${padR('Vendor Sign: ___________', 24)}${padL('In-Charge: ANNADURAI M', 24)}`;
    // Strictly NO trailing newlines to avoid paper waste!
    return out;
  },

  /**
   * Paper-Optimized HTML layout for RUGTEK BP03R (72mm printable width)
   * Exact font sizes: 20px shop heading, 18px title, 16px body, 20px total
   */
  buildVendorReceiptHTML(receipt) {
    const activeLiquor = (receipt.liquor_items || []).filter((i) => (parseInt(i.quantity) || 0) > 0);
    const activeBeer = (receipt.beer_items || []).filter((i) => (parseInt(i.quantity) || 0) > 0);

    const liquorRows = activeLiquor
      .map(
        (i) => `
        <tr>
          <td>${i.size_label}</td>
          <td>₹${parseFloat(i.rate).toFixed(2)}</td>
          <td>${i.quantity}</td>
          <td>₹${parseFloat(i.amount).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const beerRows = activeBeer
      .map(
        (i) => `
        <tr>
          <td>${i.size_label}</td>
          <td>₹${parseFloat(i.rate).toFixed(2)}</td>
          <td>${i.quantity}</td>
          <td>₹${parseFloat(i.amount).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    return `
      <div class="heading-shop">TASMAC SHOP NO. 11066</div>
      <div class="heading-title">VENDOR HANDOVER RECEIPT</div>
      <div class="divider"></div>
      
      <div class="body-text" style="line-height: 1.35;">
        <div><b>Receipt:</b> ${receipt.receipt_number}</div>
        <div><b>Date   :</b> ${receipt.receipt_date} ${receipt.receipt_time || ''}</div>
        ${receipt.vendor_name ? `<div><b>Vendor :</b> ${receipt.vendor_name}</div>` : ''}
        ${receipt.vendor_mobile ? `<div><b>Mobile :</b> ${receipt.vendor_mobile}</div>` : ''}
        ${receipt.scanner_number || receipt.tin_number
        ? `<div><b>Scan/TIN:</b> ${receipt.scanner_number || '-'} / ${receipt.tin_number || '-'}</div>`
        : ''
      }
      </div>
      <div class="divider"></div>

      ${activeLiquor.length > 0
        ? `
        <div class="body-text" style="text-decoration: underline; margin-top: 3px; font-weight: 900;">LIQUOR DETAILS</div>
        <table>
          <thead>
            <tr>
              <th style="width: 44%;">Size</th>
              <th style="width: 18%;">Rate</th>
              <th style="width: 14%;">Qty</th>
              <th style="width: 24%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${liquorRows}
          </tbody>
        </table>`
        : ''
      }

      ${activeBeer.length > 0
        ? `
        <div class="body-text" style="text-decoration: underline; margin-top: 4px; font-weight: 900;">BEER DETAILS</div>
        <table>
          <thead>
            <tr>
              <th style="width: 44%;">Size</th>
              <th style="width: 18%;">Rate</th>
              <th style="width: 14%;">Qty</th>
              <th style="width: 24%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${beerRows}
          </tbody>
        </table>`
        : ''
      }

      <div class="double-divider"></div>
      <table style="margin: 3px 0;">
        <tr>
          <td class="total-amount-highlight" style="text-align: left;">TOTAL BOTTLES:</td>
          <td class="total-amount-highlight">${receipt.total_bottles} Bottles</td>
        </tr>
        <tr>
          <td class="total-amount-highlight" style="text-align: left;">TOTAL PAYABLE:</td>
          <td class="total-amount-highlight">₹${parseFloat(receipt.total_payable).toFixed(2)}</td>
        </tr>
      </table>
      <div class="divider"></div>

      <div class="sign-box">
        <div>Vendor: _________</div>
        <div style="text-align: right;">In-Charge: ANNADURAI M</div>
      </div>
    `;
  },

  /**
   * Professional A4 Portrait Voucher layout for Vendor Receipt
   * For official physical records, PDF export, or office desktop printing
   */
  buildVendorReceiptA4HTML(receipt) {
    const activeLiquor = (receipt.liquor_items || []).filter((i) => (parseInt(i.quantity) || 0) > 0);
    const activeBeer = (receipt.beer_items || []).filter((i) => (parseInt(i.quantity) || 0) > 0);

    let itemIndex = 1;
    const liquorRows = activeLiquor
      .map(
        (i) => `
        <tr>
          <td class="text-center">${itemIndex++}</td>
          <td><b>Liquor</b></td>
          <td>${i.size_label}</td>
          <td class="text-right">₹${parseFloat(i.rate).toFixed(2)}</td>
          <td class="text-right fw-bold">${i.quantity}</td>
          <td class="text-right fw-bold">₹${parseFloat(i.amount).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const beerRows = activeBeer
      .map(
        (i) => `
        <tr>
          <td class="text-center">${itemIndex++}</td>
          <td><b>Beer</b></td>
          <td>${i.size_label}</td>
          <td class="text-right">₹${parseFloat(i.rate).toFixed(2)}</td>
          <td class="text-right fw-bold">${i.quantity}</td>
          <td class="text-right fw-bold">₹${parseFloat(i.amount).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    return `
      <div class="a4-header">
        <div class="a4-org-title">TAMIL NADU STATE MARKETING CORPORATION LIMITED (TASMAC)</div>
        <div class="a4-shop-title">SHOP NO. 11066 – IN-CHARGE: ANNADURAI M</div>
        <div class="a4-report-name">VENDOR EMPTY BOTTLE HANDOVER VOUCHER / RECEIPT</div>
      </div>

      <div class="a4-meta-bar">
        <div><b>Receipt No:</b> ${receipt.receipt_number}</div>
        <div><b>Date & Time:</b> ${receipt.receipt_date} ${receipt.receipt_time || ''}</div>
        ${receipt.vendor_name ? `<div><b>Vendor Name:</b> ${receipt.vendor_name}</div>` : ''}
        ${receipt.vendor_mobile ? `<div><b>Mobile:</b> ${receipt.vendor_mobile}</div>` : ''}
        ${receipt.scanner_number || receipt.tin_number ? `<div><b>Scanner / TIN:</b> ${receipt.scanner_number || '-'} / ${receipt.tin_number || '-'}</div>` : ''}
      </div>

      <div class="a4-kpi-grid">
        <div class="a4-kpi-card">
          <div class="a4-kpi-label">Total Handover Bottles</div>
          <div class="a4-kpi-value">${receipt.total_bottles} Bottles</div>
        </div>
        <div class="a4-kpi-card gold">
          <div class="a4-kpi-label">Total Amount Payable</div>
          <div class="a4-kpi-value">${this.formatINR(receipt.total_payable)}</div>
        </div>
      </div>

      <div class="a4-section-title">ITEMIZED BOTTLE HANDOVER BREAKDOWN</div>
      <table class="a4-table">
        <thead>
          <tr>
            <th style="width: 6%;" class="text-center">#</th>
            <th style="width: 14%;">Category</th>
            <th style="width: 40%;">Bottle Size / Specification</th>
            <th style="width: 12%;" class="text-right">Unit Rate</th>
            <th style="width: 12%;" class="text-right">Quantity</th>
            <th style="width: 16%;" class="text-right">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          ${liquorRows}
          ${beerRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" class="text-right">GRAND TOTALS:</td>
            <td class="text-right">${receipt.total_bottles} Bottles</td>
            <td class="text-right">${this.formatINR(receipt.total_payable)}</td>
          </tr>
        </tfoot>
      </table>

      <div class="a4-signatures">
        <div class="a4-sign-box">
          <div>VENDOR SIGNATURE / ACKNOWLEDGEMENT</div>
          <div class="a4-sign-role">${receipt.vendor_name || 'Authorized Representative'}</div>
        </div>
        <div class="a4-sign-box">
          <div>SHOP IN-CHARGE SIGNATURE</div>
          <div class="a4-sign-role">ANNADURAI M (Shop 11066)</div>
        </div>
      </div>

      <div class="a4-footer">
        <div>Generated on ${new Date().toLocaleString()} | Official Physical Records Copy</div>
        <div>TASMAC Shop Management System (100% Offline)</div>
      </div>
    `;
  },

  /**
   * ESC/POS Reports & Analytics (80mm Paper, 72mm Content, 48 Columns)
   */
  buildReportsEscPos(d) {
    const padR = (s, l) => (String(s || '') + ' '.repeat(l)).slice(0, l);
    const padL = (s, l) => (' '.repeat(l) + String(s || '')).slice(-l);
    const line = '-'.repeat(48) + '\n';
    const doubleLine = '='.repeat(48) + '\n';

    let out = '';
    out += '            TASMAC SHOP NO. 11066\n';
    out += '      EXECUTIVE AUDIT & PERFORMANCE REPORT\n';
    out += doubleLine;
    out += `Period   : ${d.startDate} to ${d.endDate}\n`;
    out += `Shop No  : 11066 | In-Charge: ANNADURAI M\n`;
    out += `Printed  : ${new Date().toLocaleString()}\n`;
    out += line;
    out += '1. FINANCIAL & REMITTANCE SUMMARY:\n';
    out += `${padR('Total Sales Amount', 26)}:${padL(d.sales, 21)}\n`;
    out += `${padR('Total All Payments', 26)}:${padL(d.payments, 21)}\n`;
    out += `${padR('Cash Sales Amount', 26)}:${padL(d.cash, 21)}\n`;
    out += `${padR('UPI Collections', 26)}:${padL(d.upi, 21)}\n`;
    out += `${padR('Card Collections', 26)}:${padL(d.card, 21)}\n`;
    out += `${padR('Scan Collections', 26)}:${padL(d.scan, 21)}\n`;
    if (d.online && d.online !== '₹0.00' && d.online !== '0.00') {
      out += `${padR('Online Collections', 26)}:${padL(d.online, 21)}\n`;
    }
    out += `${padR('Buy Back Flow', 20)}:${padL(d.bottleFlow, 27)}\n`;
    out += line;
    out += '2. BOTTLE INVENTORY SUMMARY (COMMON POOL):\n';
    out += `${padR('Total Available Bottles', 28)}:${padL(d.avail, 19)}\n`;
    out += `${padR('Total Vendor Collected', 28)}:${padL(d.coll, 19)}\n`;
    out += `${padR('Remaining Balance', 28)}:${padL(d.rem, 19)}\n`;
    out += line;

    // Vendor Breakdown
    out += '3. VENDOR HANDOVER BREAKDOWN:\n';
    out += `${padR('VENDOR NAME', 22)}${padL('RCPTS', 6)}${padL('BOTTLES', 8)}${padL('PAYABLE', 12)}\n`;
    out += line;
    if (d.vendors && d.vendors.length > 0) {
      d.vendors.forEach((v) => {
        const vName = padR(v.name.slice(0, 21), 22);
        const vRc = padL(v.receipts, 6);
        const vBt = padL(v.bottles, 8);
        const vPy = padL(v.payableStr || ExportUtils.formatINR(v.payable), 12);
        out += `${vName}${vRc}${vBt}${vPy}\n`;
      });
      out += line;
    } else {
      out += '   No vendor handover receipts in this period.\n';
      out += line;
    }

    out += doubleLine;
    out += `${padR('Shop In-Charge: ANNADURAI M', 24)}${padL('Audit Officer: ________', 24)}\n`;
    return out;
  },

  /**
   * ESC/POS Daily Remittance History (80mm Paper, 72mm Content, 48 Columns)
   * TASMAC Shop No. 11066 Official Register Thermal Output
   */
  buildRemittanceEscPos(records) {
    const padR = (s, l) => (String(s || '') + ' '.repeat(l)).slice(0, l);
    const padL = (s, l) => (' '.repeat(l) + String(s || '')).slice(-l);
    const line = '-'.repeat(48) + '\n';
    const doubleLine = '='.repeat(48) + '\n';

    let totSales = 0, totScan = 0, totUpi = 0, totCard = 0, totOnline = 0;
    let totSold = 0, totRet = 0, totPrevRem = 0, totCashRem = 0, totActCash = 0, totTotalRem = 0;

    records.forEach((r) => {
      totSales += parseFloat(r.total_sales_amount) || 0;
      totScan += parseFloat(r.scan_amount) || 0;
      totUpi += parseFloat(r.upi_amount) || 0;
      totCard += parseFloat(r.card_amount) || 0;
      totOnline += parseFloat(r.online_amount) || 0;
      totSold += parseInt(r.buy_back_sold_bottle) || 0;
      totRet += parseInt(r.buy_back_return_bottle) || 0;
      totPrevRem += parseFloat(r.previous_buyback_remittance !== undefined ? r.previous_buyback_remittance : 0) || 0;
      totCashRem += parseFloat(r.cash_remittance !== undefined ? r.cash_remittance : r.cash_sales) || 0;
      totActCash += parseFloat(r.actual_cash_submitted !== undefined && r.actual_cash_submitted !== null ? r.actual_cash_submitted : r.total_sales_amount) || 0;
      totTotalRem += parseFloat(r.total_remittance_amount !== undefined ? r.total_remittance_amount : r.total_all_payments) || 0;
    });

    let out = '';
    out += '            TASMAC SHOP NO. 11066\n';
    out += '        DAILY REMITTANCE AUDIT REGISTER\n';
    out += doubleLine;
    out += `Records  : ${records.length} Day(s) Logged\n`;
    out += `Shop No  : 11066 | In-Charge: ANNADURAI M\n`;
    out += `Printed  : ${new Date().toLocaleString()}\n`;
    out += line;
    out += 'CUMULATIVE FINANCIAL TOTALS:\n';
    out += `${padR('Total Scan Collection', 26)}:${padL(ExportUtils.formatINR(totScan), 21)}\n`;
    out += `${padR('Total Sales Amount', 26)}:${padL(ExportUtils.formatINR(totSales), 21)}\n`;
    out += `${padR('Actual Cash Submitted', 26)}:${padL(ExportUtils.formatINR(totActCash), 21)}\n`;
    out += `${padR('Required Cash Remittance', 26)}:${padL(ExportUtils.formatINR(totCashRem), 21)}\n`;
    out += `${padR('Previous BB Remittance', 26)}:${padL(ExportUtils.formatINR(totPrevRem), 21)}\n`;
    out += `${padR('UPI Collections', 26)}:${padL(ExportUtils.formatINR(totUpi), 21)}\n`;
    out += `${padR('Card Collections', 26)}:${padL(ExportUtils.formatINR(totCard), 21)}\n`;
    out += `${padR('Online Collections', 26)}:${padL(ExportUtils.formatINR(totOnline), 21)}\n`;
    out += `${padR('Buy Back Net Flow', 20)}:${padL(`+${totRet} Ret / -${totSold} Sold`, 27)}\n`;
    out += `${padR('Total Remittance Amount', 26)}:${padL(ExportUtils.formatINR(totTotalRem), 21)}\n`;
    out += line;

    out += 'DAILY TRANSACTIONS LOG:\n';
    out += `${padR('DATE/SERIAL', 16)}${padL('SALES', 10)}${padL('CASH REM', 11)}${padL('TOT REM', 11)}\n`;
    out += line;

    records.forEach((r) => {
      const d = padR(r.date, 16);
      const s = padL(parseFloat(r.total_sales_amount).toFixed(2), 10);
      const c = padL(parseFloat(r.cash_remittance !== undefined ? r.cash_remittance : r.cash_sales).toFixed(2), 11);
      const p = padL(parseFloat(r.total_remittance_amount !== undefined ? r.total_remittance_amount : r.total_all_payments).toFixed(2), 11);
      out += `${d}${s}${c}${p}\n`;
      const prev = parseFloat(r.previous_buyback_remittance || 0).toFixed(0);
      out += `  #${r.serial_number || 'REM'} | PrevBB:${prev} | UPI:${parseFloat(r.upi_amount || 0).toFixed(0)} Card:${parseFloat(r.card_amount || 0).toFixed(0)}\n`;
      if (r.cash_difference && Math.abs(r.cash_difference) > 0.01) {
        out += `  * Cash Diff: ${r.cash_difference > 0 ? '+' : ''}${parseFloat(r.cash_difference).toFixed(2)}\n`;
      }
    });

    out += doubleLine;
    out += `${padR('GRAND TOTAL SALES', 26)}:${padL(ExportUtils.formatINR(totSales), 21)}\n`;
    out += `${padR('GRAND TOTAL CASH REM', 26)}:${padL(ExportUtils.formatINR(totCashRem), 21)}\n`;
    out += `${padR('GRAND TOTAL REMITTANCE', 26)}:${padL(ExportUtils.formatINR(totTotalRem), 21)}\n`;
    out += doubleLine;
    out += `${padR('In-Charge: ANNADURAI M', 24)}${padL('Accounts: ____________', 24)}\n`;
    return out;
  },

  /**
   * ESC/POS Bottle Inventory History (80mm Paper, 72mm Content, 48 Columns)
   */
  buildBottleInventoryEscPos(summary, history) {
    const padR = (s, l) => (String(s || '') + ' '.repeat(l)).slice(0, l);
    const padL = (s, l) => (' '.repeat(l) + String(s || '')).slice(-l);
    const line = '-'.repeat(48) + '\n';
    const doubleLine = '='.repeat(48) + '\n';

    let totReturn = 0, totCollected = 0;
    history.forEach((h) => {
      totReturn += parseInt(h.buy_back_return_bottles) || 0;
      totCollected += parseInt(h.vendor_collected_bottles) || 0;
    });

    let out = '';
    out += '            TASMAC SHOP NO. 11066\n';
    out += '       UNIFIED BOTTLE INVENTORY AUDIT\n';
    out += doubleLine;
    out += `Shop No  : 11066 | In-Charge: ANNADURAI M\n`;
    out += `Pool Type: One Common Pool\n`;
    out += `Printed  : ${new Date().toLocaleString()}\n`;
    out += line;
    out += 'CURRENT INVENTORY KPI STATUS:\n';
    out += `${padR('Buy Back Return Bottles (+)', 32)}:${padL(summary.total_available_bottles + ' Btls', 15)}\n`;
    out += `${padR('Vendor Collected Bottles (-)', 32)}:${padL(summary.total_vendor_collected_bottles + ' Btls', 15)}\n`;
    out += `${padR('Remaining Stock Available (=)', 32)}:${padL(summary.remaining_bottles + ' Btls', 15)}\n`;
    out += line;

    out += 'CHRONOLOGICAL BOTTLE LEDGER:\n';
    out += `${padR('DATE', 12)}${padL('RET(+)', 10)}${padL('COLL(-)', 12)}${padL('BALANCE', 14)}\n`;
    out += line;

    history.forEach((h) => {
      const d = padR(h.date, 12);
      const r = padL('+' + h.buy_back_return_bottles, 10);
      const c = padL('-' + h.vendor_collected_bottles, 12);
      const b = padL(h.remaining_bottles + ' Btls', 14);
      out += `${d}${r}${c}${b}\n`;
    });

    out += doubleLine;
    out += `${padR('Total Return Received (+)', 30)}:${padL('+' + totReturn + ' Btls', 17)}\n`;
    out += `${padR('Total Vendor Collected (-)', 30)}:${padL('-' + totCollected + ' Btls', 17)}\n`;
    out += `${padR('Final Remaining Balance', 30)}:${padL(summary.remaining_bottles + ' Btls', 17)}\n`;
    out += doubleLine;
    out += `${padR('In-Charge: ANNADURAI M', 24)}${padL('Stock Audit: _________', 24)}\n`;
    return out;
  },

  /**
   * ESC/POS Vendor Receipts History (80mm Paper, 72mm Content, 48 Columns)
   */
  buildVendorHistoryEscPos(records) {
    const padR = (s, l) => (String(s || '') + ' '.repeat(l)).slice(0, l);
    const padL = (s, l) => (' '.repeat(l) + String(s || '')).slice(-l);
    const line = '-'.repeat(48) + '\n';
    const doubleLine = '='.repeat(48) + '\n';

    let totBottles = 0, totPayable = 0;
    records.forEach((r) => {
      totBottles += parseInt(r.total_bottles) || 0;
      totPayable += parseFloat(r.total_payable) || 0;
    });

    let out = '';
    out += '            TASMAC SHOP NO. 11066\n';
    out += '      VENDOR BOTTLE RECEIPTS REGISTER\n';
    out += doubleLine;
    out += `Receipts : ${records.length} Issued\n`;
    out += `Shop No  : 11066 | In-Charge: ANNADURAI M\n`;
    out += `Printed  : ${new Date().toLocaleString()}\n`;
    out += line;
    out += 'RECEIPTS SUMMARY:\n';
    out += `${padR('Total Receipts Count', 28)}:${padL(records.length, 19)}\n`;
    out += `${padR('Total Bottles Handover', 28)}:${padL(totBottles + ' Btls', 19)}\n`;
    out += `${padR('Cumulative Total Payable', 28)}:${padL(ExportUtils.formatINR(totPayable), 19)}\n`;
    out += line;

    out += 'CHRONOLOGICAL RECEIPTS LOG:\n';
    out += `${padR('DATE', 11)}${padR('RCPT NO', 11)}${padL('BTLS', 8)}${padL('PAYABLE', 18)}\n`;
    out += line;

    records.forEach((r) => {
      const d = padR(r.receipt_date, 11);
      const no = padR(r.receipt_number.slice(-10), 11);
      const b = padL(r.total_bottles, 8);
      const p = padL(ExportUtils.formatINR(r.total_payable), 18);
      out += `${d}${no}${b}${p}\n`;
      out += `  Vendor: ${r.vendor_name.slice(0, 38)}\n`;
    });

    out += doubleLine;
    out += `${padR('GRAND TOTAL BOTTLES', 26)}:${padL(totBottles + ' Btls', 21)}\n`;
    out += `${padR('GRAND TOTAL PAYABLE', 26)}:${padL(ExportUtils.formatINR(totPayable), 21)}\n`;
    out += doubleLine;
    out += `${padR('In-Charge: ANNADURAI M', 24)}${padL('Vendor Audit: ________', 24)}\n`;
    return out;
  },

  /**
   * ESC/POS Hardware Test Slip
   */
  buildTestSlipEscPos(printerName = 'RUGTEK BP03R') {
    const padL = (s, l) => (' '.repeat(l) + String(s || '')).slice(-l);
    const line = '-'.repeat(48) + '\n';
    const doubleLine = '='.repeat(48) + '\n';

    let out = '';
    out += '            TASMAC SHOP NO. 11066\n';
    out += '       ANNADURAI M - THERMAL TEST SLIP\n';
    out += doubleLine;
    out += `Printer : ${printerName} (80mm Paper)\n`;
    out += `Width   : 72mm Printable / 48 Columns\n`;
    out += `Protocol: ESC/POS Bluetooth SPP\n`;
    out += `Time    : ${new Date().toLocaleString()}\n`;
    out += line;
    out += 'HARDWARE BLUETOOTH STATUS: TEST OK!\n';
    out += 'Columns Test (48 chars):\n';
    out += '123456789012345678901234567890123456789012345678\n';
    out += line;
    out += '  [✓] Large Bold Headers Supported\n';
    out += '  [✓] Standard 48-Column Monospace OK\n';
    out += '  [✓] 3-Line Minimal Feed to Tear Bar OK\n';
    out += '  [✓] Zero Unnecessary Blank Paper OK\n';
    out += doubleLine;
    out += '           READY TO PRINT TASMAC BILLS\n';
    return out;
  },
};

/**
 * Universal Bluetooth Print Manager
 * Manages paired Bluetooth devices, connects to RUGTEK BP03R, persists selection, and prints ESC/POS
 */
const BluetoothPrintManager = {
  _pendingText: null,
  _selectedMac: null,
  _selectedName: null,

  getStoredPrinter() {
    try {
      if (window.AndroidNative && typeof window.AndroidNative.getPreferredPrinter === 'function') {
        const json = window.AndroidNative.getPreferredPrinter();
        if (json && json.startsWith('{')) {
          const p = JSON.parse(json);
          if (p.address) return p;
        }
      }
    } catch (e) { }
    try {
      const stored = localStorage.getItem('tasmac_preferred_printer');
      if (stored) return JSON.parse(stored);
    } catch (e) { }
    return null;
  },

  setStoredPrinter(mac, name) {
    this._selectedMac = mac;
    this._selectedName = name;
    try {
      localStorage.setItem('tasmac_preferred_printer', JSON.stringify({ address: mac, name: name }));
    } catch (e) { }
    if (window.AndroidNative && typeof window.AndroidNative.savePreferredPrinter === 'function') {
      window.AndroidNative.savePreferredPrinter(mac, name);
    }
  },

  clearStoredPrinter() {
    this._selectedMac = null;
    this._selectedName = null;
    try {
      localStorage.removeItem('tasmac_preferred_printer');
    } catch (e) { }
    if (window.AndroidNative && typeof window.AndroidNative.clearPreferredPrinter === 'function') {
      window.AndroidNative.clearPreferredPrinter();
    }
  },

  showModal(textToPrint = null) {
    this._pendingText = textToPrint;
    const modal = document.getElementById('bt-printer-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.classList.add('active');

    this.updateStatusDisplay();
    this.refreshDeviceList();
  },

  closeModal() {
    const modal = document.getElementById('bt-printer-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
    this._pendingText = null;
  },

  updateStatusDisplay() {
    const stored = this.getStoredPrinter();
    const pill = document.getElementById('bt-printer-status-pill');
    const text = document.getElementById('bt-printer-status-text');
    const macText = document.getElementById('bt-printer-mac-text');

    if (stored && stored.name) {
      if (pill) pill.textContent = stored.name;
      if (text) text.textContent = 'Configured & Ready (80mm / 72mm)';
      if (macText) macText.textContent = `Address: ${stored.address || 'SPP Device'}`;
      this._selectedMac = stored.address;
      this._selectedName = stored.name;
    } else {
      if (pill) pill.textContent = 'No Printer Selected';
      if (text) text.textContent = 'Please choose your RUGTEK BP03R from the list below';
      if (macText) macText.textContent = 'Tap a device to connect';
    }
  },

  refreshDeviceList() {
    const container = document.getElementById('bt-device-list-container');
    if (!container) return;

    container.innerHTML = '<div class="text-center" style="padding: 18px; color: #666; font-size: 13px;">🔍 Scanning paired Bluetooth devices...</div>';

    let devices = [];
    if (window.AndroidNative && typeof window.AndroidNative.getPairedDevices === 'function') {
      try {
        const json = window.AndroidNative.getPairedDevices();
        devices = JSON.parse(json || '[]');
      } catch (e) {
        console.error('Error fetching paired devices', e);
      }
    }

    if (!window.AndroidNative || devices.length === 0) {
      if (window.AndroidNative) {
        container.innerHTML = `
          <div style="padding: 16px; text-align: center; color: #c0392b; font-size: 13px;">
            ⚠️ No paired Bluetooth devices found.<br>
            Please turn on Bluetooth and pair <b>RUGTEK BP03R</b> in your phone Settings.
          </div>`;
        return;
      }
      devices = [
        { name: 'RUGTEK BP03R', address: '00:11:22:33:44:55' },
        { name: 'Bluetooth POS Printer', address: 'AA:BB:CC:DD:EE:FF' }
      ];
    }

    const stored = this.getStoredPrinter();
    const currentMac = this._selectedMac || (stored ? stored.address : '');

    let html = '';
    devices.forEach((d, idx) => {
      const isRUGTEK = (d.name || '').toLowerCase().includes('rugtek') || (d.name || '').toLowerCase().includes('bp03');
      const isSelected = (currentMac && currentMac === d.address) || (!currentMac && isRUGTEK) || (!currentMac && idx === 0);
      if (isSelected && !this._selectedMac) {
        this._selectedMac = d.address;
        this._selectedName = d.name;
      }

      html += `
        <div onclick="BluetoothPrintManager.selectDevice('${d.address}', '${d.name.replace(/'/g, "\\'")}')" 
             id="bt-dev-${d.address.replace(/:/g, '')}"
             style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 6px; margin-bottom: 6px; cursor: pointer; border: 1.5px solid ${isSelected ? '#0e3820' : '#e0e5e2'}; background: ${isSelected ? '#eef6f1' : '#fff'};">
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="radio" name="bt_device_choice" value="${d.address}" ${isSelected ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: #0e3820;">
            <div>
              <div style="font-weight: 800; font-size: 13.5px; color: #0e3820;">${d.name} ${isRUGTEK ? '<span style="background: #145a32; color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">Recommended</span>' : ''}</div>
              <div style="font-size: 11px; color: #777;">MAC: ${d.address}</div>
            </div>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: ${isSelected ? '#0e3820' : '#888'};">${isSelected ? '✓ Selected' : 'Select'}</span>
        </div>`;
    });

    container.innerHTML = html;
  },

  selectDevice(mac, name) {
    this._selectedMac = mac;
    this._selectedName = name;

    const container = document.getElementById('bt-device-list-container');
    if (container) {
      container.querySelectorAll('div[id^="bt-dev-"]').forEach((el) => {
        el.style.borderColor = '#e0e5e2';
        el.style.background = '#fff';
      });
      const chosen = document.getElementById('bt-dev-' + mac.replace(/:/g, ''));
      if (chosen) {
        chosen.style.borderColor = '#0e3820';
        chosen.style.background = '#eef6f1';
        const radio = chosen.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      }
    }
  },

  confirmAndPrint() {
    if (!this._selectedMac) {
      if (window.App) window.App.showToast('Please select a Bluetooth printer first.', 'error');
      return;
    }

    this.setStoredPrinter(this._selectedMac, this._selectedName || 'RUGTEK BP03R');
    this.updateStatusDisplay();

    const textToPrint = this._pendingText;
    this.closeModal();

    if (textToPrint) {
      this.sendDirectToPrinter(textToPrint, this._selectedMac, this._selectedName);
    } else {
      if (window.App) window.App.showToast('Default printer saved: ' + (this._selectedName || 'RUGTEK BP03R'), 'success');
    }
  },

  disconnectPrinter() {
    this.clearStoredPrinter();
    this.updateStatusDisplay();
    this.refreshDeviceList();
    if (window.App) window.App.showToast('Printer disconnected / memory cleared.', 'info');
  },

  testPrint() {
    if (!this._selectedMac) {
      const stored = this.getStoredPrinter();
      if (stored) {
        this._selectedMac = stored.address;
        this._selectedName = stored.name;
      }
    }
    const testSlip = ExportUtils.buildTestSlipEscPos(this._selectedName || 'RUGTEK BP03R');
    this.sendDirectToPrinter(testSlip, this._selectedMac, this._selectedName);
  },

  printOrPrompt(reportTextESC) {
    const stored = this.getStoredPrinter();
    if (stored && stored.address) {
      this.sendDirectToPrinter(reportTextESC, stored.address, stored.name);
    } else {
      this.showModal(reportTextESC);
    }
  },

  sendDirectToPrinter(plainText, mac = null, name = null) {
    if (window.AndroidNative && typeof window.AndroidNative.printBluetoothToDevice === 'function') {
      window.AndroidNative.printBluetoothToDevice(mac || '', plainText);
      return;
    }
    if (window.AndroidNative && typeof window.AndroidNative.printBluetooth === 'function') {
      window.AndroidNative.printBluetooth(plainText);
      return;
    }

    // Browser fallback
    console.log('--- ESC/POS OUTPUT (80mm / 48 columns) ---\n' + plainText);
    if (window.App) window.App.showToast('Bluetooth Printing active in Android App. Check console for output.', 'info');
    ExportUtils.printContent('TASMAC_Thermal_Preview', `<pre style="font-size: 15px; font-weight: bold; line-height: 1.25; margin: 0; white-space: pre-wrap;">${plainText}</pre>`, true);
  }
};

window.ExportUtils = ExportUtils;
window.BluetoothPrintManager = BluetoothPrintManager;
