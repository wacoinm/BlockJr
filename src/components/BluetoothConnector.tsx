// src/components/BluetoothConnector.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Bluetooth, BluetoothConnected } from 'lucide-react';
import bluetoothService from '../utils/bluetoothService';

interface BluetoothConnectorProps {
  isConnected?: boolean;
  onConnectionChange?: (connected: boolean) => void;
}

export const BluetoothConnector: React.FC<BluetoothConnectorProps> = ({
  isConnected: controlledIsConnected,
  onConnectionChange,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(!!controlledIsConnected);
  const [isScanning, setIsScanning] = useState(false);
  const [recentDevices, setRecentDevices] = useState<string[]>([]);

  // track whether we've already alerted that bluetooth is off (so we don't spam)
  const hasNotifiedBluetoothOffRef = useRef(false);

  useEffect(() => {
    if (typeof controlledIsConnected === 'boolean') {
      setIsConnected(controlledIsConnected);
    }
  }, [controlledIsConnected]);

  // Poll connection state every 2 seconds and update parent
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const conn = await bluetoothService.isConnected();
        if (cancelled) return;
        setIsConnected(conn);
        onConnectionChange?.(conn);
      } catch (err) {
        // swallow
      }

      // On Web we can check navigator.bluetooth.getAvailability()
      try {
        if (typeof navigator !== 'undefined' && 'bluetooth' in navigator && typeof (navigator as any).bluetooth.getAvailability === 'function') {
          const avail = await (navigator as any).bluetooth.getAvailability();
          // if bluetooth is not available/disabled, notify the user once
          if (!avail && !hasNotifiedBluetoothOffRef.current) {
            // small user-friendly alert
            alert('Bluetooth appears to be turned off — please enable Bluetooth and try again.');
            hasNotifiedBluetoothOffRef.current = true;
          } else if (avail && hasNotifiedBluetoothOffRef.current) {
            // Bluetooth became available again; reset flag
            hasNotifiedBluetoothOffRef.current = false;
          }
        }
      } catch (e) {
        // ignore availability check errors
      }
    };

    // initial check + interval
    check();
    const id = setInterval(check, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [onConnectionChange]);

  const handleConnect = useCallback(async (deviceName?: string) => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const ok = await bluetoothService.connectToDevice(deviceName);
      setIsConnected(ok);
      if (ok && deviceName) {
        setRecentDevices(prev => [deviceName, ...prev.filter(d => d !== deviceName)].slice(0, 5));
      }
      onConnectionChange?.(ok);
      setIsMenuOpen(false);
    } catch (err) {
      console.error('Bluetooth connection failed:', err);
      setIsConnected(false);
      onConnectionChange?.(false);
      alert('Failed to connect to device.');
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, onConnectionChange]);

  const handleDisconnect = useCallback(async () => {
    await bluetoothService.disconnect();
    setIsConnected(false);
    onConnectionChange?.(false);
    setIsMenuOpen(false);
  }, [onConnectionChange]);

  return (
    <div className="absolute top-4 right-4 z-50">
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className={`
          w-12 h-12 rounded-full shadow-lg transition-all duration-300
          flex items-center justify-center
          ${isConnected ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-white hover:bg-gray-100 text-gray-600'}
        `}
        aria-label="Bluetooth connector"
      >
        {isConnected ? <BluetoothConnected className="w-6 h-6" /> : <Bluetooth className="w-6 h-6" />}
      </button>

      {isMenuOpen && (
        <div className="absolute top-14 right-0 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
          <div className="px-4 py-2 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Bluetooth Devices</h3>
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
                <p className="text-sm text-gray-600 mb-2">Recent Devices:</p>
                {recentDevices.length === 0 && <div className="text-sm text-gray-500">No recent devices</div>}
                {recentDevices.map((device, index) => (
                  <button
                    key={index}
                    onClick={() => handleConnect(device)}
                    disabled={isScanning}
                    className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 text-sm text-gray-700 disabled:opacity-50"
                  >
                    {device}
                  </button>
                ))}
              </div>

              {/* per request: remove the 'Scan for New Devices' button and instead keep status static */}
              <div className="border-t border-gray-100 pt-2 px-4">
                <div className="text-sm text-blue-600">
                  {isScanning ? 'Scanning...' : 'Auto-refreshing device status'}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
