// src/components/BluetoothConnector.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bluetooth, BluetoothConnected } from 'lucide-react';
import bluetoothService from '../utils/bluetoothService';

interface DeviceItem {
  id: string;
  name?: string;
  rssi?: number;
}

interface BluetoothConnectorProps {
  onConnectionChange?: (connected: boolean) => void;
}

export const BluetoothConnector: React.FC<BluetoothConnectorProps> = ({ onConnectionChange }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanningAction, setIsScanningAction] = useState(false); // when actively connecting
  const [isChecking, setIsChecking] = useState(false); // preloader for periodic check
  const [nearbyDevices, setNearbyDevices] = useState<DeviceItem[]>([]);
  const [recentDevices, setRecentDevices] = useState<string[]>([]);
  const hasNotifiedBluetoothOffRef = useRef(false);
  const scanStartedRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // helper to upsert device into nearbyDevices
  const addOrUpdateDevice = useCallback((d: DeviceItem) => {
    setNearbyDevices(prev => {
      const idx = prev.findIndex(p => p.id === d.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...d };
        return copy;
      }
      return [d, ...prev].slice(0, 20);
    });
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;

    (async () => {
      try {
        await bluetoothService.ensurePermissions();
      } catch (e) {
        console.warn('ensurePermissions failed', e);
      }
    })();

    // start native scan automatically if possible
    (async () => {
      try {
        const started = await bluetoothService.startScan(({ id, name, rssi }: any) => {
          addOrUpdateDevice({ id, name, rssi });
        });

        // mark that we requested scanning; if it returned false, web likely requires gesture
        if (started) scanStartedRef.current = true;
      } catch (e) {
        console.warn('startScan error', e);
      }
    })();

    // initial connection check + periodic polling every 2s
    let cancelled = false;
    const doCheck = async () => {
      setIsChecking(true);
      try {
        const conn = await bluetoothService.isConnected();
        if (cancelled || isUnmountedRef.current) return;
        setIsConnected(conn);
        onConnectionChange?.(conn);
      } catch (err) {
        console.warn('isConnected check failed', err);
      }

      // On Web we can check availability
      try {
        if (typeof navigator !== 'undefined' && 'bluetooth' in navigator && typeof (navigator as any).bluetooth.getAvailability === 'function') {
          const avail = await (navigator as any).bluetooth.getAvailability();
          if (!avail && !hasNotifiedBluetoothOffRef.current) {
            alert('Bluetooth appears to be turned off — please enable Bluetooth and try again.');
            hasNotifiedBluetoothOffRef.current = true;
          } else if (avail && hasNotifiedBluetoothOffRef.current) {
            hasNotifiedBluetoothOffRef.current = false;
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setIsChecking(false);
      }
    };

    doCheck();
    const id = setInterval(doCheck, 2000);

    return () => {
      cancelled = true;
      isUnmountedRef.current = true;
      clearInterval(id);
      (async () => {
        try { await bluetoothService.stopScan(); } catch (e) { /* ignore */ }
      })();
    };
  }, [onConnectionChange, addOrUpdateDevice]);

  const handleConnect = useCallback(async (deviceId?: string) => {
    if (isScanningAction) return;
    setIsScanningAction(true);
    try {
      const ok = await bluetoothService.connectToDevice();
      // Note: for web the user will see the chooser; for native plugin we used requestDevice
      setIsConnected(ok);
      if (ok && deviceId) {
        setRecentDevices(prev => [deviceId, ...prev.filter(d => d !== deviceId)].slice(0, 5));
      }
      onConnectionChange?.(ok);
      setIsMenuOpen(false);
    } catch (err) {
      console.error('Bluetooth connection failed:', err);
      setIsConnected(false);
      onConnectionChange?.(false);
      alert('Failed to connect to device.');
    } finally {
      setIsScanningAction(false);
    }
  }, [isScanningAction, onConnectionChange]);

  const handleDisconnect = useCallback(async () => {
    await bluetoothService.disconnect();
    setIsConnected(false);
    onConnectionChange?.(false);
    setIsMenuOpen(false);
  }, [onConnectionChange]);

  // Web-only: explicit scan trigger (user gesture) — present if automatic scan wasn't started
  const webManualScan = useCallback(async () => {
    setIsScanningAction(true);
    try {
      // This will open the browser's device chooser (user gesture)
      const ok = await bluetoothService.connectToDevice();
      setIsConnected(ok);
      onConnectionChange?.(ok);
      setIsMenuOpen(false);
    } catch (e) {
      console.warn('Manual web connect failed', e);
    } finally {
      setIsScanningAction(false);
    }
  }, [onConnectionChange]);

  const isWeb = typeof navigator !== 'undefined' && (navigator as any).userAgent && (navigator as any).platform && (Capacitor?.getPlatform ? Capacitor.getPlatform() === 'web' : false);
  // Note: above uses Capacitor.getPlatform if available; but we don't import Capacitor here to keep component simple.
  // The bluetoothService.startScan already handled platform differences.

  return (
    <div className="absolute top-4 right-4 z-50">
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`
          w-12 h-12 rounded-full shadow-lg transition-all duration-300
          flex items-center justify-center relative
          ${isConnected ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-white hover:bg-gray-100 text-gray-600'}
        `}
        aria-label="Bluetooth connector"
      >
        {/* Spinner overlay while auto-check is running */}
        {isChecking && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              className={`${isConnected ? 'text-white' : 'text-gray-600'} animate-spin h-5 w-5`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 100 8v4a8 8 0 01-8-8z"></path>
            </svg>
          </span>
        )}

        {/* Icon (hidden visually under spinner when checking) */}
        <span className={isChecking ? 'opacity-0' : 'opacity-100'}>
          {isConnected ? <BluetoothConnected className="w-6 h-6" /> : <Bluetooth className="w-6 h-6" />}
        </span>
      </button>

      {isMenuOpen && (
        <div className="absolute top-14 right-0 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Bluetooth Devices</h3>
            <div className="text-xs text-gray-500">{isScanningAction ? 'Scanning...' : scanStartedRef.current ? 'Scanning' : 'Idle'}</div>
          </div>

          {isConnected ? (
            <button
              onClick={handleDisconnect}
              className="w-full px-4 py-2 text-left hover:bg-gray-50 text-red-600"
            >
              Disconnect Device
            </button>
          ) : (
            <>
              <div className="px-4 py-2">
                <p className="text-sm text-gray-600 mb-2">Nearby Devices:</p>
                {nearbyDevices.length === 0 && <div className="text-sm text-gray-500">No devices found</div>}
                {nearbyDevices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => handleConnect(device.id)}
                    disabled={isScanningAction}
                    className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 text-sm text-gray-700 disabled:opacity-50"
                  >
                    {device.name ?? device.id} {device.rssi ? `· ${device.rssi}dBm` : null}
                  </button>
                ))}
              </div>

              <div className="px-4 py-2 border-t border-gray-100">
                <p className="text-sm text-gray-600 mb-2">Recent Devices:</p>
                {recentDevices.length === 0 && <div className="text-sm text-gray-500 mb-2">No recent devices</div>}
                {recentDevices.map((device, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleConnect(device)}
                    disabled={isScanningAction}
                    className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 text-sm text-gray-700 disabled:opacity-50"
                  >
                    {device}
                  </button>
                ))}

                {/* Web fallback: browser usually requires a user gesture to show device chooser */}
                <div className="mt-3">
                  <button
                    onClick={webManualScan}
                    disabled={isScanningAction}
                    className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded text-sm disabled:opacity-50"
                  >
                    {isScanningAction ? 'Opening chooser...' : 'Tap to scan (browser)'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BluetoothConnector;
