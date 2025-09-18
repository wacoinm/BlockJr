// src/store/slices/historySlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Block } from '../../../types/Block';

interface HistoryState {
  snapshots: Block[][];
  index: number; // points at current snapshot
  maxSnapshots: number;
}

const initialState: HistoryState = {
  snapshots: [],
  index: -1,
  maxSnapshots: 200,
};

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    capture(state, action: PayloadAction<Block[]>) {
      // discard anything after current index (standard undo behavior)
      if (state.index < state.snapshots.length - 1) {
        state.snapshots = state.snapshots.slice(0, state.index + 1);
      }
      state.snapshots.push(action.payload.map(b => ({ ...b })));
      state.index = state.snapshots.length - 1;
      // truncate too-old history
      if (state.snapshots.length > state.maxSnapshots) {
        state.snapshots.shift();
        state.index = state.snapshots.length - 1;
      }
    },
    undo(state) {
      if (state.index > 0) state.index -= 1;
    },
    redo(state) {
      if (state.index < state.snapshots.length - 1) state.index += 1;
    },
    clearHistory(state) {
      state.snapshots = [];
      state.index = -1;
    },
    setMaxSnapshots(state, action: PayloadAction<number>) {
      state.maxSnapshots = action.payload;
    },
    setIndex(state, action: PayloadAction<number>) {
      const i = action.payload;
      if (i >= -1 && i < state.snapshots.length) state.index = i;
    },
  },
});

export const { capture, undo, redo, clearHistory, setMaxSnapshots, setIndex } = historySlice.actions;
export default historySlice.reducer;
