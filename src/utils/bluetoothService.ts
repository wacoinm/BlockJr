// src/utils/bluetoothService.ts
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';

const isNative = Capacitor.getPlatform() !== 'web';
let connectedDeviceId: string | null = null;

let dataListener: any = null;
let disconnectListener: any = null;
let enabledListener: any = null;

interface DeviceItem { id: string; name?: string; }

async function initialize(): Promise<void> {
  if (!isNative) return;
  try {
    const { enabled } = await BluetoothSerial.isEnabled();
    if (!enabled) {
      await BluetoothSerial.enable();
    }
    console.log('[BT] initialized, enabled:', enabled);
  } catch (e) {
    console.error('[BT] Bluetooth initialization failed', e);
    throw e;
  }
}

async function scanForDevices(): Promise<DeviceItem[]> {
  if (!isNative) return [];
  try {
    const { devices } = await BluetoothSerial.scan();
    return (devices || []).map((d: any) => ({
      id: d.address ?? d.id ?? d.deviceId ?? String(d),
      name: d.name ?? d.deviceName ?? undefined,
    }));
  } catch (e) {
    console.error('[BT] Scan failed', e);
    throw e;
  }
}

async function connect(deviceId: string): Promise<boolean> {
  if (!isNative) return false;
  console.log('[BT] trying to connect to', deviceId);
  try {
    try {
      await BluetoothSerial.connect({ address: deviceId });
    } catch (firstErr) {
      console.warn('[BT] connect({address}) failed, trying connect(deviceId) fallback', firstErr);
      // @ts-ignore
      await BluetoothSerial.connect(deviceId);
    }
    connectedDeviceId = deviceId;
    console.log('[BT] connect succeeded');
    try {
      const { value } = await BluetoothSerial.isConnected({ address: deviceId });
      console.log('[BT] isConnected after connect ->', value);
    } catch (e) {
      console.warn('[BT] isConnected check failed after connect', e);
    }
    return true;
  } catch (error) {
    console.error('[BT] Connection failed', error);
    connectedDeviceId = null;
    return false;
  }
}

async function disconnect(): Promise<void> {
  if (!isNative) return;
  console.log('[BT] disconnect requested');
  try {
    if (connectedDeviceId) {
      try {
        await BluetoothSerial.disconnect({ address: connectedDeviceId });
      } catch (e1) {
        console.warn('[BT] disconnect({address}) failed, trying disconnect() fallback', e1);
        try {
          await BluetoothSerial.disconnect();
        } catch (e2) {
          console.warn('[BT] disconnect() fallback also failed', e2);
        }
      }
    } else {
      await BluetoothSerial.disconnect();
    }
  } catch (e) {
    console.warn('[BT] disconnect error', e);
  } finally {
    connectedDeviceId = null;
  }
}

async function isConnected(): Promise<boolean> {
  if (!isNative) return false;
  if (!connectedDeviceId) return false;
  try {
    const { value } = await BluetoothSerial.isConnected({ address: connectedDeviceId });
    if (!value) connectedDeviceId = null;
    return value;
  } catch (e) {
    console.warn('[BT] isConnected check failed', e);
    connectedDeviceId = null;
    return false;
  }
}

/**
 * sendString:
 * - primary: { address, value }
 * - fallback: { value }
 * - fallback2: direct string (some builds expect raw arg)
 */
async function sendString(text: string): Promise<void> {
  if (!isNative) throw new Error('Not native platform');
  if (!connectedDeviceId) throw new Error('Not connected');

  const payload = (text ?? '') + '\n';
  console.log('[BT] write ->', { address: connectedDeviceId, value: payload });

  // 1) try documented signature
  try {
    await BluetoothSerial.write({ address: connectedDeviceId, value: payload });
    return;
  } catch (e) {
    console.warn('[BT] write({address, value}) failed, trying write({value}) fallback', e);
  }

  // 2) try value-only object
  try {
    // @ts-ignore
    await BluetoothSerial.write({ value: payload });
    return;
  } catch (e) {
    console.warn('[BT] write({value}) failed, trying write(payload) fallback', e);
  }

  // 3) try raw string (some builds)
  try {
    // @ts-ignore
    await BluetoothSerial.write(payload);
    return;
  } catch (e) {
    console.error('[BT] write fallback final failed', e);
    throw e;
  }
}

