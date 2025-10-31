// src/utils/bluetoothService.ts
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { toast } from 'react-toastify';

const isNative = Capacitor.getPlatform() !== 'web';
let connectedDeviceId: string | null = null;

/**
 * Minimal handle representation (we don't need the full plugin type here).
 * The plugin returns a PluginListenerHandle with a `remove()` method in many Capacitor plugins.
 */
type PluginListenerHandle = { remove?: () => Promise<void> } | null;

interface DeviceItem { id: string; name?: string; }

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

/* ---------- internal shared state for subscribers ---------- */

const dataSubscribers = new Set<(s: string) => void>();
const disconnectSubscribers = new Set<() => void>();
const enabledSubscribers = new Set<(v: boolean) => void>();

let dataListener: PluginListenerHandle = null;
let disconnectListener: PluginListenerHandle = null;
let enabledListener: PluginListenerHandle = null;

let initialized = false;

/* ---------- helpers ---------- */

const tryAddListener = async (
  names: string[],
  handler: (ev: unknown) => void
): Promise<PluginListenerHandle> => {
  if (!plugin || typeof plugin.addListener !== 'function') {
    // not a native environment or plugin not present => return fake handle
    return {
      remove: async () => { /* no-op */ },
    };
  }

  for (const n of names) {
    try {
      const h = await plugin.addListener(n, handler);
      return h || { remove: async () => {} };
    } catch (e) {
      // try next name
      console.warn('[bluetoothService] addListener(', n, ') failed', e);
    }
  }
  return null;
};

function extractDataString(ev: unknown): string {
  if (!ev) return '';
  if (typeof ev === 'string') return ev;
  if (typeof ev === 'object') {
    const obj = ev as Record<string, unknown>;
    // try common fields
    if (typeof obj.data === 'string') return obj.data;
    if (typeof obj.value === 'string') return obj.value;
    if (typeof obj.read === 'string') return obj.read;
    // arraybuffer/bytes?
    const asAny = obj as any;
    if (asAny.buffer && asAny.buffer instanceof ArrayBuffer) {
      try {
        const dec = new TextDecoder();
        return dec.decode(new Uint8Array(asAny.buffer));
      } catch {}
    }
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }
  return String(ev);
}

/* ---------- public API core functions ---------- */

export async function initialize(): Promise<void> {
  if (!isNative) return;
  if (initialized) return;
  initialized = true;
  try {
    if (plugin && typeof plugin.isEnabled === 'function') {
      const res = await plugin.isEnabled({});
      // normalize shapes like { enabled: true } or boolean
      const enabled = (res && typeof res === 'object' && 'enabled' in (res as Record<string, unknown>))
        ? Boolean((res as Record<string, unknown>).enabled)
        : Boolean(res);
      if (!enabled && typeof plugin.enable === 'function') {
        await plugin.enable();
      }
      console.debug('[bluetoothService] initialized, enabled:', enabled);
    }
  } catch (err) {
    console.warn('[bluetoothService] initialize failed', err);
    // rethrow optional depending on callers; keep behavior consistent with prior file
    throw err;
  }
}

export async function scanForDevices(): Promise<DeviceItem[]> {
  if (!isNative) return [];
  try {
    if (!plugin.scan) return [];
    const raw = await plugin.scan({});
    const devicesRaw = (raw && typeof raw === 'object' && 'devices' in (raw as Record<string, unknown>))
      ? (raw as Record<string, unknown>).devices
      : raw;
    if (!Array.isArray(devicesRaw)) return [];
    return devicesRaw.map((d: unknown) => {
      if (!d || typeof d !== 'object') return { id: String(d) };
      const obj = d as Record<string, unknown>;
      const id = String(obj.address ?? obj.id ?? obj.deviceId ?? obj.uuid ?? String(obj));
      const name = typeof obj.name === 'string' ? obj.name : (typeof obj.deviceName === 'string' ? obj.deviceName : undefined);
      return { id, name };
    });
  } catch (err) {
    console.error('[bluetoothService] scanForDevices failed', err);
    throw err;
  }
}

