// src/store/slices/interactionSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type InteractionMode = 'runner' | 'deleter';

interface InteractionState {
  mode: InteractionMode;
  bluetoothOpen: boolean;
  menuOpen: boolean;
}

const initialState: InteractionState = {
  mode: 'runner',
  bluetoothOpen: false,
  menuOpen: false,
};

const interactionSlice = createSlice({
  name: 'interaction',
  initialState,
  reducers: {
    setMode(state, action: PayloadAction<InteractionMode>) {
      state.mode = action.payload;
    },
    toggleMode(state) {
      state.mode = state.mode === 'runner' ? 'deleter' : 'runner';
    },
    setBluetoothOpen(state, action: PayloadAction<boolean>) {
      state.bluetoothOpen = action.payload;
    },
    setMenuOpen(state, action: PayloadAction<boolean>) {
      state.menuOpen = action.payload;
    },
  },
});

export const { setMode, toggleMode, setBluetoothOpen, setMenuOpen } = interactionSlice.actions;
export default interactionSlice.reducer;
