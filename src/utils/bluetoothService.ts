// src/utils/bluetoothService.ts
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';

const isNative = Capacitor.getPlatform() !== 'web';

let connectedDeviceId: string | null = null;

interface DeviceItem {
  id: string;
  name?: string;
}

async function initialize(): Promise<void> {
  if (isNative) {
    try {
      const { enabled } = await BluetoothSerial.isEnabled();
      if (!enabled) {
        await BluetoothSerial.enable();
      }
    } catch (e) {
      console.error('Bluetooth initialization failed', e);
      throw e;
    }
  }
}

async function getPairedDevices(): Promise<DeviceItem[]> {
  // This method is not available in the plugin, so returning empty array
  return [];
}

async function scanForDevices(): Promise<DeviceItem[]> {
  if (!isNative) return [];
  try {
    const { devices } = await BluetoothSerial.scan();
    return devices.map((d: any) => ({
      id: d.address,
      name: d.name,
    }));
  } catch (e) {
    console.error('Scan failed', e);
    throw e;
  }
}

async function connect(deviceId: string): Promise<boolean> {
  if (!isNative) return false;
  try {
    await BluetoothSerial.connect({ address: deviceId });
    connectedDeviceId = deviceId;
    return true;
  } catch (error) {
    console.error('Connection failed', error);
    connectedDeviceId = null;
    return false;
  }
}

async function disconnect(): Promise<void> {
  if (connectedDeviceId) {
    try {
      await BluetoothSerial.disconnect();
    } catch (e) { /* ignore */ }
    connectedDeviceId = null;
  }
}

async function isConnected(): Promise<boolean> {
  if (!connectedDeviceId) return false;
  if (!isNative) return false;
  try {
    const { value } = await BluetoothSerial.isConnected({ address: connectedDeviceId });
    if (!value) {
      connectedDeviceId = null;
    }
    return value;
  } catch {
    connectedDeviceId = null;
    return false;
  }
}

async function sendString(text: string): Promise<void> {
  if (!connectedDeviceId) throw new Error('Not connected');
  await BluetoothSerial.write({ data: text + '\n' });
}

export default {
  initialize,
  getPairedDevices,
  scanForDevices,
  connect,
  disconnect,
  isConnected,
  sendString,
};