export async function connect(deviceId: string): Promise<boolean> {
  if (!isNative) return false;
  console.debug('[bluetoothService] connect', deviceId);
  try {
    try {
      await plugin.connect({ address: deviceId });
    } catch (firstErr) {
      console.warn('[bluetoothService] connect({address}) failed, trying fallback', firstErr);
      try {
        await plugin.connect(deviceId as any);
      } catch (secondErr) {
        console.warn('[bluetoothService] connect fallback failed', secondErr);
        throw secondErr ?? firstErr;
      }
    }
    connectedDeviceId = deviceId;
    // verify
    const ok = await isConnected();
    if (!ok) {
      connectedDeviceId = null;
      return false;
    }
    return true;
  } catch (error: unknown) {
    console.error('[bluetoothService] connect failed', error);
    try {
      const msg = error instanceof Error ? error.message : String(error ?? 'Unknown');
      toast.error('[BT] Connection failed: ' + msg);
    } catch {}
    connectedDeviceId = null;
    return false;
  }
}

export async function disconnect(): Promise<void> {
  if (!isNative) return;
  console.debug('[bluetoothService] disconnect requested');
  try {
    if (connectedDeviceId) {
      try {
        await plugin.disconnect({ address: connectedDeviceId });
      } catch (e1) {
        console.warn('[bluetoothService] disconnect({address}) failed, trying fallback', e1);
        try {
          await plugin.disconnect();
        } catch (e2) {
          console.warn('[bluetoothService] disconnect() fallback also failed', e2);
        }
      }
    } else {
      try {
        await plugin.disconnect();
      } catch (err) {
        console.warn('[bluetoothService] disconnect() without address failed', err);
      }
    }
  } finally {
    connectedDeviceId = null;
  }
}

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

export async function isConnected(): Promise<boolean> {
  if (!isNative) return false;
  if (!connectedDeviceId) return false;

  try {
    const res = await plugin.isConnected({ address: connectedDeviceId });
    const val = extractBooleanFromResult(res);
    if (!val) connectedDeviceId = null;
    return val;
  } catch (e1) {
    console.warn('[bluetoothService] isConnected({address}) failed', e1);
  }

  try {
    const res = await plugin.isConnected({});
    const val = extractBooleanFromResult(res);
    if (!val) connectedDeviceId = null;
    return val;
  } catch (e2) {
    console.warn('[bluetoothService] isConnected(empty) failed', e2);
    connectedDeviceId = null;
    return false;
  }
}

export async function sendString(text: string): Promise<void> {
  if (!isNative) throw new Error('Not native platform');
  if (!connectedDeviceId) throw new Error('Not connected');
  const payload = (text ?? '') + '\n';
  try {
    await plugin.write({ address: connectedDeviceId, value: payload });
    return;
  } catch (e1) {
    console.warn('[bluetoothService] write({address,value}) failed', e1);
  }
  try {
    await plugin.write({ value: payload });
    return;
  } catch (e2) {
    console.warn('[bluetoothService] write({value}) failed', e2);
  }
  try {
    await plugin.write(payload as any);
    return;
  } catch (e3) {
    console.error('[bluetoothService] final write fallback failed', e3);
    throw e3;
  }
}

/* ---------- listener API with multi-subscriber support ---------- */

/**
 * startDataListener(onData)
 * - registers the subscriber and (if necessary) creates a single platform listener that forwards events
 * - returns an unsubscribe function (Promise resolves to that function in this implementation)
 */
export async function startDataListener(onData: (s: string) => void): Promise<() => void> {
  // add subscriber
  dataSubscribers.add(onData);

  // if already have platform listener, just return unsubscribe
  if (dataListener) {
    return () => {
      dataSubscribers.delete(onData);
      if (dataSubscribers.size === 0) {
        stopDataListener().catch(() => {});
      }
    };
  }

  // create platform listener and forward to all subscribers
  const handler = (ev: unknown) => {
    const s = extractDataString(ev).trim();
    // forward to snapshot of subscribers (safe if unsubscribes during iteration)
    for (const sub of Array.from(dataSubscribers)) {
      try {
        sub(s);
      } catch (err) {
        console.warn('[bluetoothService] data subscriber threw', err);
      }
    }
  };

  const tryNames = ['onRead', 'onDataReceived', 'data', 'onData', 'read', 'didReceiveData'];
  try {
    dataListener = await tryAddListener(tryNames, (ev) => {
      console.debug('[bluetoothService] data event', ev);
      handler(ev);
    });
    if (!dataListener) {
      console.warn('[bluetoothService] startDataListener: no platform event registered');
    } else {
      console.debug('[bluetoothService] data listener registered');
    }
  } catch (e) {
    console.warn('[bluetoothService] startDataListener failed', e);
    dataListener = null;
  }

  return () => {
    dataSubscribers.delete(onData);
    if (dataSubscribers.size === 0) {
      stopDataListener().catch(() => {});
    }
  };
}

