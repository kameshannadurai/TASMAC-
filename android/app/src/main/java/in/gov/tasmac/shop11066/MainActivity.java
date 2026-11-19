package in.gov.tasmac.shop11066;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.util.Log;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "TASMAC_11066";
    // Standard Bluetooth Serial Port Profile (SPP) UUID for thermal POS printers
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Customize system bars to match TASMAC Dark Green (#0E3820)
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(0xFF0E3820);
        window.setNavigationBarColor(0xFF0E3820);

        // Request Bluetooth permissions on Android 12+ if needed
        checkBluetoothPermissions();

        // Create programmatic full-screen WebView
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Bridge to show native Android Toast messages & perform hardware Bluetooth printing
        webView.addJavascriptInterface(new WebAppInterface(this), "AndroidNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                // Keep all navigation within the app
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.d(TAG, cm.message() + " -- From line "
                        + cm.lineNumber() + " of " + cm.sourceId());
                return true;
            }
        });

        // Load offline bundled app directly from assets
        webView.loadUrl("file:///android_asset/public/index.html");
    }

    private void checkBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.BLUETOOTH_CONNECT)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{android.Manifest.permission.BLUETOOTH_CONNECT, android.Manifest.permission.BLUETOOTH_SCAN},
                        101);
            }
        }
    }

    @Override
    public void onBackPressed() {
        // If receipt preview modal is open, close it first before navigating back
        if (webView != null) {
            webView.evaluateJavascript(
                "if (document.getElementById('receipt-preview-modal') && document.getElementById('receipt-preview-modal').classList.contains('active')) { " +
                "  Module3Vendor.closeReceiptModal(); 'MODAL_CLOSED'; " +
                "} else { 'NO_MODAL'; }",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value != null && value.contains("MODAL_CLOSED")) {
                            return;
                        }
                        if (webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            MainActivity.super.onBackPressed();
                        }
                    }
                }
            );
        } else {
            super.onBackPressed();
        }
    }

    /**
     * JavaScript Bridge Interface exposed to Web Application as window.AndroidNative
     */
    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void showToast(final String toast) {
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(mContext, toast, Toast.LENGTH_SHORT).show();
                }
            });
        }

        /**
         * Native Android System Print Service
         * Automatically routes between:
         * 1) Standard A4 Portrait (PrintAttributes.MediaSize.ISO_A4) for Reports, Remittance, and Inventory
         * 2) 80mm Continuous Thermal Roll for RUGTEK BP03R receipts
         */
        @JavascriptInterface
        public void printReceipt(final String htmlContent, final String jobName) {
            boolean isThermal = (htmlContent != null) && (
                htmlContent.contains("is-thermal-receipt") ||
                htmlContent.contains("80mm auto") ||
                htmlContent.contains("width=72mm")
            );
            printDocument(htmlContent, jobName, isThermal);
        }

        @JavascriptInterface
        public void printReceipt(final String htmlContent, final String jobName, final boolean isThermal) {
            printDocument(htmlContent, jobName, isThermal);
        }

        @JavascriptInterface
        public void printDocument(final String htmlContent, final String jobName, final boolean isThermal) {
            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    try {
                        WebView printWebView = new WebView(mContext);
                        printWebView.getSettings().setJavaScriptEnabled(true);
                        printWebView.getSettings().setDomStorageEnabled(true);
                        printWebView.setWebViewClient(new WebViewClient() {
                            @Override
                            public void onPageFinished(WebView view, String url) {
                                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                                if (printManager != null) {
                                    String name = (jobName != null && !jobName.isEmpty()) ? jobName : "TASMAC_Document_11066";
                                    PrintDocumentAdapter printAdapter = view.createPrintDocumentAdapter(name);
                                    PrintAttributes.Builder builder = new PrintAttributes.Builder();

                                    if (isThermal) {
                                        // 80mm Continuous Thermal Roll (RUGTEK BP03R)
                                        builder.setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME);
                                        PrintAttributes.MediaSize rollMedia = new PrintAttributes.MediaSize("RUGTEK_80", "80mm Thermal Roll", 3150, 8000);
                                        builder.setMediaSize(rollMedia);
                                        builder.setMinMargins(PrintAttributes.Margins.NO_MARGINS);
                                    } else {
                                        // Standard A4 Portrait (Reports, Remittance, Inventory) - No tiny page slicing!
                                        builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR);
                                        builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                                        builder.setMinMargins(new PrintAttributes.Margins(200, 200, 200, 200));
                                    }

                                    printManager.print(name, printAdapter, builder.build());
                                }
                            }
                        });
                        printWebView.loadDataWithBaseURL(null, htmlContent, "text/html", "utf-8", null);
                    } catch (Exception e) {
                        Log.e(TAG, "Error in native printDocument", e);
                        Toast.makeText(mContext, "Print error: " + e.getMessage(), Toast.LENGTH_LONG).show();
                    }
                }
            });
        }

        /**
         * Query Paired Bluetooth Devices for Printer Selection Dialog
         */
        @JavascriptInterface
        public String getPairedDevices() {
            try {
                BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
                if (btAdapter == null || !btAdapter.isEnabled()) {
                    return "[]";
                }
                @SuppressLint("MissingPermission")
                Set<BluetoothDevice> paired = btAdapter.getBondedDevices();
                if (paired == null || paired.isEmpty()) {
                    return "[]";
                }
                org.json.JSONArray array = new org.json.JSONArray();
                for (BluetoothDevice d : paired) {
                    @SuppressLint("MissingPermission")
                    String name = d.getName();
                    String addr = d.getAddress();
                    org.json.JSONObject obj = new org.json.JSONObject();
                    obj.put("name", name != null ? name : "Bluetooth Printer");
                    obj.put("address", addr);
                    array.put(obj);
                }
                return array.toString();
            } catch (Exception e) {
                Log.e(TAG, "Error fetching paired devices", e);
                return "[]";
            }
        }

        /**
         * Get Saved Preferred Printer Information from SharedPreferences
         */
        @JavascriptInterface
        public String getPreferredPrinter() {
            android.content.SharedPreferences prefs = mContext.getSharedPreferences("TASMAC_PREFS", Context.MODE_PRIVATE);
            String mac = prefs.getString("PREF_PRINTER_MAC", "");
            String name = prefs.getString("PREF_PRINTER_NAME", "");
            if (mac.isEmpty()) return "";
            try {
                org.json.JSONObject obj = new org.json.JSONObject();
                obj.put("address", mac);
                obj.put("name", name);
                return obj.toString();
            } catch (Exception e) {
                return "";
            }
        }

        /**
         * Save Preferred Printer (e.g. RUGTEK BP03R)
         */
        @JavascriptInterface
        public void savePreferredPrinter(final String macAddress, final String deviceName) {
            android.content.SharedPreferences prefs = mContext.getSharedPreferences("TASMAC_PREFS", Context.MODE_PRIVATE);
            prefs.edit().putString("PREF_PRINTER_MAC", macAddress).putString("PREF_PRINTER_NAME", deviceName).apply();
            showToast("Saved Default Printer: " + deviceName);
        }

        /**
         * Disconnect / Forget Current Bluetooth Printer
         */
        @JavascriptInterface
        public void clearPreferredPrinter() {
            android.content.SharedPreferences prefs = mContext.getSharedPreferences("TASMAC_PREFS", Context.MODE_PRIVATE);
            prefs.edit().remove("PREF_PRINTER_MAC").remove("PREF_PRINTER_NAME").apply();
            showToast("Bluetooth Printer Disconnected");
        }

        /**
         * Check if Bluetooth Radio is Enabled
         */
        @JavascriptInterface
        public boolean isBluetoothEnabled() {
            BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
            return btAdapter != null && btAdapter.isEnabled();
        }

        /**
         * Direct Bluetooth Thermal POS Printer Printing (Paper-Optimized Single Roll ESC/POS)
         */
        @JavascriptInterface
        public void printBluetooth(final String plainTextReceipt) {
            android.content.SharedPreferences prefs = mContext.getSharedPreferences("TASMAC_PREFS", Context.MODE_PRIVATE);
            String savedMac = prefs.getString("PREF_PRINTER_MAC", "");
            printBluetoothToDevice(savedMac, plainTextReceipt);
        }

        /**
         * Direct Bluetooth Thermal Printing to a Specific Printer MAC Address
         */
        @JavascriptInterface
        public void printBluetoothToDevice(final String targetMac, final String plainTextReceipt) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        BluetoothAdapter btAdapter = BluetoothAdapter.getDefaultAdapter();
                        if (btAdapter == null) {
                            showToast("Bluetooth is not supported on this device.");
                            return;
                        }

                        if (!btAdapter.isEnabled()) {
                            showToast("Please turn ON Bluetooth to connect to your printer.");
                            return;
                        }

                        // Search paired Bluetooth devices
                        @SuppressLint("MissingPermission")
                        Set<BluetoothDevice> pairedDevices = btAdapter.getBondedDevices();
                        if (pairedDevices == null || pairedDevices.isEmpty()) {
                            showToast("No paired Bluetooth printer found. Please pair in phone Bluetooth settings.");
                            return;
                        }

                        BluetoothDevice printerDevice = null;

                        // 1. If targetMac is specified, match by address
                        if (targetMac != null && !targetMac.trim().isEmpty()) {
                            for (BluetoothDevice device : pairedDevices) {
                                if (device.getAddress().equalsIgnoreCase(targetMac.trim())) {
                                    printerDevice = device;
                                    break;
                                }
                            }
                        }

                        // 2. If not found or targetMac empty, check preferred in SharedPreferences
                        if (printerDevice == null) {
                            android.content.SharedPreferences prefs = mContext.getSharedPreferences("TASMAC_PREFS", Context.MODE_PRIVATE);
                            String savedMac = prefs.getString("PREF_PRINTER_MAC", "");
                            if (!savedMac.isEmpty()) {
                                for (BluetoothDevice device : pairedDevices) {
                                    if (device.getAddress().equalsIgnoreCase(savedMac)) {
                                        printerDevice = device;
                                        break;
                                    }
                                }
                            }
                        }

                        // 3. Fallback: Search for RUGTEK BP03R or common printer keywords
                        if (printerDevice == null) {
                            for (BluetoothDevice device : pairedDevices) {
                                @SuppressLint("MissingPermission")
                                String name = (device.getName() != null) ? device.getName().toLowerCase() : "";
                                if (name.contains("rugtek") || name.contains("bp03") || name.contains("bp03r") ||
                                    name.contains("printer") || name.contains("pos") || name.contains("rpp") ||
                                    name.contains("mtp") || name.contains("pt-") || name.contains("bt") ||
                                    name.contains("thermal") || name.contains("58") || name.contains("80") ||
                                    name.contains("tvs") || name.contains("epson")) {
                                    printerDevice = device;
                                    break;
                                }
                            }
                        }

                        // 4. Fallback: use first paired device
                        if (printerDevice == null && !pairedDevices.isEmpty()) {
                            printerDevice = pairedDevices.iterator().next();
                        }

                        if (printerDevice == null) {
                            showToast("No paired Bluetooth printer found. Please pair in phone Bluetooth settings.");
                            return;
                        }

                        @SuppressLint("MissingPermission")
                        final String deviceName = printerDevice.getName();
                        final String deviceMac = printerDevice.getAddress();

                        // Remember this device as preferred
                        android.content.SharedPreferences prefs = mContext.getSharedPreferences("TASMAC_PREFS", Context.MODE_PRIVATE);
                        prefs.edit().putString("PREF_PRINTER_MAC", deviceMac).putString("PREF_PRINTER_NAME", deviceName).apply();

                        showToast("Connecting to " + deviceName + "...");

                        // Connect via standard Serial Port Profile (SPP)
                        @SuppressLint("MissingPermission")
                        BluetoothSocket socket = printerDevice.createRfcommSocketToServiceRecord(SPP_UUID);
                        btAdapter.cancelDiscovery();
                        socket.connect();

                        OutputStream out = socket.getOutputStream();

                        // ESC/POS Commands:
                        // 1. Initialize printer (ESC @)
                        out.write(new byte[]{0x1B, 0x40});
                        
                        // 2. Transmit content text (Compact single continuous roll, 72mm / 48 columns)
                        out.write(plainTextReceipt.getBytes(StandardCharsets.UTF_8));
                        
                        // 3. Feed only 3 lines to clear the manual tear-bar (ESC d 3) - NO extra blank paper
                        out.write(new byte[]{0x1B, 0x64, 0x03});
                        
                        // NOTE: RUGTEK BP03R has a manual tear-bar (no motorized auto-cutter).
                        // Omit 0x1D 0x56 cut command to avoid feed stutter or garbage artifacts.

                        out.flush();
                        Thread.sleep(600);
                        out.close();
                        socket.close();

                        showToast("Printed Successfully on " + deviceName + "!");
                    } catch (Exception e) {
                        Log.e(TAG, "Bluetooth print failed", e);
                        showToast("Bluetooth printer error: " + e.getMessage() + ". Check power/connection.");
                    }
                }
            }).start();
        }

        private String ExportUtils_fallbackHTML(String text) {
            return "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=72mm, initial-scale=1.0\"><style>@page{size:80mm auto;margin:0;}html,body{width:72mm;max-width:72mm;margin:0 auto;padding:1mm;font-family:monospace;font-size:16px;font-weight:bold;color:#000;white-space:pre-wrap;word-break:break-word;page-break-inside:avoid;line-height:1.25;}</style></head><body>"
                    + text.replace("<", "&lt;").replace(">", "&gt;")
                    + "</body></html>";
        }
    }
}
