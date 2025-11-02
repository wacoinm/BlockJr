// src/utils/bluetoothService.ts
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { toast } from 'react-toastify';

const TAG = 'BTDBG';
const now = () => new Date().toISOString();

const isNative = Capacitor.getPlatform() !== 'web';
let connectedDeviceId: string | null = null;

/* types */
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

/* logging helpers */
function logDebug(...args: any[]) { try { console.debug(TAG, now(), ...args); } catch {} }
function logInfo(...args: any[])  { try { console.info(TAG, now(), ...args); } catch {} }
function logWarn(...args: any[])  { try { console.warn(TAG, now(), ...args); } catch {} }
function logError(...args: any[]) { try { console.error(TAG, now(), ...args); } catch {} }

/* try adding listener with many possible names and log attempts */
const tryAddListener = async (names: string[], handler: (ev: unknown) => void): Promise<PluginListenerHandle> => {
  logDebug('tryAddListener names=', names, 'plugin.addListener=', typeof plugin?.addListener);
  if (!plugin || typeof plugin.addListener !== 'function') {
    logWarn('plugin.addListener not available (web or plugin missing)');
    return { remove: async () => {} };
  }
  for (const n of names) {
    try {
      logDebug('attempt addListener', n);
      const h = await plugin.addListener(n, handler);
      logInfo('addListener succeeded', n, 'handle=', !!h);
      return h || { remove: async () => {} };
    } catch (e) {
      logWarn('addListener failed for', n, e);
    }
  }
  logWarn('no addListener names succeeded from', names);
  return null;
};

/* decoders + base64 helper */
function toHex(u8: Uint8Array) {
  return Array.from(u8).map(b => b.toString(16).padStart(2,'0')).join('');
}
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
    if (typeof atob === 'function') {
      const bin = atob(s);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }
    // fallback node Buffer (rare in WebView)
    // @ts-ignore
    if (typeof Buffer !== 'undefined') return Buffer.from(s, 'base64').toString('utf8');
    return s;
  } catch (e) {
    return s;
  }
}

/* extractor that also returns diagnostics */
function extractDataStringWithDiagnostics(ev: unknown): { asString: string; diagnostics: any } {
  const diag: any = { rawType: typeof ev, raw: ev };
  if (ev == null) {
    diag.note = 'null/undefined';
    return { asString: '', diagnostics: diag };
  }
  if (typeof ev === 'string') {
    diag.form = 'string';
    diag.length = (ev as string).length;
    return { asString: ev as string, diagnostics: diag };
  }
  if (typeof ev === 'object') {
    const obj: any = ev;
    if (typeof obj.data === 'string') { diag.field='data(string)'; diag.value = obj.data; return { asString: obj.data, diagnostics: diag }; }
    if (typeof obj.value === 'string') { diag.field='value(string)'; diag.value = obj.value; return { asString: obj.value, diagnostics: diag }; }
    if (typeof obj.read === 'string') { diag.field='read(string)'; diag.value = obj.read; return { asString: obj.read, diagnostics: diag }; }
    if (typeof obj.message === 'string') { diag.field='message(string)'; diag.value = obj.message; return { asString: obj.message, diagnostics: diag }; }
    if (typeof obj.base64 === 'string') { diag.field='base64'; diag.decoded = decodeBase64ToString(obj.base64); return { asString: diag.decoded, diagnostics: diag }; }
    if (obj.value && (obj.value.buffer || Array.isArray(obj.value) || ArrayBuffer.isView(obj.value))) {
      diag.field = 'value(array-like)';
      const u8 = obj.value instanceof Uint8Array ? obj.value : new Uint8Array(obj.value);
      diag.hex = toHex(u8);
      const s = decodeArrayLikeToString(u8);
      return { asString: s, diagnostics: diag };
    }
    if (obj.data && (obj.data.buffer || Array.isArray(obj.data) || ArrayBuffer.isView(obj.data))) {
      diag.field = 'data(array-like)';
      const u8 = obj.data instanceof Uint8Array ? obj.data : new Uint8Array(obj.data);
      diag.hex = toHex(u8);
      const s = decodeArrayLikeToString(u8);
      return { asString: s, diagnostics: diag };
    }
    if (Array.isArray(obj.bytes)) {
      diag.field = 'bytes[array]';
      const u8 = new Uint8Array(obj.bytes);
      diag.hex = toHex(u8);
      const s = decodeArrayLikeToString(u8);
      return { asString: s, diagnostics: diag };
    }
    if (obj.buffer && (obj.buffer instanceof ArrayBuffer || obj.buffer.constructor?.name === 'ArrayBuffer')) {
      diag.field='buffer';
      const u8 = new Uint8Array(obj.buffer);
      diag.hex = toHex(u8);
      return { asString: decodeArrayLikeToString(u8), diagnostics: diag };
    }
    if ((ev as any).buffer && ((ev as any).buffer instanceof ArrayBuffer)) {
      const u8 = new Uint8Array((ev as any).buffer);
      diag.field = 'top-buffer';
      diag.hex = toHex(u8);
      return { asString: decodeArrayLikeToString(u8), diagnostics: diag };
    }
    try { diag.fallback = JSON.stringify(obj); return { asString: diag.fallback, diagnostics: diag }; } catch { diag.fallback = String(obj); return { asString: diag.fallback, diagnostics: diag }; }
  }
  return { asString: String(ev), diagnostics: { note: 'coerced' } };
}

