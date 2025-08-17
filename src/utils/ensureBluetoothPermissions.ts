// src/utils/ensureBluetoothPermissions.ts
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';

const isNative = Capacitor.getPlatform() !== 'web';

export async function ensureBluetoothPermissions(): Promise<void> {
  try {
    if (isNative) {
      const { enabled } = await BluetoothSerial.isEnabled();
      if (!enabled) {
        await BluetoothSerial.enable();
      }
    } else {
      // For web, no action needed or possible for classic BT
      console.log('Classic Bluetooth not supported on web.');
    }
  } catch (err: any) {
    console.error('Bluetooth permission/init error', err);
  }
}