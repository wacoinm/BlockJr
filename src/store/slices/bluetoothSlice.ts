// src/store/slices/bluetoothSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface BluetoothState {
  connected: boolean;
  deviceName?: string | null;
}

const initialState: BluetoothState = { connected: false, deviceName: null };

const bluetoothSlice = createSlice({
  name: 'bluetooth',
  initialState,
  reducers: {
    setConnected(state, action: PayloadAction<boolean>) {
      state.connected = action.payload;
    },
    setDeviceName(state, action: PayloadAction<string | null>) {
      state.deviceName = action.payload;
    },
  },
});

export const { setConnected, setDeviceName } = bluetoothSlice.actions;
export default bluetoothSlice.reducer;
