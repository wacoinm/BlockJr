// src/utils/bluetoothService.ts
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { toast } from 'react-toastify';

const isNative = Capacitor.getPlatform() !== 'web';
let connectedDeviceId: string | null = null;

/* small types */
type PluginListenerHandle = { remove?: () => Promise<void> } | null;
interface DeviceItem { id: string; name?: string; }
type PluginShape = {
  isEnabled?: (opts?: unknown) => Promise<unknown>;
  enable?: (...args: unknown[]) => Promise<unknown>;
  scan?: (opts?: unknown) => Promise<unknown>;
  connect: (opts?: unknown) => Promise<unknown>;
  disconnect?: (opts?: unknown) => Promise<unknown>;
  isConnected?: (opts?: unknown) => Promise<unknown>;
  write: (...args: unknown[]) => Promise<unknown>;
  addListener?: (eventName: string, listener: (ev: unknown) => void) => Promise<PluginListenerHandle>;
  startNotifications?: (opts?: unknown) => Promise<unknown>;
};

const plugin = BluetoothSerial as unknown as PluginShape;

/* subscribers */
const dataSubscribers = new Set<(s: string) => void>();
const disconnectSubscribers = new Set<() => void>();
const enabledSubscribers = new Set<(v: boolean) => void>();

let dataListener: PluginListenerHandle = null;
let disconnectListener: PluginListenerHandle = null;
let enabledListener: PluginListenerHandle = null;

let initialized = false;

/* simple helper: try add listener by names */
const tryAddListener = async (names: string[], handler: (ev: unknown) => void): Promise<PluginListenerHandle> => {
  if (!plugin || typeof plugin.addListener !== 'function') {
    // plugin missing (web or not installed) => fake handle
    return { remove: async () => {} };
  }
  for (const n of names) {
    try {
      const h = await plugin.addListener(n, handler);
      return h || { remove: async () => {} };
    } catch (e) {
      console.warn('[bluetoothService] addListener(', n, ') failed', e);
    }
  }
  return null;
};