/* platform handler: logs diagnostics and forwards raw decoded string to subscribers */
function platformDataHandler(ev: unknown) {
  try {
    const { asString, diagnostics } = extractDataStringWithDiagnostics(ev);
    logInfo('platformDataHandler event', { diagnostics });
    if (diagnostics.hex) logDebug('payload hex:', diagnostics.hex);
    // forward EXACT decoded string (do NOT trim here)
    for (const sub of Array.from(dataSubscribers)) {
      try { sub(asString); } catch (err) { logWarn('subscriber threw', err); }
    }
  } catch (err) {
    logError('platformDataHandler failed', err);
  }
}

/* startNotifications helper that requires deviceId/address */
async function _startNotificationsIfAvailable(deviceId: string | null, delimiter = '\n') {
  if (!isNative || !plugin) { logWarn('_startNotifications skipped (not native or plugin missing)'); return; }
  if (!deviceId) { logWarn('_startNotifications: missing deviceId'); return; }

  if (typeof plugin.startNotifications === 'function') {
    try {
      logInfo('calling startNotifications with address+delimiter', { address: deviceId, delimiter });
      await plugin.startNotifications({ address: deviceId, delimiter });
      logInfo('startNotifications ok (address+delimiter)', deviceId);
      return;
    } catch (e1) {
      logWarn('startNotifications(address,delimiter) failed', e1);
    }
    try {
      logInfo('calling startNotifications with address only', deviceId);
      await (plugin as any).startNotifications({ address: deviceId });
      logInfo('startNotifications ok (address only)', deviceId);
      return;
    } catch (e2) {
      logWarn('startNotifications(address) failed', e2);
    }
    try {
      logInfo('calling startNotifications with no args (fallback)');
      await (plugin as any).startNotifications();
      logInfo('startNotifications ok (no-arg fallback)');
      return;
    } catch (e3) {
      logError('startNotifications failed both ways', e3);
    }
  } else {
    logDebug('plugin.startNotifications not available');
  }
}

/* ---------- public API ---------- */

export async function initialize(): Promise<void> {
  logDebug('initialize called, isNative=', isNative);
  if (!isNative) return;
  if (initialized) { logDebug('already initialized'); return; }
  initialized = true;
  try {
    if (plugin && typeof plugin.isEnabled === 'function') {
      const res = await plugin.isEnabled({});
      logDebug('plugin.isEnabled returned', res);
      const enabled = (res && typeof res === 'object' && 'enabled' in (res as Record<string, unknown>))
        ? Boolean((res as Record<string, unknown>).enabled)
        : Boolean(res);
      if (!enabled && typeof plugin.enable === 'function') {
        logInfo('bluetooth not enabled, calling plugin.enable()');
        await plugin.enable();
      }
      logInfo('initialized, enabled:', enabled);
    }
  } catch (err) {
    logWarn('initialize failed', err);
    throw err;
  }
}

