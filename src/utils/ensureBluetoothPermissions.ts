// src/utils/ensureBluetoothPermissions.ts
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

/**
 * Ensure Bluetooth permission / availability when the app starts.
 * - On native platforms we call BleClient.initialize() (it will prompt OS dialogs).
 * - On Android: if Bluetooth is disabled, call requestEnable() to show system enable dialog.
 * - On Android: check location services (some devices require it for scanning) and offer to open settings.
 * - On iOS: if permission was denied previously, openAppSettings() is offered.
 * - On web: we check availability and show an alert — web cannot auto-grant without a user gesture.
 */
export async function ensureBluetoothPermissions(): Promise<void> {
  try {
    const platform = Capacitor.getPlatform();
    // WEB: just check availability and return (can't auto-grant)
    if (platform === 'web') {
      try {
        if (typeof (navigator as any).bluetooth?.getAvailability === 'function') {
          const avail = await (navigator as any).bluetooth.getAvailability();
          if (!avail) {
            alert('Bluetooth is not available or is turned off in this browser. Please enable Bluetooth and reload the page.');
          }
        }
      } catch (e) {
        console.warn('Web Bluetooth availability check failed', e);
      }
      return;
    }

    // Native (Android / iOS)
    // initialize() will (depending on OS) request OS-level permissions.
    await BleClient.initialize();

    // If Bluetooth adapter is disabled, try to request the user to enable it (Android)
    const enabled = await BleClient.isEnabled();
    if (!enabled) {
      if (platform === 'android') {
        try {
          // Shows a system dialog to enable Bluetooth (plugin supports requestEnable on Android)
          await BleClient.requestEnable();
        } catch (err) {
          console.warn('requestEnable failed or user declined', err);
          alert('Bluetooth is disabled. Please enable Bluetooth in system settings.');
        }
      } else {
        // On iOS you can't programmatically enable Bluetooth — guide the user to settings
        alert('Bluetooth is disabled. Please enable Bluetooth in Settings for this app.');
        try { await BleClient.openAppSettings(); } catch (e) { /* ignore */ }
      }
    }

    // Android: if location services are off, scanning may fail — ask to open Location settings
    if (platform === 'android') {
      try {
        const locEnabled = await BleClient.isLocationEnabled();
        if (!locEnabled) {
          const open = confirm('Location services appear to be off. Some Android devices require Location for BLE scanning. Open Location settings now?');
          if (open) await BleClient.openLocationSettings();
        }
      } catch (e) {
        // some devices / plugin versions may not implement this — safe to ignore
        console.warn('isLocationEnabled check failed', e);
      }
    }
  } catch (err: any) {
    console.error('Bluetooth permission/init error', err);
    // iOS special-case: if user denied permission previously the plugin suggests opening app settings
    if (Capacitor.getPlatform() === 'ios') {
      const wantOpen = confirm('Bluetooth permission may be denied. Open App Settings to allow Bluetooth for this app?');
      if (wantOpen) {
        try { await BleClient.openAppSettings(); } catch (e) { /* ignore */ }
      }
    }
  }
}
