import React, { useEffect, useState, useCallback } from 'react';
import { Bluetooth, BluetoothConnected } from 'lucide-react';
import bluetoothService from '../utils/bluetoothService';

interface BluetoothConnectorProps {
  onConnectionChange?: (connected: boolean) => void;
}

export const BluetoothConnector: React.FC<BluetoothConnectorProps> = ({ onConnectionChange }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [recentDevices, setRecentDevices] = useState<string[]>([]);

  useEffect(() => {
    // Try to warm up BLE client and request platform permission if possible
    (async () => {
      try {
        await bluetoothService.ensurePermissions();
      } catch (e) {
        console.warn('ensurePermissions failed', e);
      }
    })();

    // poll connection state once
    (async () => {
      try {
        const conn = await bluetoothService.isConnected();
        setIsConnected(conn);
        onConnectionChange?.(conn);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_) { /* empty */ }
    })();
  }, [onConnectionChange]);

  const handleConnect = useCallback(async (deviceName?: string) => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const ok = await bluetoothService.connectToDevice(deviceName);
      setIsConnected(ok);
      if (ok) {
        setRecentDevices(prev => deviceName ? [deviceName, ...prev.filter(d => d !== deviceName)].slice(0,5) : prev);
      }
      onConnectionChange?.(ok);
      setIsMenuOpen(false);
    } catch (err) {
      console.error('Bluetooth connection failed:', err);
      setIsConnected(false);
      onConnectionChange?.(false);
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

              <div className="border-t border-gray-100 pt-2">
                <button
                  onClick={() => handleConnect()}
                  disabled={isScanning}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 text-blue-600 disabled:opacity-50"
                >
                  {isScanning ? 'Scanning...' : 'Scan for New Devices'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
