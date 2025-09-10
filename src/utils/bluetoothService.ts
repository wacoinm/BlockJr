// src/utils/bluetoothService.ts
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';

const isNative = Capacitor.getPlatform() !== 'web';
let connectedDeviceId: string | null = null;

/**
 * Minimal handle representation (we don't need the full plugin type here).
 * The plugin returns a PluginListenerHandle with a `remove()` method in many Capacitor plugins.
 */
type PluginListenerHandle = { remove?: () => Promise<void> } | null;

let dataListener: PluginListenerHandle = null;
let disconnectListener: PluginListenerHandle = null;
let enabledListener: PluginListenerHandle = null;

interface DeviceItem { id: string; name?: string; }

/**
 * A tiny adapter type so we can call BluetoothSerial methods in a more permissive, typed way
 * without sprinkling `any` or `@ts-ignore`. We cast the imported BluetoothSerial -> unknown -> this
 * interface at call sites.
 */
type PluginShape = {
  isEnabled: (opts?: unknown) => Promise<unknown>;
  enable: (...args: unknown[]) => Promise<unknown>;
  scan?: (opts?: unknown) => Promise<unknown>;
  connect: (opts?: unknown) => Promise<unknown>;
  disconnect: (opts?: unknown) => Promise<unknown>;
  isConnected: (opts?: unknown) => Promise<unknown>;
  write: (...args: unknown[]) => Promise<unknown>;
  addListener: (eventName: string, listener: (ev: unknown) => void) => Promise<PluginListenerHandle>;
};

const plugin = BluetoothSerial as unknown as PluginShape;

async function initialize(): Promise<void> {
  if (!isNative) return;
  try {
    // Some typings require an options argument; provide an empty object as safe default.
    const res = await plugin.isEnabled({});
    // try to read enabled flag if present
    const enabled = (res && typeof res === 'object' && 'enabled' in (res as Record<string, unknown>))
      ? Boolean((res as Record<string, unknown>).enabled)
      : Boolean(res);

    if (!enabled) {
      await plugin.enable();
    }
    console.log('[BT] initialized, enabled:', enabled);
  } catch (err: unknown) {
    console.error('[BT] Bluetooth initialization failed', err);
    throw err;
  }
}

async function scanForDevices(): Promise<DeviceItem[]> {
  if (!isNative) return [];
  try {
    if (!plugin.scan) return [];
    const raw = await plugin.scan({});
    // raw may be an object like { devices: [...] } or just an array; handle common shapes
    const devicesRaw = (raw && typeof raw === 'object' && 'devices' in (raw as Record<string, unknown>))
      ? (raw as Record<string, unknown>).devices
      : raw;

    if (!devicesRaw) return [];

    // devicesRaw might be unknown[] or something else
    if (!Array.isArray(devicesRaw)) return [];

    const mapped: DeviceItem[] = devicesRaw.map((d: unknown) => {
      if (!d || typeof d !== 'object') {
        return { id: String(d) };
      }
      const obj = d as Record<string, unknown>;
      const id = String(obj.address ?? obj.id ?? obj.deviceId ?? obj['uuid'] ?? String(obj));
      const name = typeof obj.name === 'string' ? obj.name : (typeof obj.deviceName === 'string' ? obj.deviceName : undefined);
      return { id, name };
    });

    return mapped;
  } catch (err: unknown) {
    console.error('[BT] Scan failed', err);
    throw err;
  }
}

