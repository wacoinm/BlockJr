// src/components/BluetoothConnector.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { ensureBluetoothPermissions } from '../utils/ensureBluetoothPermissions';
import bluetoothService from '../utils/bluetoothService';
import { Bluetooth, BluetoothConnected } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import type { RootState } from '../store';
// Optional: if you have a ui slice that manages bluetooth modal open state,
// import the action here. If not, this component will still accept props.
import { setBluetoothOpen as setBluetoothOpenAction } from '../store/slices/interactionSlice';
import { toast } from 'react-toastify';

interface DeviceItem {
  id: string;
  name?: string;
}

interface BluetoothConnectorProps {
  onConnectionChange?: (isConnected: boolean) => void;
  open?: boolean; // optional prop to allow parent to control
  isMenuOpen?: boolean;
  setIsMenuOpen?: (open: boolean) => void;
}

type ScanError = Error | { message?: string } | string | null | undefined;

export const BluetoothConnector: React.FC<BluetoothConnectorProps> = (props) => {
  const { onConnectionChange, open: openProp, isMenuOpen: isMenuOpenProp, setIsMenuOpen: setIsMenuOpenProp } = props;
  const dispatch = useAppDispatch();

  // --- hooks unconditionally ---
  const reduxBluetoothOpen = useAppSelector((s: RootState) => (s.ui ? s.ui.bluetoothOpen : undefined));

  // fallback derived values (prefer props)
  const isMenuOpen = typeof isMenuOpenProp === 'boolean' ? isMenuOpenProp : (typeof openProp === 'boolean' ? openProp : reduxBluetoothOpen ?? false);
  const setIsMenuOpen = setIsMenuOpenProp ?? ((open: boolean) => {
    // try dispatching ui slice action if available; otherwise no-op
    try {
      dispatch(setBluetoothOpenAction(open));
    } catch {
      // noop if action not available
    }
  });

  const isNative = Capacitor.getPlatform() !== 'web';
  const [isConnected, setIsConnected] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<DeviceItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastConnectedDevice, setLastConnectedDevice] = useState<DeviceItem | null>(null);

  useEffect(() => {
    if (typeof openProp === 'boolean') setIsMenuOpen(openProp);
    // intentionally not depending on setIsMenuOpen to avoid unnecessary re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openProp]);

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
      toast.success(`Connected to ${device.name ?? device.id}`);

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
          toast.success('Disconnected from device.');
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
            toast.warn('Bluetooth turned OFF on device.');
          }
        });
      } catch (e) {
        console.warn('startEnabledListener failed', e);
      }

      setIsMenuOpen(false);
    } catch (err) {
      console.error('handleConnect error', err);
      setStatusMessage('Connection error. See console.');
      toast.error('Connection error: ' + String(err));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onConnectionChange, setIsMenuOpen]);

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
      toast.info('Disconnected from device.');
    } catch (e) {
      console.warn('Disconnect failed', e);
      setStatusMessage('Disconnect failed. See console.');
      toast.error('Disconnect failed: ' + String(e));
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, onConnectionChange]);

  const handleEnableBluetooth = async () => {
    try {
      await BluetoothSerial.enable();
      setStatusMessage(null);
      toast.info('Bluetooth enabled.');
    } catch (e) {
      console.error('Failed to enable Bluetooth', e);
      setStatusMessage('Failed to enable Bluetooth.');
      toast.error('Failed to enable Bluetooth: ' + String(e));
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
          toast.warn('Connection lost. Please reconnect.');
        }
      } catch (e) {
        console.warn('Periodic connection check failed', e);
        setIsConnected(false);
        setLastConnectedDevice(null);
        onConnectionChange?.(false);
        setStatusMessage('Connection check failed. See console.');
        toast.error('Connection lost due to check failure: ' + String(e));
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
            toast.info('No Bluetooth devices found.');
          } else {
            setStatusMessage(null);
          }
        } catch (e: unknown) {
          if (e instanceof Error) {
            await diagnoseScanFailure(e);
            toast.warn('Scan failed: ' + e.message);
          } else if (typeof e === 'string') {
            await diagnoseScanFailure(e);
            toast.warn('Scan failed: ' + e);
          } else {
            await diagnoseScanFailure({ message: 'Unknown error' });
            toast.error('Scan failed: Unknown error');
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
          toast.warn('Connection lost. Please reconnect.');
        }
      };
      checkConn();
    }
  }, [isMenuOpen, isConnected, onConnectionChange]);

  // helper to create small stagger delays for minimal iOS-like text reveal
  const delayFor = (index: number, base = 70) => `${index * base}ms`;

  return (
    <>
      {/* Inline styles for modal + animations (kept inside component so you can copy-paste single file) */}
      <style>{`
        /* Overlay + subtle circular gradient */
        .bt-overlay {
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          background: rgba(6, 11, 20, 0.35);
          transition: opacity 260ms cubic-bezier(.22,.9,.29,1);
          z-index: 70;
        }
        .bt-overlay .bt-radial {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bt-overlay .bt-radial::before {
          content: "";
          width: 520px;
          height: 520px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 40%, rgba(59,130,246,0.12), rgba(59,130,246,0.04) 20%, rgba(0,0,0,0) 50%);
          transform: scale(0.9);
          opacity: 0;
          animation: radialFade 420ms ease 1 forwards;
        }
        @keyframes radialFade {
          from { transform: scale(0.85); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }

        /* Modal card animations */
        .bt-modal {
          transform-origin: center;
          width: 20rem;
          max-width: calc(100% - 32px);
          border-radius: 14px;
          box-shadow: 0 10px 30px rgba(2,6,23,0.45);
          transition: transform 360ms cubic-bezier(.22,.9,.29,1), opacity 220ms ease;
          will-change: transform, opacity;
          overflow: hidden;
        }
        .bt-modal-enter {
          transform: translateY(10px) scale(0.98);
          opacity: 0;
        }
        .bt-modal-enter.bt-modal-enter-active {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        /* slide/fade used by elements for staggered text reveal */
        .bt-stagger-item {
          opacity: 0;
          transform: translateY(6px);
          animation: slideUpFade 320ms cubic-bezier(.2,.9,.25,1) forwards;
        }
        @keyframes slideUpFade {
          to { opacity: 1; transform: translateY(0); }
        }

        /* small touches */
        .bt-header {
          border-bottom-width: 1px;
        }
        .bt-list-scroll {
          max-height: calc(70vh - 120px);
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        /* when screen is very small ensure the modal shrinks nicely */
        @media (max-height: 480px) {
          .bt-modal { width: calc(100% - 28px); max-height: calc(100vh - 56px); }
        }
      `}</style>

      <div className="absolute [top:calc(1rem+var(--safe-area-inset-top))] right-4 z-50">
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
      </div>

      {/* Centered overlay + modal */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bt-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            // close when background clicked (but not when modal clicked)
            if (e.target === e.currentTarget) setIsMenuOpen(false);
          }}
        >
          {/* circular gradient / decorative */}
          <div className="bt-radial" aria-hidden="true" />

          {/* Modal card */}
          <div
            className="bt-modal bg-white dark:bg-[#071025] border"
            style={{
              borderColor: document.documentElement.classList.contains('dark') ? 'rgba(148,163,184,0.06)' : '#e5e7eb',
              animationDelay: '10ms',
              // start with small entrance state for smooth iOS-like pop
              transform: 'translateY(0)',
              opacity: 1,
            }}
          >
            <div className="px-4 py-2 bt-header" style={{ borderColor: document.documentElement.classList.contains('dark') ? 'rgba(148,163,184,0.06)' : '#f3f4f6' }}>
              <h3
                className="font-semibold bt-stagger-item"
                style={{ color: document.documentElement.classList.contains('dark') ? '#e6eef8' : '#111827', animationDelay: delayFor(0) }}
              >
                Bluetooth
              </h3>
            </div>

            {/* content area with scroll if needed */}
            <div className="px-2 py-3 bt-list-scroll">
              {/* status message row */}
              {statusMessage && (
                <div
                  className="px-4 py-2 text-sm text-red-600 bt-stagger-item"
                  style={{ borderColor: document.documentElement.classList.contains('dark') ? 'rgba(148,163,184,0.06)' : '#f3f4f6', animationDelay: delayFor(1) }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>{statusMessage}</div>

                    {statusMessage.toLowerCase().includes('off') && (
                      <button onClick={handleEnableBluetooth} className="ml-1 text-blue-600 underline text-xs">
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
                        className="ml-1 text-blue-600 underline text-xs"
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
                        className="ml-1 text-blue-600 underline text-xs"
                      >
                        Request permissions
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Connected / Disconnect */}
              <div style={{ padding: '0 12px' }} className="bt-stagger-item" /* style animated */>
                {isConnected ? (
                  <button onClick={handleDisconnect} className="w-full px-4 py-2 text-left hover:bg-gray-50 text-red-600 dark:text-red-400 rounded-md">
                    Disconnect
                  </button>
                ) : (
                  <>
                    {isNative ? (
                      <div className="px-2 py-2">
                        <p className="text-sm text-gray-600 dark:text-slate-300 mb-2 bt-stagger-item" style={{ animationDelay: delayFor(3) }}>
                          Discovered Devices:
                        </p>

                        {nearbyDevices.length === 0 && (
                          <div className="text-sm text-gray-500 dark:text-slate-400 bt-stagger-item" style={{ animationDelay: delayFor(4) }}>
                            No devices found
                          </div>
                        )}

                        <div className="mt-1 space-y-1">
                          {nearbyDevices.map((device, idx) => (
                            <button
                              key={device.id}
                              onClick={() => handleConnect(device)}
                              disabled={isBusy}
                              className="w-full text-left px-3 py-2 rounded hover:bg-blue-50 dark:hover:bg-slate-800 text-sm text-gray-700 dark:text-slate-100 disabled:opacity-50"
                              style={{ animationDelay: delayFor(5 + idx) }}
                            >
                              {device.name ?? 'Unknown'} ({device.id.slice(0, 8)}...)
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 bt-stagger-item" style={{ animationDelay: delayFor(3) }}>
                        Not supported on web.
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Recent / Recents footer */}
              {!isConnected && lastConnectedDevice && (
                <div className="px-4 py-3 border-t bt-stagger-item" style={{ borderColor: document.documentElement.classList.contains('dark') ? 'rgba(148,163,184,0.06)' : '#f3f4f6', animationDelay: delayFor(12) }}>
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
          </div>
        </div>
      )}
    </>
  );
};

export default BluetoothConnector;
