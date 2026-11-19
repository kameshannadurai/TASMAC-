# TASMAC SHOP NO. 11066 – ANDROID MOBILE APPLICATION GUIDE

## IN-CHARGE: ANNADURAI M

This document explains how to install and run the TASMAC Shop No. 11066 application on an Android mobile phone with **100% offline operation** and permanent local data storage.

---

## METHOD 1: 1-CLICK INSTANT ANDROID APP (RECOMMENDED - ZERO COMPILATION)

The application is built as an offline Progressive Web App (PWA) with built-in service workers and persistent local IndexedDB/SQLite storage.

### Steps to Install on Android Mobile:
1. Connect phone and laptop to same local Wi-Fi or mobile hotspot (no internet required).
2. Start the application on laptop:
   ```bash
   python run.py
   ```
3. Open Chrome on the Android phone and navigate to:
   ```
   http://<LAPTOP_LOCAL_IP>:8000
   ```
   *(e.g., `http://192.168.1.10:8000`)*
4. In Chrome menu (three dots in top right corner), tap:
   **"Add to Home screen"** or **"Install app"**.
5. The **"TASMAC 11066"** app icon will be permanently installed onto your phone's home screen.
6. **Now turn off Wi-Fi and mobile data!**
7. Tap the **TASMAC 11066** icon on your home screen. It will open like a native app with:
   - Full-screen view (no browser address bar).
   - Instant opening splash screen ("TASMAC SHOP NO. 11066 - WELCOME ANNADURAI M").
   - 100% offline local database saving data permanently on the phone.
   - All 3 modules fully functional without any internet.

---

## METHOD 2: BUILD NATIVE ANDROID APK (CAPACITOR)

If you prefer a standalone `.apk` install file:

### Prerequisites:
- Node.js (v18+)
- Android Studio with Android SDK & Build Tools

### Build Commands:
```bash
cd android
npm install
npx cap add android
npx cap copy android
npx cap open android
```
In Android Studio:
1. Click **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
2. The generated debug APK will be located at:
   `android/app/build/outputs/apk/debug/app-debug.apk`
3. Copy this APK to your Android phone via USB/WhatsApp/Bluetooth and tap to install.

---

## VERIFYING TEST CASES ON ANDROID

1. **Test 1**: Enter Remittance Day 1 with Buy Back Return Bottles = 100.
   - Available Bottles shows **100**.
2. **Test 2**: Enter Remittance Day 2 with Buy Back Return Bottles = 50.
   - Available Bottles updates to **150**.
3. **Test 3**: Save Vendor Receipt with Total Bottles = 80.
   - Available = 150, Vendor Collected = 80, Remaining = **70**.
4. **Test 4**: Edit Vendor Receipt from 80 to 90.
   - Remaining Bottles updates to **60**.
5. **Test 5**: Delete Vendor Receipt of 90.
   - Remaining Bottles restores to **150**.
6. **Test 6**: Close phone app and restart phone. Reopen app.
   - All records and balances remain intact.
7. **Test 7**: Turn off all Wi-Fi and mobile data.
   - All modules continue working smoothly 100% offline.