async function connect(deviceId: string): Promise<boolean> {
  if (!isNative) return false;
  console.log('[BT] trying to connect to', deviceId);
  try {
    // Try documented signature first
    try {
      await plugin.connect({ address: deviceId });
    } catch (firstErr: unknown) {
      console.warn('[BT] connect({address}) failed, trying connect(deviceId) fallback', firstErr);
      // fallback: try call with a single value (some builds expect that)
      try {
        await plugin.connect(deviceId);
      } catch (secondErr: unknown) {
        console.warn('[BT] connect(deviceId) fallback failed', secondErr);
        throw secondErr ?? firstErr;
      }
    }

    connectedDeviceId = deviceId;
    console.log('[BT] connect succeeded');

    // check connection state
    try {
      const connected = await isConnected();
      console.log('[BT] isConnected after connect ->', connected);
      if (!connected) {
        connectedDeviceId = null;
        return false;
      }
    } catch (e: unknown) {
      console.warn('[BT] isConnected check failed after connect', e);
      connectedDeviceId = null;
      return false;
    }
    return true;
  } catch (error: unknown) {
    console.error('[BT] Connection failed', error);
    try {
      // best-effort show user-friendly message
      const msg = error instanceof Error ? error.message : String(error ?? 'Unknown');
      // keep using alert as original code did
      // eslint-disable-next-line no-alert
      alert('[BT] Connection failed: ' + msg);
    } catch {
      // ignore alert errors
    }
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
        await plugin.disconnect({ address: connectedDeviceId });
      } catch (e1: unknown) {
        console.warn('[BT] disconnect({address}) failed, trying disconnect() fallback', e1);
        try {
          await plugin.disconnect();
        } catch (e2: unknown) {
          console.warn('[BT] disconnect() fallback also failed', e2);
        }
      }
    } else {
      try {
        await plugin.disconnect();
      } catch (err: unknown) {
        console.warn('[BT] disconnect() without address failed', err);
      }
    }
  } catch (e: unknown) {
    console.warn('[BT] disconnect error', e);
  } finally {
    connectedDeviceId = null;
  }
}

/**
 * Normalizes many possible return shapes into a boolean connected value.
 */
function extractBooleanFromResult(res: unknown): boolean {
  if (res === undefined) return true;
  if (res === null) return false;
  if (typeof res === 'boolean') return res;
  if (typeof res === 'object') {
    const obj = res as Record<string, unknown>;
    if ('value' in obj) return Boolean(obj.value);
    if ('connected' in obj) return Boolean(obj.connected);
    if ('enabled' in obj) return Boolean(obj.enabled);
  }
  return Boolean(res);
}

async function isConnected(): Promise<boolean> {
  if (!isNative) return false;
  if (!connectedDeviceId) return false;

  // primary attempt: pass address option
  try {
    const res = await plugin.isConnected({ address: connectedDeviceId });
    console.log('[BT] isConnected res:', res);
    const value = extractBooleanFromResult(res);
    if (!value) connectedDeviceId = null;
    return value;
  } catch (e1: unknown) {
    console.warn('[BT] isConnected({address}) failed, trying empty-arg fallback', e1);
  }

  // fallback: try no-address / empty object
  try {
    const res = await plugin.isConnected({});
    console.log('[BT] isConnected fallback res:', res);
    const value = extractBooleanFromResult(res);
    if (!value) connectedDeviceId = null;
    return value;
  } catch (e2: unknown) {
    console.warn('[BT] isConnected(empty) fallback failed, returning false', e2);
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
    await plugin.write({ address: connectedDeviceId, value: payload });
    return;
  } catch (e1: unknown) {
    console.warn('[BT] write({address, value}) failed, trying write({value}) fallback', e1);
  }

  // 2) try value-only object
  try {
    await plugin.write({ value: payload });
    return;
  } catch (e2: unknown) {
    console.warn('[BT] write({value}) failed, trying write(payload) fallback', e2);
  }

  // 3) try raw string (some builds)
  try {
    await plugin.write(payload);
    return;
  } catch (e3: unknown) {
    console.error('[BT] write fallback final failed', e3);
    throw e3;
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
      dataListener = await plugin.addListener('onRead', (ev: unknown) => {
        console.log('[BT] onRead', ev);
        // extract common fields safely
        const str = extractDataString(ev);
        onData(str);
      });
      console.log('[BT] data listener (onRead) registered');
      return;
    } catch (err: unknown) {
      console.warn('[BT] addListener(onRead) failed, trying others', err);
    }

    // Common variants
    const tryNames = ['onDataReceived', 'data', 'onData'];
    for (const name of tryNames) {
      try {
        dataListener = await plugin.addListener(name, (ev: unknown) => {
          console.log(`[BT] ${name}`, ev);
          const str = extractDataString(ev);
          onData(str);
        });
        console.log('[BT] data listener (' + name + ') registered');
        return;
      } catch (e: unknown) {
        console.warn(`[BT] addListener(${name}) failed`, e);
      }
    }

    console.warn('[BT] startDataListener: no known data event names succeeded');
  } catch (e: unknown) {
    console.error('[BT] startDataListener failed', e);
  }
}

