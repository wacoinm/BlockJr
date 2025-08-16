// src/utils/bluetoothService.ts
import { Capacitor } from '@capacitor/core';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';

// Standard Bluetooth Service UUIDs for Nordic UART Service (NUS)
// This is a common service for serial communication over BLE.
const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_CHAR = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Client writes to this (RX on the peripheral)
const NUS_RX_CHAR = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Client receives notifications from this (TX on the peripheral)

// Keep track of the currently connected device
let connectedDeviceId: string | null = null;
let webGatt: BluetoothRemoteGATTServer | null = null;
let webTxCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

const isNative = Capacitor.getPlatform() !== 'web';

/**
 * Converts a string to a Base64 string, required for the native BLE plugin.
 * @param input The string to convert.
 * @returns The Base64 encoded string.
 */
function strToBase64(input: string): string {
  return btoa(unescape(encodeURIComponent(input)));
}

/**
 * Initializes the Bluetooth client. Required on native platforms.
 */
async function initialize(): Promise<void> {
  if (isNative) {
    await BleClient.initialize();
  }
  // No-op for web, availability is checked in the component
}

/**
 * Starts scanning for BLE devices with the NUS service.
 * @param onDeviceFound A callback that will be invoked for each device found.
 */
async function startScan(
  onDeviceFound: (device: { id: string; name?: string; rssi?: number }) => void
): Promise<void> {
  if (isNative) {
    // On native, we can start a background scan.
    await BleClient.requestLEScan(
      {
        services: [NUS_SERVICE],
        allowDuplicates: false,
      },
      (result: ScanResult) => {
        onDeviceFound({
          id: result.device.deviceId,
          name: result.device.name || result.localName,
          rssi: result.rssi,
        });
      }
    );
  } else {
    // On the web, scanning is part of the connection flow initiated by a user click.
    console.log('Web Bluetooth scanning is initiated by the user via the connect button.');
  }
}

/**
 * Stops the BLE scan.
 */
async function stopScan(): Promise<void> {
  if (isNative) {
    try {
      await BleClient.stopLEScan();
    } catch (e) {
      console.warn('Error stopping scan', e);
    }
  }
  // No-op for web
}

/**
 * Connects to a device on a native platform.
 * @param deviceId The ID of the device to connect to.
 * @param onDisconnect A callback for when the device disconnects.
 * @returns True if connection was successful, false otherwise.
 */
async function connect(
  deviceId: string,
  onDisconnect?: (deviceId: string) => void
): Promise<boolean> {
  if (!isNative) return false; // This function is for native only

  try {
    // Connect and set up a disconnect listener
    await BleClient.connect(deviceId, (disconnectedId) => {
      if (disconnectedId === connectedDeviceId) {
        connectedDeviceId = null;
        onDisconnect?.(disconnectedId);
      }
    });
    connectedDeviceId = deviceId;

    // Start listening for data from the device
    await BleClient.startNotifications(
      deviceId,
      NUS_SERVICE,
      NUS_RX_CHAR,
      (value) => {
        const decoded = new TextDecoder().decode(value);
        console.log('[BLE RX]', decoded);
      }
    );
    return true;
  } catch (error) {
    console.error('Native connection failed', error);
    connectedDeviceId = null;
    return false;
  }
}

/**
 * Shows the browser's device picker and connects to the selected device.
 * @param onDisconnect A callback for when the device disconnects.
 * @returns True if connection was successful, false otherwise.
 */
async function requestAndConnectDeviceWeb(
  onDisconnect?: (deviceId: string) => void
): Promise<boolean> {
  if (isNative) return false; // This function is for web only

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [NUS_SERVICE] }],
      optionalServices: [NUS_SERVICE],
    });

    if (!device.gatt) {
        throw new Error("GATT server not available");
    }

    webGatt = await device.gatt.connect();
    connectedDeviceId = device.id;

    // Set up disconnect listener
    device.addEventListener('gattserverdisconnected', () => {
        webGatt = null;
        webTxCharacteristic = null;
        const disconnectedId = connectedDeviceId;
        connectedDeviceId = null;
        if (disconnectedId) {
            onDisconnect?.(disconnectedId);
        }
    });

    const service = await webGatt.getPrimaryService(NUS_SERVICE);
    webTxCharacteristic = await service.getCharacteristic(NUS_TX_CHAR);

    // Start listening for data from the device
    const rxCharacteristic = await service.getCharacteristic(NUS_RX_CHAR);
    await rxCharacteristic.startNotifications();
    rxCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (value) {
        const decoded = new TextDecoder().decode(value);
        console.log('[BLE RX]', decoded);
      }
    });
    return true;
  } catch (error) {
    console.error('Web connection failed', error);
    connectedDeviceId = null;
    webGatt = null;
    webTxCharacteristic = null;
    return false;
  }
}

/**
 * Disconnects from the currently connected device.
 */
async function disconnect(): Promise<void> {
  if (connectedDeviceId) {
    if (isNative) {
      try {
        await BleClient.disconnect(connectedDeviceId);
      } catch (e) { /* ignore */ }
    } else if (webGatt) {
      webGatt.disconnect();
    }
    connectedDeviceId = null;
    webGatt = null;
    webTxCharacteristic = null;
  }
}

/**
 * Checks if a device is currently connected.
 * @returns A promise that resolves to true if connected, false otherwise.
 */
async function isConnected(): Promise<boolean> {
  if (!connectedDeviceId) return false;
  if (isNative) {
    // The native client doesn't have a reliable isConnected method.
    // We rely on our internal state updated by the disconnect listener.
    return true;
  } else {
    return webGatt?.connected || false;
  }
}

/**
 * Sends a string to the connected device.
 * @param text The string to send.
 */
async function sendString(text: string): Promise<void> {
  if (!connectedDeviceId) throw new Error('Not connected');
  if (isNative) {
    const base64 = strToBase64(text);
    await BleClient.write(connectedDeviceId, NUS_SERVICE, NUS_TX_CHAR, base64);
  } else if (webTxCharacteristic) {
    const encoder = new TextEncoder();
    await webTxCharacteristic.writeValue(encoder.encode(text));
  } else {
    throw new Error('Not connected (web)');
  }
}

export default {
  initialize,
  startScan,
  stopScan,
  connect,
  requestAndConnectDeviceWeb,
  disconnect,
  isConnected,
  sendString,
};
