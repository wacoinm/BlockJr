/* cross-platform Bluetooth helper (web + Capacitor BLE)
   - Uses @capacitor-community/bluetooth-le on native platforms
   - Uses Web Bluetooth API on web
   - Uses Nordic UART Service (NUS) UUIDs by default for a UART-style link
*/

import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // write
const NUS_RX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // notify

let nativeDeviceId: string | null = null;
let webCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
const isNative = Capacitor.getPlatform() !== 'web';

function strToBase64(input: string) {
  try {
    return btoa(unescape(encodeURIComponent(input)));
  } catch (e) {
    // fallback if Buffer exists (node-like)
    // @ts-ignore
    if (typeof Buffer !== 'undefined') return Buffer.from(input, 'utf8').toString('base64');
    return '';
  }
}

export const ensurePermissions = async (): Promise<boolean> => {
  if (isNative) {
    try {
      await BleClient.initialize();
      // platform-specific permission prompts usually occur when scanning/connecting
      return true;
    } catch (err) {
      console.warn('BLE initialize failed', err);
      return false;
    }
  }

  // Web: permissions are requested through navigator.bluetooth.requestDevice()
  return true;
};

export const connectToDevice = async (nameHint?: string): Promise<boolean> => {
  if (isNative) {
    try {
      await BleClient.initialize();
      const device = await BleClient.requestDevice({
        services: [NUS_SERVICE],
        allowDuplicates: false
      });

      if (!device || !device.deviceId) return false;
      nativeDeviceId = device.deviceId;
      await BleClient.connect(nativeDeviceId);

      try {
        await BleClient.subscribe(nativeDeviceId, NUS_SERVICE, NUS_RX_CHAR);
      } catch (e) {
        // some devices don't support notify on RX char
      }

      return true;
    } catch (err) {
      console.error('Native connect failed', err);
      return false;
    }
  }

  // Web flow
  try {
    const device = await navigator.bluetooth.requestDevice({
      // acceptAllDevices allows you to see devices; optionalServices let you access the NUS service
      acceptAllDevices: true,
      optionalServices: [NUS_SERVICE]
    });

    if (!device) return false;
    const gatt = await device.gatt!.connect();
    const service = await gatt.getPrimaryService(NUS_SERVICE);
    const tx = await service.getCharacteristic(NUS_TX_CHAR);
    webCharacteristic = tx;

    // enable notifications on RX char if available
    try {
      const rx = await service.getCharacteristic(NUS_RX_CHAR);
      await rx.startNotifications();
      rx.addEventListener('characteristicvaluechanged', (ev) => {
        const val = (ev.target as BluetoothRemoteGATTCharacteristic).value!;
        const decoded = new TextDecoder().decode(val);
        console.log('[BLE RX]', decoded);
      });
    } catch (e) {
      // not fatal
    }

    return true;
  } catch (err) {
    console.error('Web connect failed', err);
    return false;
  }
};

export const disconnect = async (): Promise<void> => {
  if (isNative) {
    if (nativeDeviceId) {
      try {
        await BleClient.disconnect(nativeDeviceId);
      } catch (e) {
        // ignore
      } finally {
        nativeDeviceId = null;
      }
    }
    return;
  }

  try {
    if (webCharacteristic && webCharacteristic.service && webCharacteristic.service.device.gatt?.connected) {
      webCharacteristic.service.device.gatt?.disconnect();
    }
  } catch (e) {
    // ignore
  } finally {
    webCharacteristic = null;
  }
};

export const isConnected = async (): Promise<boolean> => {
  if (isNative) {
    if (!nativeDeviceId) return false;
    try {
      return await BleClient.isConnected(nativeDeviceId);
    } catch (e) {
      return false;
    }
  }

  return !!(webCharacteristic && webCharacteristic.service && webCharacteristic.service.device.gatt?.connected);
};

export const sendString = async (text: string): Promise<void> => {
  if (isNative) {
    if (!nativeDeviceId) throw new Error('Not connected');
    const base64 = strToBase64(text);
    await BleClient.write(nativeDeviceId, NUS_SERVICE, NUS_TX_CHAR, base64);
    return;
  }

  if (!webCharacteristic) throw new Error('Not connected (web)');
  const encoder = new TextEncoder();
  await webCharacteristic.writeValue(encoder.encode(text));
};

export default {
  ensurePermissions,
  connectToDevice,
  disconnect,
  isConnected,
  sendString
};