/* small decoders -> produce a string for subscribers */
function decodeArrayLikeToString(v: any): string {
  try {
    if (typeof v === 'string') return v;
    const u8 = v instanceof Uint8Array ? v : new Uint8Array(v);
    return new TextDecoder().decode(u8);
  } catch (e) {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
}

function decodeBase64ToString(s: string): string {
  try {
    // atob available on mobile webviews
    if (typeof atob === 'function') {
      // decodeURIComponent(escape(...)) to handle utf8
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return decodeURIComponent(escape(atob(s)));
    }
    // fallback (node)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return Buffer.from(s, 'base64').toString('utf8');
  } catch {
    return s;
  }
}

function extractDataString(ev: unknown): string {
  if (!ev && ev !== 0) return '';
  if (typeof ev === 'string') return ev;
  if (typeof ev === 'object' && ev !== null) {
    const obj = ev as any;
    if (typeof obj.data === 'string') return obj.data;
    if (typeof obj.value === 'string') return obj.value;
    if (typeof obj.read === 'string') return obj.read;
    if (typeof obj.message === 'string') return obj.message;
    // base64 field (some plugins return this)
    if (typeof obj.base64 === 'string') return decodeBase64ToString(obj.base64);
    // array-like payloads in common fields
    if (obj.value && (obj.value.buffer || Array.isArray(obj.value) || ArrayBuffer.isView(obj.value))) return decodeArrayLikeToString(obj.value);
    if (obj.data && (obj.data.buffer || Array.isArray(obj.data) || ArrayBuffer.isView(obj.data))) return decodeArrayLikeToString(obj.data);
    if (Array.isArray(obj.bytes)) return decodeArrayLikeToString(obj.bytes);
    if (obj.buffer && (obj.buffer instanceof ArrayBuffer || obj.buffer.constructor?.name === 'ArrayBuffer')) return decodeArrayLikeToString(new Uint8Array(obj.buffer));
    // sometimes top-level has buffer
    if ((ev as any).buffer && ((ev as any).buffer instanceof ArrayBuffer)) return decodeArrayLikeToString(new Uint8Array((ev as any).buffer));
    try { return JSON.stringify(obj); } catch { return String(obj); }
  }
  return String(ev);
}

/* core: when platform emits data, forward raw string (NO trim) to subscribers */
function platformDataHandler(ev: unknown) {
  try {
    const s = extractDataString(ev);
    if (!s && s !== '0') return;
    // forward raw string exactly as decoded (no trimming)
    for (const sub of Array.from(dataSubscribers)) {
      try { sub(s); } catch (err) { console.warn('[bluetoothService] data subscriber threw', err); }
    }
  } catch (err) {
    console.warn('[bluetoothService] platformDataHandler error', err);
  }
}

/* start notifications if plugin supports it */
async function _startNotificationsIfAvailable(delimiter = '\n') {
  if (!isNative || !plugin) return;
  if (typeof plugin.startNotifications === 'function') {
    try {
      // try with delimiter first (many implementations accept it)
      await plugin.startNotifications({ delimiter });
      console.debug('[bluetoothService] startNotifications called with delimiter', delimiter);
    } catch (e) {
      try {
        // fallback: call without args
        await (plugin as any).startNotifications();
        console.debug('[bluetoothService] startNotifications called without args');
      } catch (e2) {
        console.debug('[bluetoothService] startNotifications failed', e2);
      }
    }
  }
}

/* ---------- public API ---------- */

export async function initialize(): Promise<void> {
  if (!isNative) return;
  if (initialized) return;
  initialized = true;
  try {
    if (plugin && typeof plugin.isEnabled === 'function') {
      const res = await plugin.isEnabled({});
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

    // important per plugin docs: request notifications so the device will push data
    await _startNotificationsIfAvailable('\n');

    // ensure platform data listener exists (single shared)
    if (!dataListener) {
      const tryNames = ['onRead', 'onDataReceived', 'data', 'onData', 'read', 'didReceiveData'];
      dataListener = await tryAddListener(tryNames, (ev) => {
        // forward raw payload
        platformDataHandler(ev);
      });
      if (!dataListener) console.debug('[bluetoothService] connect: no platform data listener available (yet)');
    }

    // disconnect listener (one-shot shared)
    if (!disconnectListener) {
      disconnectListener = await tryAddListener(['onDisconnect', 'disconnected', 'onConnectionLost', 'connectionLost'], (ev) => {
        console.debug('[bluetoothService] platform disconnect event', ev);
        connectedDeviceId = null;
        for (const cb of Array.from(disconnectSubscribers)) try { cb(); } catch (e) { console.warn(e); }
      });
    }

    // enabled listener (optional)
    if (!enabledListener) {
      enabledListener = await tryAddListener(['onEnabledChange', 'enabledChange', 'onBluetoothEnabled'], (ev) => {
        console.debug('[bluetoothService] platform enabled event', ev);
        const val = (ev && (ev as any).enabled) ?? ev;
        for (const cb of Array.from(enabledSubscribers)) try { cb(Boolean(val)); } catch (e) { console.warn(e); }
      });
    }

    const ok = await isConnected();
    if (!ok) { connectedDeviceId = null; return false; }
    return true;
  } catch (error: unknown) {
    console.error('[bluetoothService] connect failed', error);
    try { const msg = error instanceof Error ? error.message : String(error ?? 'Unknown'); toast.error('[BT] Connection failed: ' + msg); } catch {}
    connectedDeviceId = null;
    return false;
  }
}

export async function disconnect(): Promise<void> {
  if (!isNative) return;
  console.debug('[bluetoothService] disconnect requested');
  try {
    if (connectedDeviceId) {
      try { await plugin.disconnect?.({ address: connectedDeviceId }); } catch (e1) { console.warn('[bluetoothService] disconnect({address}) failed', e1); try { await plugin.disconnect?.(); } catch (e2) { console.warn('[bluetoothService] disconnect() fallback also failed', e2); } }
    } else {
      try { await plugin.disconnect?.(); } catch (err) { console.warn('[bluetoothService] disconnect() without address failed', err); }
    }
  } finally {
    connectedDeviceId = null;
    // cleanup listeners (best effort)
    try { if (dataListener && typeof dataListener.remove === 'function') await dataListener.remove(); } catch (e) { console.debug('[bluetoothService] remove dataListener failed', e); }
    dataListener = null;
    try { if (disconnectListener && typeof disconnectListener.remove === 'function') await disconnectListener.remove(); } catch (e) { console.debug('[bluetoothService] remove disconnectListener failed', e); }
    disconnectListener = null;
    try { if (enabledListener && typeof enabledListener.remove === 'function') await enabledListener.remove(); } catch (e) { console.debug('[bluetoothService] remove enabledListener failed', e); }
    enabledListener = null;
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
    const res = await plugin.isConnected?.({ address: connectedDeviceId });
    const val = extractBooleanFromResult(res);
    if (!val) connectedDeviceId = null;
    return val;
  } catch (e1) {
    console.warn('[bluetoothService] isConnected({address}) failed', e1);
  }
  try {
    const res = await plugin.isConnected?.({});
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
  try { await plugin.write({ address: connectedDeviceId, value: payload }); return; } catch (e1) { console.warn('[bluetoothService] write({address,value}) failed', e1); }
  try { await plugin.write({ value: payload }); return; } catch (e2) { console.warn('[bluetoothService] write({value}) failed', e2); }
  try { await plugin.write(payload as any); return; } catch (e3) { console.error('[bluetoothService] final write fallback failed', e3); throw e3; }
}

/* listeners API */

export async function startDataListener(onData: (s: string) => void): Promise<() => void> {
  dataSubscribers.add(onData);

  // ensure platform listener exists (connect may not have been called yet)
  if (!dataListener && isNative) {
    const tryNames = ['onRead', 'onDataReceived', 'data', 'onData', 'read', 'didReceiveData'];
    dataListener = await tryAddListener(tryNames, (ev) => {
      platformDataHandler(ev);
    });
    if (!dataListener) console.debug('[bluetoothService] startDataListener: no platform data listener available');
  }

  return () => {
    dataSubscribers.delete(onData);
  };
}

export async function stopDataListener(): Promise<void> {
  dataSubscribers.clear();
}

/* disconnect / enabled listeners similar pattern */

export async function startDisconnectListener(onDisconnect: () => void): Promise<() => void> {
  disconnectSubscribers.add(onDisconnect);
  if (!disconnectListener && isNative) {
    disconnectListener = await tryAddListener(['onDisconnect', 'disconnected', 'onConnectionLost', 'connectionLost'], (ev) => {
      connectedDeviceId = null;
      for (const cb of Array.from(disconnectSubscribers)) try { cb(); } catch (e) { console.warn(e); }
    });
  }
  return () => { disconnectSubscribers.delete(onDisconnect); };
}

export async function stopDisconnectListener(): Promise<void> {
  disconnectSubscribers.clear();
}

export async function startEnabledListener(onEnabledChange: (enabled: boolean) => void): Promise<() => void> {
  enabledSubscribers.add(onEnabledChange);
  if (!enabledListener && isNative) {
    enabledListener = await tryAddListener(['onEnabledChange', 'enabledChange', 'onBluetoothEnabled'], (ev) => {
      const val = (ev && (ev as any).enabled) ?? ev;
      for (const cb of Array.from(enabledSubscribers)) try { cb(Boolean(val)); } catch (e) { console.warn(e); }
    });
  }
  return () => { enabledSubscribers.delete(onEnabledChange); };
}

export async function stopEnabledListener(): Promise<void> {
  enabledSubscribers.clear();
}

/* convenience onOK: consumer can use this; note we still trim inside this helper (safe) */
async function onOK(callback: () => void): Promise<() => void> {
  const unsub = await startDataListener((msg) => {
    const s = String(msg).trim().toLowerCase();
    if (s === 'ok' || /\bok\b/.test(s)) callback();
  });
  return unsub;
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
  onOK
};