export async function scanForDevices(): Promise<DeviceItem[]> {
  logDebug('scanForDevices');
  if (!isNative) return [];
  try {
    if (!plugin.scan) { logWarn('plugin.scan not available'); return []; }
    const raw = await plugin.scan({});
    logDebug('scan raw result', raw);
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
    logError('scanForDevices failed', err);
    throw err;
  }
}

export async function connect(deviceId: string): Promise<boolean> {
  logInfo('connect requested', deviceId);
  if (!isNative) return false;
  try {
    try {
      logDebug('calling plugin.connect({address})');
      await plugin.connect({ address: deviceId });
    } catch (firstErr) {
      logWarn('connect({address}) failed, trying fallback', firstErr);
      try {
        await plugin.connect(deviceId as any);
      } catch (secondErr) {
        logError('connect fallback failed', secondErr);
        throw secondErr ?? firstErr;
      }
    }
    connectedDeviceId = deviceId;
    logInfo('connected to', deviceId);

    // IMPORTANT: register data listener BEFORE starting notifications so we don't miss immediate responses
    if (!dataListener) {
      const tryNames = ['onRead', 'onDataReceived', 'data', 'onData', 'read', 'didReceiveData'];
      logDebug('registering platform data listener with names', tryNames);
      dataListener = await tryAddListener(tryNames, (ev) => {
        platformDataHandler(ev);
      });
      logDebug('dataListener registered?', !!dataListener);
    } else {
      logDebug('dataListener already present');
    }

    // per plugin docs: ensure notifications requested (with device address)
    await _startNotificationsIfAvailable(deviceId, '\n');

    // disconnect listener
    if (!disconnectListener) {
      disconnectListener = await tryAddListener(['onDisconnect', 'disconnected', 'onConnectionLost', 'connectionLost'], (ev) => {
        logInfo('platform disconnect event', ev);
        connectedDeviceId = null;
        for (const cb of Array.from(disconnectSubscribers)) try { cb(); } catch (e) { logWarn(e); }
      });
    }

    // enabled listener (optional)
    if (!enabledListener) {
      enabledListener = await tryAddListener(['onEnabledChange', 'enabledChange', 'onBluetoothEnabled'], (ev) => {
        logDebug('platform enabled event', ev);
        const val = (ev && (ev as any).enabled) ?? ev;
        for (const cb of Array.from(enabledSubscribers)) try { cb(Boolean(val)); } catch (e) { logWarn(e); }
      });
    }

    const ok = await isConnected();
    if (!ok) { connectedDeviceId = null; return false; }
    return true;
  } catch (error: unknown) {
    logError('connect failed', error);
    try { const msg = error instanceof Error ? error.message : String(error ?? 'Unknown'); toast.error('[BT] Connection failed: ' + msg); } catch {}
    connectedDeviceId = null;
    return false;
  }
}

export async function disconnect(): Promise<void> {
  logInfo('disconnect requested');
  if (!isNative) return;
  try {
    if (connectedDeviceId) {
      try { await plugin.disconnect?.({ address: connectedDeviceId }); } catch (e1) { logWarn('disconnect({address}) failed', e1); try { await plugin.disconnect?.(); } catch (e2) { logWarn('disconnect() fallback failed', e2); } }
    } else {
      try { await plugin.disconnect?.(); } catch (err) { logWarn('disconnect() without address failed', err); }
    }
  } finally {
    connectedDeviceId = null;
    // cleanup listeners (best effort)
    try { if (dataListener && typeof dataListener.remove === 'function') await dataListener.remove(); } catch (e) { logWarn('remove dataListener failed', e); }
    dataListener = null;
    try { if (disconnectListener && typeof disconnectListener.remove === 'function') await disconnectListener.remove(); } catch (e) { logWarn('remove disconnectListener failed', e); }
    disconnectListener = null;
    try { if (enabledListener && typeof enabledListener.remove === 'function') await enabledListener.remove(); } catch (e) { logWarn('remove enabledListener failed', e); }
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
    logDebug('isConnected({address}) ->', res);
    const val = extractBooleanFromResult(res);
    if (!val) connectedDeviceId = null;
    return val;
  } catch (e1) {
    logWarn('isConnected({address}) failed', e1);
  }
  try {
    const res = await plugin.isConnected?.({});
    logDebug('isConnected({}) ->', res);
    const val = extractBooleanFromResult(res);
    if (!val) connectedDeviceId = null;
    return val;
  } catch (e2) {
    logWarn('isConnected(empty) failed', e2);
    connectedDeviceId = null;
    return false;
  }
}

