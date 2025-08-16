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
  const [nearbyDevices, setNearbyDevices] = useState<DeviceItem[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isNative = Capacitor.getPlatform() !== 'web';

  /**
   * Adds a device to the list of nearby devices, or updates its info if already present.
   */
  const addOrUpdateDevice = useCallback((device: DeviceItem) => {
    setNearbyDevices(prev => {
      const existing = prev.find(d => d.id === device.id);
      if (existing) {
        return prev.map(d => d.id === device.id ? { ...d, ...device } : d);
      }
      return [...prev, device].slice(-20); // Keep the list from growing too large
    });
  }, []);

  /**
   * Starts scanning for devices on native platforms.
   */
  const startScanning = useCallback(async () => {
    if (isNative) {
        try {
            await bluetoothService.startScan(addOrUpdateDevice);
        } catch (e) {
            console.error("Failed to start scan", e);
            setStatusMessage("Could not start scanning for devices.");
        }
    }
    // On web, scanning is initiated by the user via the connect button.
  }, [isNative, addOrUpdateDevice]);


  /**
   * Initializes Bluetooth on component mount.
   */
  useEffect(() => {
    const init = async () => {
        try {
            await bluetoothService.initialize();
            if (isNative) {
                const enabled = await BleClient.isEnabled();
                if (!enabled) {
                    setStatusMessage("Bluetooth is off. Please enable it.");
                    return;
                }
                startScanning();
            }
        } catch (e) {
            console.error("Bluetooth initialization failed", e);
            setStatusMessage("Bluetooth permissions are required.");
        }
    };
    init();

    return () => {
        if (isNative) {
            bluetoothService.stopScan();
        }
    };
  }, [isNative, startScanning]);

  /**
   * Callback for when a device disconnects.
   */
  const handleDisconnectCallback = useCallback((deviceId: string) => {
    setIsConnected(false);
    onConnectionChange?.(false);
    setStatusMessage(`Device ${deviceId} disconnected.`);
  }, [onConnectionChange]);

  /**
   * Handles connecting to a device on native platforms.
   */
  const handleConnect = useCallback(async (deviceId: string) => {
    if (isBusy) return;
    setIsBusy(true);
    setStatusMessage(`Connecting to ${deviceId}...`);
    await bluetoothService.stopScan();

    const ok = await bluetoothService.connect(deviceId, handleDisconnectCallback);
    if (ok) {
        setIsConnected(true);
        onConnectionChange?.(true);
        setStatusMessage(`Connected to ${deviceId}`);
        setIsMenuOpen(false);
    } else {
        setStatusMessage(`Failed to connect to ${deviceId}.`);
        if (isNative) startScanning(); // Resume scanning on failure
    }
    setIsBusy(false);
  }, [isBusy, onConnectionChange, handleDisconnectCallback, isNative, startScanning]);

  /**
   * Handles connecting to a device on the web.
   */
  const handleWebConnect = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    setStatusMessage('Opening device picker...');

    const ok = await bluetoothService.requestAndConnectDeviceWeb(handleDisconnectCallback);
     if (ok) {
        setIsConnected(true);
        onConnectionChange?.(true);
        setStatusMessage(`Connected.`);
        setIsMenuOpen(false);
    } else {
        setStatusMessage('Connection cancelled or failed.');
    }
    setIsBusy(false);
  }, [isBusy, onConnectionChange, handleDisconnectCallback]);


  /**
   * Handles disconnecting from the current device.
   */
  const handleDisconnect = useCallback(async () => {
    await bluetoothService.disconnect();
    setIsConnected(false);
    onConnectionChange?.(false);
    setStatusMessage('Disconnected.');
    if (isNative) startScanning();
  }, [onConnectionChange, isNative, startScanning]);

  /**
   * Opens the relevant system settings on native platforms.
   */
  const handleOpenSettings = useCallback(async () => {
    if (!isNative) return;
    try {
        if (statusMessage?.includes('Bluetooth is off')) {
            await BleClient.openBluetoothSettings();
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
        disabled={isBusy}
      >
        {isBusy && (
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
        <span className={isBusy ? 'opacity-0' : 'opacity-100'}>
          {isConnected ? <BluetoothConnected className="w-6 h-6" /> : <Bluetooth className="w-6 h-6" />}
        </span>
      </button>

      {isMenuOpen && (
        <div className="absolute top-14 right-0 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
          <div className="px-4 py-2 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Bluetooth</h3>
          </div>

          {statusMessage && (
            <div className="px-4 py-2 text-sm text-red-600 border-b border-gray-100">
              {statusMessage}
              {isNative && (
                <button onClick={handleOpenSettings} className="ml-2 text-blue-600 underline">
                  Settings
                </button>
              )}
            </div>
          )}

          {isConnected ? (
            <button onClick={handleDisconnect} className="w-full px-4 py-2 text-left hover:bg-gray-50 text-red-600">
              Disconnect
            </button>
          ) : (
            <>
              {isNative ? (
                <div className="px-4 py-2">
                  <p className="text-sm text-gray-600 mb-2">Nearby Devices:</p>
                  {nearbyDevices.length === 0 && <div className="text-sm text-gray-500">Scanning...</div>}
                  {nearbyDevices.map((device) => (
                    <button
                      key={device.id}
                      onClick={() => handleConnect(device.id)}
                      disabled={isBusy}
                      className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 text-sm text-gray-700 disabled:opacity-50"
                    >
                      {device.name ?? device.id} {device.rssi ? `(${device.rssi}dBm)` : ''}
                    </button>
                  ))}
                </div>
              ) : (
                 <div className="p-4">
                    <button
                      onClick={handleWebConnect}
                      disabled={isBusy}
                      className="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm disabled:opacity-50 hover:bg-blue-600"
                    >
                      {isBusy ? 'Connecting...' : 'Connect to a Device'}
                    </button>
                 </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BluetoothConnector;