export async function stopDataListener(): Promise<void> {
  dataSubscribers.clear();
  if (!dataListener) return;
  try {
    if (typeof dataListener.remove === 'function') {
      await dataListener.remove();
    }
  } catch (e) {
    console.warn('[bluetoothService] stopDataListener remove failed', e);
  }
  dataListener = null;
  console.debug('[bluetoothService] data listener removed');
}

/**
 * startDisconnectListener(onDisconnect)
 * - supports multiple subscribers similarly to data listener
 */
export async function startDisconnectListener(onDisconnect: () => void): Promise<() => void> {
  disconnectSubscribers.add(onDisconnect);

  if (disconnectListener) {
    return () => {
      disconnectSubscribers.delete(onDisconnect);
      if (disconnectSubscribers.size === 0) stopDisconnectListener().catch(() => {});
    };
  }

  const handler = (ev: unknown) => {
    console.debug('[bluetoothService] disconnect event', ev);
    connectedDeviceId = null;
    for (const sub of Array.from(disconnectSubscribers)) {
      try {
        sub();
      } catch (err) {
        console.warn('[bluetoothService] disconnect subscriber threw', err);
      }
    }
  };

  const tryNames = ['onDisconnect', 'disconnected', 'onConnectionLost', 'connectionLost'];
  try {
    disconnectListener = await tryAddListener(tryNames, handler);
    if (!disconnectListener) {
      console.warn('[bluetoothService] startDisconnectListener: no platform event registered');
    } else {
      console.debug('[bluetoothService] disconnect listener registered');
    }
  } catch (e) {
    console.warn('[bluetoothService] startDisconnectListener failed', e);
    disconnectListener = null;
  }

  return () => {
    disconnectSubscribers.delete(onDisconnect);
    if (disconnectSubscribers.size === 0) stopDisconnectListener().catch(() => {});
  };
}

export async function stopDisconnectListener(): Promise<void> {
  disconnectSubscribers.clear();
  if (!disconnectListener) return;
  try {
    if (typeof disconnectListener.remove === 'function') {
      await disconnectListener.remove();
    }
  } catch (e) {
    console.warn('[bluetoothService] stopDisconnectListener remove failed', e);
  }
  disconnectListener = null;
  console.debug('[bluetoothService] disconnect listener removed');
}

/* ---------- enabled listener (optional) ---------- */

export async function startEnabledListener(onEnabledChange: (enabled: boolean) => void): Promise<() => void> {
  enabledSubscribers.add(onEnabledChange);

  if (enabledListener) {
    return () => {
      enabledSubscribers.delete(onEnabledChange);
      if (enabledSubscribers.size === 0) stopEnabledListener().catch(() => {});
    };
  }

  const handler = (ev: unknown) => {
    console.debug('[bluetoothService] enabled event', ev);
    let val = false;
    if (typeof ev === 'object' && ev !== null) {
      const obj = ev as Record<string, unknown>;
      val = Boolean(obj.enabled ?? obj.value ?? obj);
    } else {
      val = Boolean(ev);
    }
    for (const sub of Array.from(enabledSubscribers)) {
      try {
        sub(Boolean(val));
      } catch (err) {
        console.warn('[bluetoothService] enabled subscriber threw', err);
      }
    }
  };

  try {
    enabledListener = await tryAddListener(['onEnabledChange', 'enabledChange', 'onBluetoothEnabled'], handler);
    if (!enabledListener) {
      console.warn('[bluetoothService] startEnabledListener: no platform event registered');
    } else {
      console.debug('[bluetoothService] enabled listener registered');
    }
  } catch (e) {
    console.warn('[bluetoothService] startEnabledListener failed', e);
    enabledListener = null;
  }

  return () => {
    enabledSubscribers.delete(onEnabledChange);
    if (enabledSubscribers.size === 0) stopEnabledListener().catch(() => {});
  };
}

export async function stopEnabledListener(): Promise<void> {
  enabledSubscribers.clear();
  if (!enabledListener) return;
  try {
    if (typeof enabledListener.remove === 'function') {
      await enabledListener.remove();
    }
  } catch (e) {
    console.warn('[bluetoothService] stopEnabledListener remove failed', e);
  }
  enabledListener = null;
  console.debug('[bluetoothService] enabled listener removed');
}

/* ---------- default export (compat) ---------- */

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
