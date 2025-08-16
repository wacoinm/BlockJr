// src/components/BluetoothConnector.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bluetooth, BluetoothConnected } from 'lucide-react';
import bluetoothService from '../utils/bluetoothService';
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';

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
  const [isBusy, setIsBusy] = useState(false); // for connecting/scanning actions
  const [isChecking, setIsChecking] = useState(false); // preloader for periodic check
  const [nearbyDevices, setNearbyDevices] = useState<DeviceItem[]>([]);
  const [recentDevices, setRecentDevices] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const hasNotifiedBluetoothOffRef = useRef(false);
  const scanStartedRef = useRef(false);
  const isUnmountedRef = useRef(false);

  const platform = Capacitor.getPlatform();
  const isNative = platform !== 'web';

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
        setStatusMessage('Failed to initialize Bluetooth. Check permissions.');
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
        setStatusMessage('Failed to start device scan.');
      }
    })();

    // initial connection check + periodic polling every 2s
    let cancelled = false;
    const doCheck = async () => {
      setIsChecking(true);
      try {
        if (isNative) {
          await BleClient.initialize(); // may throw if permissions denied
          const enabled = await BleClient.isEnabled();
          if (!enabled) {
            setStatusMessage('Bluetooth is turned off. Please enable it in settings.');
            setIsConnected(false);
            return;
          }
          const locEnabled = platform === 'android' ? await BleClient.isLocationEnabled() : true;
          if (!locEnabled) {
            setStatusMessage('Location services are off. Required for Bluetooth scanning on Android.');
            setIsConnected(false);
            return;
          }
        } else {
          // Web check
          const nav = navigator as any;
          if (nav.bluetooth && typeof nav.bluetooth.getAvailability === 'function') {
            const avail = await nav.bluetooth.getAvailability();
            if (!avail) {
              setStatusMessage('Bluetooth is off or unavailable in this browser.');
              setIsConnected(false);
              return;
            }
          }
        }

        setStatusMessage(null);
        const conn = await bluetoothService.isConnected();
        if (cancelled || isUnmountedRef.current) return;
        setIsConnected(conn);
        onConnectionChange?.(conn);
      } catch (err) {
        console.warn('Bluetooth check failed', err);
        setStatusMessage('Bluetooth permission denied or error. Please check app settings.');
        setIsConnected(false);
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
  }, [onConnectionChange, addOrUpdateDevice, isNative, platform]);

  const handleConnect = useCallback(async (deviceId?: string) => {
    if (isBusy) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const ok = await bluetoothService.connectToDevice(deviceId);
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
      setStatusMessage('Failed to connect to device. Please try again.');
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onConnectionChange]);

  const handleDisconnect = useCallback(async () => {
    await bluetoothService.disconnect();
    setIsConnected(false);
    onConnectionChange?.(false);
    setIsMenuOpen(false);
  }, [onConnectionChange]);

  // Web-only: explicit scan trigger (user gesture) — present if automatic scan wasn't started
  const webManualScan = useCallback(async () => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      // This will open the browser's device chooser (user gesture)
      const ok = await bluetoothService.connectToDevice();
      setIsConnected(ok);
      onConnectionChange?.(ok);
      setIsMenuOpen(false);
    } catch (e) {
      console.warn('Manual web connect failed', e);
      setStatusMessage('Failed to connect on web. Please try again.');
    } finally {
      setIsBusy(false);
    }
  }, [onConnectionChange]);

  const handleOpenSettings = useCallback(async () => {
    if (!isNative) return;
    try {
      if (statusMessage?.includes('Bluetooth is turned off')) {
        await BleClient.openBluetoothSettings();
      } else if (statusMessage?.includes('Location services')) {
        await BleClient.openLocationSettings();
      } else {
        await BleClient.openAppSettings();
      }
    } catch (e) {
      console.warn('Open settings failed', e);
    }
  }, [statusMessage, isNative]);

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
        {/* Spinner overlay while checking or busy */}
        {(isChecking || isBusy) && (
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

        {/* Icon (hidden visually under spinner when checking/busy) */}
        <span className={(isChecking || isBusy) ? 'opacity-0' : 'opacity-100'}>
          {isConnected ? <BluetoothConnected className="w-6 h-6" /> : <Bluetooth className="w-6 h-6" />}
        </span>
      </button>

      {isMenuOpen && (
        <div className="absolute top-14 right-0 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Bluetooth Devices</h3>
            <div className="text-xs text-gray-500">{isBusy ? 'Connecting...' : scanStartedRef.current ? 'Scanning' : 'Idle'}</div>
          </div>

          {statusMessage && (
            <div className="px-4 py-2 text-sm text-red-600 border-b border-gray-100">
              {statusMessage}
              {isNative && (
                <button
                  onClick={handleOpenSettings}
                  className="ml-2 text-blue-600 underline"
                >
                  Open Settings
                </button>
              )}
            </div>
          )}

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
                    disabled={isBusy}
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
                    disabled={isBusy}
                    className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 text-sm text-gray-700 disabled:opacity-50"
                  >
                    {device}
                  </button>
                ))}

                {/* Web fallback: browser usually requires a user gesture to show device chooser */}
                <div className="mt-3">
                  <button
                    onClick={webManualScan}
                    disabled={isBusy}
                    className="w-full px-3 py-2 bg-blue-50 text-blue-600 rounded text-sm disabled:opacity-50"
                  >
                    {isBusy ? 'Opening chooser...' : 'Tap to scan (browser)'}
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