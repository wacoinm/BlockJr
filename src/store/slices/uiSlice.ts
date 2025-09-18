// src/store/slices/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  theme: 'light' | 'dark';
  isBluetoothConnected: boolean;
  zoom: number;
}

const initialState: UIState = {
  theme: 'light',
  isBluetoothConnected: false,
  zoom: 1,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<'light' | 'dark'>) {
      state.theme = action.payload;
    },
    setBluetoothConnected(state, action: PayloadAction<boolean>) {
      state.isBluetoothConnected = action.payload;
    },
    setZoom(state, action: PayloadAction<number>) {
      state.zoom = action.payload;
    },
  },
});

export const { setTheme, setBluetoothConnected, setZoom } = uiSlice.actions;
export default uiSlice.reducer;