/* --- listeners --- */

/**
 * startDataListener:
 *   tries multiple event names (onRead, onDataReceived, data, onData)
 *   calls onData with a string payload when an event arrives.
 */
export async function startDataListener(onData: (s: string) => void) {
  if (!isNative) return;
  if (dataListener) return;
  try {
    // Try 'onRead' first (your environment)
    try {
      dataListener = await BluetoothSerial.addListener('onRead', (ev: any) => {
        console.log('[BT] onRead', ev);
        onData(ev.data ?? ev.value ?? ev?.read ?? ev);
      });
      console.log('[BT] data listener (onRead) registered');
      return;
    } catch (err) {
      console.warn('[BT] addListener(onRead) failed, trying others', err);
    }

    // Common variants
    const tryNames = ['onDataReceived', 'data', 'onData'];
    for (const name of tryNames) {
      try {
        // register and keep handle
        dataListener = await BluetoothSerial.addListener(name, (ev: any) => {
          console.log(`[BT] ${name}`, ev);
          onData(ev.data ?? ev.value ?? ev?.read ?? ev);
        });
        console.log('[BT] data listener (' + name + ') registered');
        return;
      } catch (e) {
        console.warn(`[BT] addListener(${name}) failed`, e);
      }
    }

    console.warn('[BT] startDataListener: no known data event names succeeded');
  } catch (e) {
    console.error('[BT] startDataListener failed', e);
  }
}

export async function stopDataListener() {
  if (!dataListener) return;
  try {
    if (typeof dataListener.remove === 'function') {
      await dataListener.remove();
    } else if (dataListener && typeof dataListener.then === 'function' && dataListener.remove) {
      // some plugin proxies return a Promise-like with remove
      await dataListener.remove();
    }
  } catch (e) { /* ignore */ }
  dataListener = null;
  console.log('[BT] data listener removed');
}

/**
 * startDisconnectListener: listens for disconnect events (common name 'onDisconnect')
 */
export async function startDisconnectListener(onDisconnect: () => void) {
  if (!isNative) return;
  if (disconnectListener) return;
  try {
    disconnectListener = await BluetoothSerial.addListener('onDisconnect', (ev: any) => {
      console.log('[BT] onDisconnect event', ev);
      connectedDeviceId = null;
      onDisconnect();
    });
    console.log('[BT] disconnect listener registered');
  } catch (e) {
    console.warn('[BT] startDisconnectListener failed', e);
  }
}

export async function stopDisconnectListener() {
  if (!disconnectListener) return;
  try {
    if (typeof disconnectListener.remove === 'function') {
      await disconnectListener.remove();
    }
  } catch (e) { /* ignore */ }
  disconnectListener = null;
  console.log('[BT] disconnect listener removed');
}

/**
 * startEnabledListener: subscribe to enabled-state changes if plugin emits them
 * common event name in your note: 'onEnabledChange' (payload: { enabled: boolean } or similar)
 */
export async function startEnabledListener(onEnabledChange: (enabled: boolean) => void) {
  if (!isNative) return;
  if (enabledListener) return;
  try {
    enabledListener = await BluetoothSerial.addListener('onEnabledChange', (ev: any) => {
      console.log('[BT] onEnabledChange', ev);
      const val = (ev && (ev.enabled ?? ev.value ?? ev) ) ?? false;
      onEnabledChange(Boolean(val));
    });
    console.log('[BT] enabled listener (onEnabledChange) registered');
    return;
  } catch (err) {
    console.warn('[BT] addListener(onEnabledChange) failed, no enabled listener registered', err);
  }
}

export async function stopEnabledListener() {
  if (!enabledListener) return;
  try {
    if (typeof enabledListener.remove === 'function') {
      await enabledListener.remove();
    }
  } catch (e) { /* ignore */ }
  enabledListener = null;
  console.log('[BT] enabled listener removed');
}

export default {
  initialize,
  scanForDevices,
  connect,
  disconnect,
  isConnected,
  sendString,
  startDataListener,
  stopDataListener,
  startDisconnectListener,
  stopDisconnectListener,
  startEnabledListener,
  stopEnabledListener,
};
