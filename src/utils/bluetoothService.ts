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
    const list = (devices || []).map((d: any) => {
      // normalize to a single id string that connect() will accept
      const id = d.address ?? d.id ?? d.deviceId ?? String(d);
      const name = d.name ?? d.deviceName ?? undefined;
      return { id, name } as DeviceItem;
    });
    console.log('[BT] scanForDevices -> devices:', devices, 'normalized ->', list);
    return list;
  } catch (e) {
    console.error('[BT] Scan failed', e);
    throw e;
  }
}

/**
 * normalizeAddress:
 * Accepts a string or an object device and returns a normalized address string (or null).
 */
function normalizeAddress(deviceIdOrObj: any): string | null {
  if (!deviceIdOrObj && deviceIdOrObj !== 0) return null;
  if (typeof deviceIdOrObj === 'string') {
    const s = deviceIdOrObj.trim();
    return s.length ? s : null;
  }
  if (typeof deviceIdOrObj === 'object') {
    const v = deviceIdOrObj.address ?? deviceIdOrObj.id ?? deviceIdOrObj.deviceId ?? deviceIdOrObj.nativeId ?? null;
    if (typeof v === 'string' && v.trim().length) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  // fallback: try to stringify
  try {
    const s = String(deviceIdOrObj);
    return s.length ? s : null;
  } catch {
    return null;
  }
}

async function connect(deviceId: string | { [k: string]: any }): Promise<boolean> {
  if (!isNative) return false;
  const addr = normalizeAddress(deviceId);
  console.log('[BT] trying to connect to (raw):', deviceId, '-> normalized:', addr);
  if (!addr) {
    console.error('[BT] connect aborted: device address property is required but missing or empty.');
    return false;
  }

  // do not set connectedDeviceId until we know it succeeded
  try {
    // Try multiple signatures in order of likelihood
    const attempts: Array<() => Promise<any>> = [
      () => BluetoothSerial.connect({ address: addr }),
      () => BluetoothSerial.connect({ id: addr }),
      () => BluetoothSerial.connect({ deviceId: addr }),
      // some older / different builds accept the raw string
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      () => BluetoothSerial.connect(addr),
      // insecure connect variants (if available)
      () => BluetoothSerial.connectInsecure ? BluetoothSerial.connectInsecure({ address: addr }) : Promise.reject(new Error('connectInsecure not available')) : Promise.reject(new Error('no-op')),
      // last-resort: try connectInsecure raw
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      () => BluetoothSerial.connectInsecure ? BluetoothSerial.connectInsecure(addr) : Promise.reject(new Error('connectInsecure not available')) : Promise.reject(new Error('no-op')),
    ];

    let lastErr: any = null;
    for (const fn of attempts) {
      try {
        console.log('[BT] connect: attempting signature with payload ->', fn.toString().slice(0, 200));
        await fn();
        // success
        connectedDeviceId = addr;
        console.log('[BT] connect succeeded ->', addr);
        // double-check connection state
        try {
          const ok = await isConnected();
          console.log('[BT] isConnected after connect ->', ok);
          if (!ok) {
            console.warn('[BT] isConnected returned false right after connect; clearing connectedDeviceId');
            connectedDeviceId = null;
            return false;
          }
        } catch (e) {
          console.warn('[BT] isConnected check failed after connect', e);
          connectedDeviceId = null;
          return false;
        }
        return true;
      } catch (err) {
        lastErr = err;
        console.warn('[BT] connect attempt failed (continuing to next fallback):', err);
      }
    }

    console.error('[BT] All connect attempts failed. lastErr=', lastErr);
    return false;
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
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await BluetoothSerial.disconnect();
        } catch (e2) {
          console.warn('[BT] disconnect() fallback also failed', e2);
        }
      }
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await BluetoothSerial.disconnect();
      } catch (e) {
        console.warn('[BT] disconnect() (no address) failed', e);
      }
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
  // Try several shapes
  const attempts: Array<() => Promise<any>> = [
    () => BluetoothSerial.isConnected({ address: connectedDeviceId }),
    () => BluetoothSerial.isConnected({ id: connectedDeviceId }),
    () => BluetoothSerial.isConnected({ deviceId: connectedDeviceId }),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    () => BluetoothSerial.isConnected ? BluetoothSerial.isConnected(connectedDeviceId) : Promise.reject(new Error('isConnected not available')) : Promise.reject(new Error('no-op')),
    () => BluetoothSerial.isConnected ? BluetoothSerial.isConnected() : Promise.reject(new Error('isConnected not available')) : Promise.reject(new Error('no-op')),
  ];

  for (const fn of attempts) {
    try {
      const res = await fn();
      console.log('[BT] isConnected res:', res);
      let value: boolean;
      if (res === undefined) {
        value = true;
      } else if (typeof res === 'object' && res !== null) {
        value = !!(res.value ?? res.connected ?? res);
      } else {
        value = !!res;
      }
      if (!value) connectedDeviceId = null;
      return value;
    } catch (e) {
      console.warn('[BT] isConnected attempt failed, trying next fallback', e);
    }
  }

  connectedDeviceId = null;
  return false;
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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await BluetoothSerial.write({ value: payload });
    return;
  } catch (e) {
    console.warn('[BT] write({value}) failed, trying write(payload) fallback', e);
  }

  // 3) try raw string (some builds)
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await BluetoothSerial.write(payload);
    return;
  } catch (e) {
    console.error('[BT] write fallback final failed', e);
    throw e;
  }
}

/* --- listeners --- */

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
      await dataListener.remove();
    }
  } catch (e) {
    console.log('ERR : ', e);
  }
  dataListener = null;
  console.log('[BT] data listener removed');
}

export async function startDisconnectListener(onDisconnect: () => void) {
  if (!isNative) return;
  if (disconnectListener) return;
  try {
    // Try multiple event names for robustness
    const tryNames = ['onDisconnect', 'disconnected', 'onConnectionLost'];
    for (const name of tryNames) {
      try {
        disconnectListener = await BluetoothSerial.addListener(name, (ev: any) => {
          console.log(`[BT] ${name} event`, ev);
          connectedDeviceId = null;
          onDisconnect();
        });
        console.log('[BT] disconnect listener (' + name + ') registered');
        return;
      } catch (e) {
        console.warn(`[BT] addListener(${name}) failed`, e);
      }
    }
    console.warn('[BT] startDisconnectListener: no known disconnect event names succeeded');
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
  } catch (e) {
    console.log('ERR : ', e);
  }
  disconnectListener = null;
  console.log('[BT] disconnect listener removed');
}

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
  } catch (e) {
    console.log('ERR : ', e);
  }
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