export async function sendString(text: string): Promise<void> {
  logInfo('sendString', { text });
  if (!isNative) throw new Error('Not native platform');
  if (!connectedDeviceId) throw new Error('Not connected');
  const payload = (text ?? '') + '\n';
  try { logDebug('write try {address,value}'); await plugin.write({ address: connectedDeviceId, value: payload }); logInfo('write OK {address,value}'); return; } catch (e1) { logWarn('write({address,value}) failed', e1); }
  try { logDebug('write try {value}'); await plugin.write({ value: payload }); logInfo('write OK {value}'); return; } catch (e2) { logWarn('write({value}) failed', e2); }
  try { logDebug('write try raw payload'); await plugin.write(payload as any); logInfo('write OK raw'); return; } catch (e3) { logError('final write fallback failed', e3); throw e3; }
}

/* listeners API */
export async function startDataListener(onData: (s: string) => void): Promise<() => void> {
  logDebug('startDataListener register subscriber');
  dataSubscribers.add(onData);

  if (!dataListener && isNative) {
    const tryNames = ['onRead', 'onDataReceived', 'data', 'onData', 'read', 'didReceiveData'];
    logDebug('startDataListener will attempt to register platform listener with names', tryNames);
    dataListener = await tryAddListener(tryNames, (ev) => {
      logDebug('platform event raw', ev);
      platformDataHandler(ev);
    });
    if (!dataListener) logWarn('startDataListener: no platform data listener available');
  } else {
    logDebug('startDataListener: dataListener already present or not native', !!dataListener, isNative);
  }

  return () => {
    logDebug('startDataListener unsub called');
    dataSubscribers.delete(onData);
  };
}

export async function stopDataListener(): Promise<void> {
  logDebug('stopDataListener');
  dataSubscribers.clear();
}

/* disconnect / enabled listeners */
export async function startDisconnectListener(onDisconnect: () => void): Promise<() => void> {
  disconnectSubscribers.add(onDisconnect);
  if (!disconnectListener && isNative) {
    disconnectListener = await tryAddListener(['onDisconnect', 'disconnected', 'onConnectionLost', 'connectionLost'], (ev) => {
      logInfo('platform disconnect event', ev);
      connectedDeviceId = null;
      for (const cb of Array.from(disconnectSubscribers)) try { cb(); } catch (e) { logWarn(e); }
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
      logDebug('platform enabled event', ev);
      const val = (ev && (ev as any).enabled) ?? ev;
      for (const cb of Array.from(enabledSubscribers)) try { cb(Boolean(val)); } catch (e) { logWarn(e); }
    });
  }
  return () => { enabledSubscribers.delete(onEnabledChange); };
}

export async function stopEnabledListener(): Promise<void> {
  enabledSubscribers.clear();
}

/* convenience onOK: trims and checks for 'ok' */
async function onOK(callback: () => void): Promise<() => void> {
  logDebug('onOK registration');
  const unsub = await startDataListener((msg) => {
    const s = String(msg).trim().toLowerCase();
    logDebug('onOK sees msg', { raw: msg, trimmed: s });
    if (s === 'ok' || /\bok\b/.test(s)) {
      logInfo('onOK triggered');
      callback();
    }
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