function extractDataString(ev: unknown): string {
  if (!ev) return '';
  // ev may be an object with .data, .value, .read, etc.
  if (typeof ev === 'string') return ev;
  if (typeof ev === 'object') {
    const obj = ev as Record<string, unknown>;
    const candidate = obj.data ?? obj.value ?? obj.read ?? obj;
    if (typeof candidate === 'string') return candidate;
    try {
      return JSON.stringify(candidate);
    } catch {
      return String(candidate ?? '');
    }
  }
  return String(ev);
}

export async function stopDataListener() {
  if (!dataListener) return;
  try {
    if (typeof dataListener.remove === 'function') {
      await dataListener.remove();
    }
  } catch { /* ignore */ }
  dataListener = null;
  console.log('[BT] data listener removed');
}

/**
 * startDisconnectListener: listens for disconnect events
 */
export async function startDisconnectListener(onDisconnect: () => void) {
  if (!isNative) return;
  if (disconnectListener) return;
  try {
    // Try multiple event names for robustness
    const tryNames = ['onDisconnect', 'disconnected', 'onConnectionLost'];
    for (const name of tryNames) {
      try {
        disconnectListener = await plugin.addListener(name, (ev: unknown) => {
          console.log(`[BT] ${name} event`, ev);
          connectedDeviceId = null;
          onDisconnect();
        });
        console.log('[BT] disconnect listener (' + name + ') registered');
        return;
      } catch (e: unknown) {
        console.warn(`[BT] addListener(${name}) failed`, e);
      }
    }
    console.warn('[BT] startDisconnectListener: no known disconnect event names succeeded');
  } catch (e: unknown) {
    console.warn('[BT] startDisconnectListener failed', e);
  }
}

export async function stopDisconnectListener() {
  if (!disconnectListener) return;
  try {
    if (typeof disconnectListener.remove === 'function') {
      await disconnectListener.remove();
    }
  } catch { /* ignore */ }
  disconnectListener = null;
  console.log('[BT] disconnect listener removed');
}

/**
 * startEnabledListener: subscribe to enabled-state changes if plugin emits them
 */
export async function startEnabledListener(onEnabledChange: (enabled: boolean) => void) {
  if (!isNative) return;
  if (enabledListener) return;
  try {
    enabledListener = await plugin.addListener('onEnabledChange', (ev: unknown) => {
      console.log('[BT] onEnabledChange', ev);
      let val = false;
      if (typeof ev === 'object' && ev !== null) {
        const obj = ev as Record<string, unknown>;
        val = Boolean(obj.enabled ?? obj.value ?? obj);
      } else {
        val = Boolean(ev);
      }
      onEnabledChange(Boolean(val));
    });
    console.log('[BT] enabled listener (onEnabledChange) registered');
    return;
  } catch (err: unknown) {
    console.warn('[BT] addListener(onEnabledChange) failed, no enabled listener registered', err);
  }
}

export async function stopEnabledListener() {
  if (!enabledListener) return;
  try {
    if (typeof enabledListener.remove === 'function') {
      await enabledListener.remove();
    }
  } catch { /* ignore */ }
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