// src/utils/ensureBluetoothPermissions.ts
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';

const platform = Capacitor.getPlatform();
const isNative = platform !== 'web';

/**
 * Best-effort check for Bluetooth usage prerequisites.
 * Returns true when Bluetooth is enabled and necessary conditions are met.
 * Returns false when user action is required (e.g., enable Bluetooth or location).
 */
export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (!isNative) {
    console.log('[ensureBluetoothPermissions] Not native platform; skipping checks (web).');
    return true;
  }

  // 1) Ensure Bluetooth is enabled
  let bluetoothEnabled = false;
  let retries = 3;
  while (retries > 0) {
    try {
      const { enabled } = await BluetoothSerial.isEnabled();
      bluetoothEnabled = enabled;
      if (enabled) {
        console.log('[ensureBluetoothPermissions] Bluetooth is enabled');
        break;
      }
      console.log(`[ensureBluetoothPermissions] Bluetooth disabled, attempting to enable... (attempt ${4 - retries}/3)`);
      await BluetoothSerial.enable();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for enable to take effect
    } catch (e) {
      console.warn(`[ensureBluetoothPermissions] Bluetooth enable attempt failed (attempt ${4 - retries}/3)`, e);
    }
    retries--;
  }

  if (!bluetoothEnabled) {
    console.warn('[ensureBluetoothPermissions] Bluetooth could not be enabled; user action required');
    return false;
  }

  // 2) Check location availability (required for Android < 12 for scanning)
  if (platform === 'android') {
    let isAndroid12OrHigher = false;
    try {
      const info = await Device.getInfo();
      const majorVersion = parseInt(info.osVersion.split('.')[0], 10);
      isAndroid12OrHigher = majorVersion >= 12;
      console.log(`[ensureBluetoothPermissions] Android version: ${info.osVersion}, isAndroid12OrHigher: ${isAndroid12OrHigher}`);
    } catch (e) {
      console.warn('[ensureBluetoothPermissions] Failed to get Android version', e);
    }

    const locationOk = await (async (): Promise<boolean> => {
      if (!('geolocation' in navigator)) {
        console.warn('[ensureBluetoothPermissions] Geolocation not available in webview');
        return false;
      }

      return new Promise<boolean>((resolve) => {
        let done = false;
        const onSuccess = () => { if (!done) { done = true; resolve(true); } };
        const onFail = (err: any) => {
          console.warn('[ensureBluetoothPermissions] geolocation.getCurrentPosition failed', err);
          if (!done) { done = true; resolve(false); }
        };

        navigator.geolocation.getCurrentPosition(
          onSuccess,
          onFail,
          { timeout: 2500, maximumAge: 0 }
        );

        setTimeout(() => {
          if (!done) {
            console.warn('[ensureBluetoothPermissions] Location check timed out');
            done = true;
            resolve(false);
          }
        }, 3000);
      });
    })();

    // Location is required for Android < 12; optional for Android 12+
    if (!locationOk) {
      console.warn('[ensureBluetoothPermissions] Location not available or permission denied');
      if (!isAndroid12OrHigher) {
        console.warn('[ensureBluetoothPermissions] Location required for Bluetooth scanning on Android < 12');
        return false;
      }
    }
  }

  // All checks passed (Bluetooth enabled, location OK if required)
  console.log('[ensureBluetoothPermissions] All checks passed');
  return true;
}