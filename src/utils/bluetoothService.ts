// src/utils/bluetoothService.ts
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

// Scan bookkeeping
let nativeScanListener: any = null;
let webScanActive: any = null; // store the returned LE scan object if available

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
      return true;
    } catch (err) {
      console.warn('BLE initialize failed', err);
      return false;
    }
  }

  // Web: nothing to pre-grant; browser prompts when requestDevice/requestLEScan are called
  return true;
};

export const startScan = async (onDeviceFound: (device: { id: string; name?: string; rssi?: number }) => void): Promise<boolean> => {
  if (isNative) {
    try {
      // ensure BLE plugin initialized
      await BleClient.initialize();

      // remove existing listener if present
      if (nativeScanListener) {
        try { nativeScanListener.remove(); } catch (_) { /* ignore */ }
        nativeScanListener = null;
      }

      // subscribe to onScanResult events from the plugin
      nativeScanListener = BleClient.addListener('onScanResult', (payload: any) => {
        try {
          // payload.device has deviceId and name on native plugin
          const device = payload.device || payload;
          const id = device.deviceId ?? device.id ?? String(device);
          const name = device.name ?? payload.localName ?? undefined;
          const rssi = typeof payload.rssi === 'number' ? payload.rssi : undefined;
          onDeviceFound({ id, name, rssi });
        } catch (e) {
          console.warn('onScanResult processing error', e);
        }
      });

      // start a LE scan (plugin handles platform specifics)
      await BleClient.requestLEScan({
        services: [NUS_SERVICE],
        allowDuplicates: false
      });

      return true;
    } catch (err) {
      console.warn('Native startScan failed', err);
      return false;
    }
  }

  // Web: try requestLEScan if available (note: many browsers restrict this)
  try {
    const nav = (navigator as any);
    if (nav && nav.bluetooth && typeof nav.bluetooth.requestLEScan === 'function') {
      webScanActive = await nav.bluetooth.requestLEScan({ acceptAllAdvertisements: true });
      // listen for 'advertisementreceived' events
      const handler = (ev: any) => {
        try {
          const id = ev.device?.id ?? ev.device?.uuid ?? String(ev);
          const name = ev.device?.name ?? ev.name ?? ev.localName;
          const rssi = ev.rssi;
          onDeviceFound({ id, name, rssi });
        } catch (e) { /* ignore */ }
      };
      nav.bluetooth.addEventListener('advertisementreceived', handler);

      // store handler so stopScan can remove it
      (webScanActive as any)._handler = handler;
      return true;
    } else {
      // not supported / not allowed without gesture — caller should fallback to requestDevice via a user gesture
      return false;
    }
  } catch (err) {
    console.warn('Web startScan failed', err);
    return false;
  }
};

export const stopScan = async (): Promise<void> => {
  if (isNative) {
    try {
      await BleClient.stopLEScan();
    } catch (e) {
      // ignore
    }
    if (nativeScanListener) {
      try { nativeScanListener.remove(); } catch (_) { /* ignore */ }
      nativeScanListener = null;
    }
    return;
  }

  try {
    const nav = (navigator as any);
    if (webScanActive) {
      try {
        // stop() exists on some implementations
        if (typeof webScanActive.stop === 'function') webScanActive.stop();
      } catch (_) { /* ignore */ }

      if (nav && nav.bluetooth && (webScanActive as any)._handler) {
        try { nav.bluetooth.removeEventListener('advertisementreceived', (webScanActive as any)._handler); } catch (_) { /* ignore */ }
      }
      webScanActive = null;
    }
  } catch (e) {
    // ignore
  }
};

export const connectToDevice = async (deviceId?: string): Promise<boolean> => {
  if (isNative) {
    try {
      await BleClient.initialize();
      let devId: string;
      if (deviceId) {
        devId = deviceId;
      } else {
        const device = await BleClient.requestDevice({
          services: [NUS_SERVICE],
          allowDuplicates: false
        });
        if (!device || !device.deviceId) return false;
        devId = device.deviceId;
      }
      await BleClient.connect(devId);
      nativeDeviceId = devId;

      try {
        await BleClient.startNotifications(devId, NUS_SERVICE, NUS_RX_CHAR, (value) => {
          const decoded = new TextDecoder().decode(value);
          console.log('[BLE RX]', decoded);
        });
      } catch (e) { /* not fatal */ }

      return true;
    } catch (err) {
      console.error('Native connect failed', err);
      return false;
    }
  }

  // Web flow (user gesture required)
  try {
    const device = await (navigator as any).bluetooth.requestDevice({
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
    } catch (e) { /* not fatal */ }

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
      } catch (e) { /* ignore */ } finally { nativeDeviceId = null; }
    }
    return;
  }

  try {
    if (webCharacteristic && webCharacteristic.service && webCharacteristic.service.device.gatt?.connected) {
      webCharacteristic.service.device.gatt?.disconnect();
    }
  } catch (e) { /* ignore */ } finally { webCharacteristic = null; }
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
  startScan,
  stopScan,
  connectToDevice,
  disconnect,
  isConnected,
  sendString
};