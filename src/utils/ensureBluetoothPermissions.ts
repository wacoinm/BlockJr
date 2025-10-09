// src/utils/ensureBluetoothPermissions.ts
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { Camera } from '@capacitor/camera';

const platform = Capacitor.getPlatform();
const isNative = platform !== 'web';

/**
 * Best-effort check for Bluetooth + Camera prerequisites.
 * Returns true when Bluetooth is enabled and camera permission is granted.
 * Returns false when user action is required (e.g., enable Bluetooth or grant Camera permission).
 */
export async function ensureBluetoothPermissions(): Promise<boolean> {
  if (!isNative) {
    console.log('[ensureBluetoothPermissions] Not native platform; skipping checks (web).');
    return true;
  }

  // 1) Ensure Bluetooth is enabled
  let bluetoothEnabled = false;
  let btRetries = 3;
  while (btRetries > 0) {
    try {
      const { enabled } = await BluetoothSerial.isEnabled();
      bluetoothEnabled = enabled;
      if (enabled) {
        console.log('[ensureBluetoothPermissions] Bluetooth is enabled');
        break;
      }
      console.log(`[ensureBluetoothPermissions] Bluetooth disabled, attempting to enable... (attempt ${4 - btRetries}/3)`);
      await BluetoothSerial.enable();
      // Wait briefly for the enable to take effect
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.warn(`[ensureBluetoothPermissions] Bluetooth enable attempt failed (attempt ${4 - btRetries}/3)`, e);
    }
    btRetries--;
  }

  if (!bluetoothEnabled) {
    console.warn('[ensureBluetoothPermissions] Bluetooth could not be enabled; user action required');
    return false;
  }

  // 2) Ensure Camera permission is granted
  let cameraAllowed = false;
  try {
    // checkPermissions returns an object like { camera: 'granted' | 'denied' | 'prompt', photos?: ... }
    const current = await Camera.checkPermissions() as any;
    if (current.camera === 'granted') {
      cameraAllowed = true;
      console.log('[ensureBluetoothPermissions] Camera permission already granted');
    } else {
      console.log('[ensureBluetoothPermissions] Camera permission not granted, requesting permission...');
      const requested = await Camera.requestPermissions({ permissions: ['camera'] }) as any;
      if (requested.camera === 'granted') {
        cameraAllowed = true;
        console.log('[ensureBluetoothPermissions] Camera permission granted after request');
      } else {
        console.warn('[ensureBluetoothPermissions] Camera permission denied or not granted');
      }
    }
  } catch (e) {
    console.warn('[ensureBluetoothPermissions] Camera permission check/request failed', e);
  }

  if (!cameraAllowed) {
    console.warn('[ensureBluetoothPermissions] Camera permission required; user action required');
    return false;
  }

  // All checks passed (Bluetooth enabled and Camera permission granted)
  console.log('[ensureBluetoothPermissions] All checks passed');
  return true;
}
