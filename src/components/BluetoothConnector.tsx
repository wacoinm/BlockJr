// src/components/BluetoothConnector.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { ensureBluetoothPermissions } from '../utils/ensureBluetoothPermissions';
import bluetoothService from '../utils/bluetoothService';
import { Bluetooth, BluetoothConnected } from 'lucide-react';

interface DeviceItem {
  id: string;
  name?: string;
}

interface BluetoothConnectorProps {
  onConnectionChange?: (isConnected: boolean) => void;
  open?: boolean; // optional prop to allow parent to control
}

type ScanError = Error | { message?: string } | string | null | undefined;

export const BluetoothConnector: React.FC<BluetoothConnectorProps> = ({ onConnectionChange, open }) => {
  const isNative = Capacitor.getPlatform() !== 'web';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<DeviceItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastConnectedDevice, setLastConnectedDevice] = useState<DeviceItem | null>(null);

  useEffect(() => {
    if (typeof open === 'boolean') setIsMenuOpen(open);
  }, [open]);

  async function isLocationAvailable(timeout = 3000): Promise<boolean> {
    if (!isNative) return true;
    if (!('geolocation' in navigator)) return false;

    return new Promise<boolean>((resolve) => {
      let done = false;
      const onSuccess = () => { if (!done) { done = true; resolve(true); } };
      const onFail = () => { if (!done) { done = true; resolve(false); } };

      navigator.geolocation.getCurrentPosition(
        () => onSuccess(),
        (err) => {
          console.warn('geolocation check failed', err);
          onFail();
        },
        { timeout, maximumAge: 0 }
      );

      setTimeout(() => {
        if (!done) { done = true; resolve(false); }
      }, timeout + 500);
    });
  }

  const diagnoseScanFailure = useCallback(async (scanError?: ScanError) => {
    setStatusMessage('Scan failed — checking permissions and device state...');
    try {
      const permsOk = await ensureBluetoothPermissions();
      if (!permsOk) {
        setStatusMessage('Required Bluetooth/location permissions are not granted. Please grant them in app settings.');
        return;
      }

      let bluetoothEnabled = false;
      try {
        const res = await BluetoothSerial.isEnabled();
        bluetoothEnabled = !!res.enabled;
      } catch (e) {
        console.warn('BluetoothSerial.isEnabled failed', e);
      }

      if (!bluetoothEnabled) {
        setStatusMessage('Bluetooth appears to be OFF. Please enable Bluetooth.');
        return;
      }

      const locationOk = await isLocationAvailable();
      if (!locationOk) {
        setStatusMessage('Location appears to be OFF or permission denied. Location is required for scanning on some devices.');
        return;
      }

      let errMsg: string;

      if (scanError instanceof Error) {
        errMsg = scanError.message;
      } else if (typeof scanError === "string") {
        errMsg = scanError;
      } else if (scanError && typeof scanError.message === "string") {
        errMsg = scanError.message;
      } else {
        errMsg = 'Unknown error';
      }

      setStatusMessage(`Scan failed: ${errMsg}`);
    } catch (e) {
      console.error('diagnoseScanFailure failed', e);
      setStatusMessage('Scan failed and diagnostics could not complete. See console.');
    }
  }, []);

  const handleConnect = useCallback(async (device: DeviceItem) => {
    if (isBusy) return;
    setIsBusy(true);
    setStatusMessage(`Connecting to ${device.name ?? device.id}...`);

    try {
      const permsOk = await ensureBluetoothPermissions();
      if (!permsOk) {
        setStatusMessage('Permissions required. Please grant permissions in app settings.');
        setIsBusy(false);
        return;
      }

      const ok = await bluetoothService.connect(device.id);
      if (!ok) {
        setStatusMessage(`Failed to connect to ${device.name ?? device.id}.`);
        setIsBusy(false);
        return;
      }

      setIsConnected(true);
      setLastConnectedDevice(device);
      onConnectionChange?.(true);
      setStatusMessage(`Connected to ${device.name ?? device.id}`);
      alert(`Connected to ${device.name ?? device.id}`);

      try {
        await bluetoothService.startDataListener((s) => {
          console.log('[BT UI] onData ->', s);
        });
      } catch (e) {
        console.warn('startDataListener failed', e);
      }

      try {
        await bluetoothService.startDisconnectListener(() => {
          console.log('[BT UI] disconnect event');
          setIsConnected(false);
          setLastConnectedDevice(null);
          onConnectionChange?.(false);
          setStatusMessage('Disconnected from device.');
          alert('Disconnected from device.');
          bluetoothService.stopDataListener().catch(() => {});
          bluetoothService.stopEnabledListener().catch(() => {});
          bluetoothService.stopDisconnectListener().catch(() => {});
        });
      } catch (e) {
        console.warn('startDisconnectListener failed', e);
      }

      try {
        await bluetoothService.startEnabledListener((enabled) => {
          console.log('[BT UI] enabled change ->', enabled);
          setStatusMessage(enabled ? null : 'Bluetooth is turned OFF on device.');
          if (!enabled) {
            setIsConnected(false);
            setLastConnectedDevice(null);
            onConnectionChange?.(false);
            alert('Bluetooth turned OFF on device.');
          }
        });
      } catch (e) {
        console.warn('startEnabledListener failed', e);
      }

      setIsMenuOpen(false);
    } catch (err) {
      console.error('handleConnect error', err);
      setStatusMessage('Connection error. See console.');
      alert('Connection error: ' + String(err));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onConnectionChange]);

  const handleDisconnect = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      await bluetoothService.stopDataListener();
      await bluetoothService.stopEnabledListener();
      await bluetoothService.stopDisconnectListener();
    } catch (e) {
      console.warn('Error stopping listeners', e);
    }

    try {
      await bluetoothService.disconnect();
      setIsConnected(false);
      setLastConnectedDevice(null);
      onConnectionChange?.(false);
      setStatusMessage('Disconnected.');
      alert('Disconnected from device.');
    } catch (e) {
      console.warn('Disconnect failed', e);
      setStatusMessage('Disconnect failed. See console.');
      alert('Disconnect failed: ' + String(e));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onConnectionChange]);

  const handleEnableBluetooth = async () => {
    try {
      await BluetoothSerial.enable();
      setStatusMessage(null);
      alert('Bluetooth enabled.');
    } catch (e) {
      console.error('Failed to enable Bluetooth', e);
      setStatusMessage('Failed to enable Bluetooth.');
      alert('Failed to enable Bluetooth: ' + String(e));
    }
  };

  useEffect(() => {
    if (!isConnected || !isNative) return;

    const checkConnection = async () => {
      try {
        const conn = await bluetoothService.isConnected();
        if (!conn) {
          setIsConnected(false);
          setLastConnectedDevice(null);
          onConnectionChange?.(false);
          setStatusMessage('Connection lost.');
          alert('Connection lost. Please reconnect.');
        }
      } catch (e) {
        console.warn('Periodic connection check failed', e);
        setIsConnected(false);
        setLastConnectedDevice(null);
        onConnectionChange?.(false);
        setStatusMessage('Connection check failed. See console.');
        alert('Connection lost due to check failure: ' + String(e));
      }
    };

    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, [isConnected, isNative, onConnectionChange]);

  useEffect(() => {
    const init = async () => {
      try {
        await bluetoothService.initialize();
        if (!isNative) {
          setStatusMessage('Bluetooth Serial is not supported on web.');
        }
      } catch (e) {
        console.error('Bluetooth initialization failed', e);
        setStatusMessage('Bluetooth initialization failed (permissions may be required).');
      }
    };
    init();
    return () => {
      bluetoothService.stopDataListener().catch(() => {});
      bluetoothService.stopEnabledListener().catch(() => {});
      bluetoothService.stopDisconnectListener().catch(() => {});
    };
  }, [isNative]);

  useEffect(() => {
    if (isMenuOpen && !isConnected && isNative) {
      const fetchNearby = async () => {
        setIsBusy(true);
        setStatusMessage('Scanning for devices...');
        try {
          const devices = await bluetoothService.scanForDevices();
          setNearbyDevices(devices);
          if (!devices || devices.length === 0) {
            setStatusMessage('No devices found.');
            alert('No Bluetooth devices found.');
          } else {
            setStatusMessage(null);
          }
        } catch (e: unknown) {
          if (e instanceof Error) {
            await diagnoseScanFailure(e);
            alert('Scan failed: ' + e.message);
          } else if (typeof e === 'string') {
            await diagnoseScanFailure(e);
            alert('Scan failed: ' + e);
          } else {
            await diagnoseScanFailure({ message: 'Unknown error' });
            alert('Scan failed: Unknown error');
          }
        }
        setIsBusy(false);
      };
      fetchNearby();
    }
  }, [isMenuOpen, isConnected, isNative, diagnoseScanFailure]);

  useEffect(() => {
    if (isMenuOpen && isConnected) {
      const checkConn = async () => {
        const conn = await bluetoothService.isConnected();
        if (!conn) {
          setIsConnected(false);
          setLastConnectedDevice(null);
          onConnectionChange?.(false);
          setStatusMessage('Connection lost.');
          alert('Connection lost. Please reconnect.');
        }
      };
      checkConn();
    }
  }, [isMenuOpen, isConnected, onConnectionChange]);

  return (
    <div className="absolute top-4 right-4 z-50">
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`
          w-12 h-12 rounded-full shadow-lg transition-all duration-300
          flex items-center justify-center relative
          ${isConnected ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-100'}
        `}
        aria-label="Bluetooth connector"
        disabled={isBusy}
      >
        {isBusy && (
          <span className="absolute inset-0 flex items-center justify-center">
            <svg
              className={`${isConnected ? 'text-white' : 'text-gray-100'} animate-spin h-5 w-5`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 100 8v4a8 8 0 01-8-8z"></path>
            </svg>
          </span>
        )}
        <span className={isBusy ? 'opacity-0' : 'opacity-100'}>
          {isConnected ? <BluetoothConnected className="w-6 h-6"/> : <Bluetooth  className="w-6 h-6" />}
        </span>
      </button>

      {isMenuOpen && (
        <div className="absolute top-14 right-0 w-72 rounded-lg shadow-xl border py-2"
             style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#071025' : '#fff', borderColor: document.documentElement.classList.contains('dark') ? 'rgba(148,163,184,0.06)' : '#e5e7eb' }}
        >
          <div className="px-4 py-2 border-b" style={{ borderColor: document.documentElement.classList.contains('dark') ? 'rgba(148,163,184,0.06)' : '#f3f4f6' }}>
            <h3 className="font-semibold" style={{ color: document.documentElement.classList.contains('dark') ? '#e6eef8' : '#111827' }}>Bluetooth</h3>
          </div>

          {statusMessage && (
            <div className="px-4 py-2 text-sm text-red-600 border-b" style={{ borderColor: document.documentElement.classList.contains('dark') ? 'rgba(148,163,184,0.06)' : '#f3f4f6' }}>
              {statusMessage}
              {statusMessage.toLowerCase().includes('off') && (
                <button onClick={handleEnableBluetooth} className="ml-2 text-blue-600 underline">
                  Enable
                </button>
              )}
              {statusMessage.toLowerCase().includes('permission') && (
                <button
                  onClick={async () => {
                    setStatusMessage('Requesting permissions...');
                    const ok = await ensureBluetoothPermissions();
                    setStatusMessage(ok ? null : 'Permissions required. Please grant them in settings.');
                  }}
                  className="ml-2 text-blue-600 underline"
                >
                  Request permissions
                </button>
              )}
              {statusMessage.toLowerCase().includes('location') && (
                <button
                  onClick={async () => {
                    setStatusMessage('Requesting permissions...');
                    const ok = await ensureBluetoothPermissions();
                    setStatusMessage(ok ? null : 'Permissions required. Please grant them in settings.');
                  }}
                  className="ml-2 text-blue-600 underline"
                >
                  Request permissions
                </button>
              )}
            </div>
          )}

          {isConnected ? (
            <button onClick={handleDisconnect} className="w-full px-4 py-2 text-left hover:bg-gray-50 text-red-600 dark:text-red-400">
              Disconnect
            </button>
          ) : (
            <>
              {isNative ? (
                <div className="px-4 py-2">
                  <p className="text-sm text-gray-600 dark:text-slate-300 mb-2">Discovered Devices:</p>
                  {nearbyDevices.length === 0 && <div className="text-sm text-gray-500 dark:text-slate-400">No devices found</div>}
                  {nearbyDevices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => handleConnect(device)}
                      disabled={isBusy}
                      className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-100 disabled:opacity-50"
                    >
                      {device.name ?? 'Unknown'} ({device.id.slice(0, 8)}...)
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300">
                  Not supported on web.
                </div>
              )}
            </>
          )}

          {!isConnected && lastConnectedDevice && (
            <div className="px-4 py-3 border-t" style={{ borderColor: document.documentElement.classList.contains('dark') ? 'rgba(148,163,184,0.06)' : '#f3f4f6' }}>
              <h4 className="text-sm font-medium" style={{ color: document.documentElement.classList.contains('dark') ? '#e6eef8' : '#111827' }}>Recents</h4>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm" style={{ color: document.documentElement.classList.contains('dark') ? '#cbd5e1' : '#374151' }}>
                  {lastConnectedDevice.name ?? 'Unknown'}
                  <span className="text-xs text-gray-500 ml-2">({lastConnectedDevice.id.slice(0, 8)}...)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConnect(lastConnectedDevice)}
                    disabled={isBusy}
                    className="text-sm px-2 py-1 rounded bg-blue-50 text-blue-600 disabled:opacity-50"
                  >
                    Connect
                  </button>
                  <button
                    onClick={() => setLastConnectedDevice(null)}
                    className="text-sm px-2 py-1 rounded text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BluetoothConnector;
