// src/utils/ensureBluetoothPermissions.ts
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

/**
 * Ensure Bluetooth permission / availability when the app starts.
 * - On native platforms we call BleClient.initialize() (it will prompt OS dialogs if needed).
 * - Does not handle enabling BT or location — caller should check and render in-app messages.
 */
export async function ensureBluetoothPermissions(): Promise<void> {
  try {
    const platform = Capacitor.getPlatform();
    if (platform === 'web') {
      // Web: check availability but don't alert
      try {
        if (typeof (navigator as any).bluetooth?.getAvailability === 'function') {
          const avail = await (navigator as any).bluetooth.getAvailability();
          if (!avail) {
            console.warn('Bluetooth is not available or turned off on web.');
          }
        }
      } catch (e) {
        console.warn('Web Bluetooth availability check failed', e);
      }
      return;
    }

    // Native (Android / iOS)
    await BleClient.initialize();
  } catch (err: any) {
    console.error('Bluetooth permission/init error', err);
    // Do not alert or open settings — let component handle rendering messages
  }
}