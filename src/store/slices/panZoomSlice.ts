// src/store/slices/panZoomSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Pan {
  x: number;
  y: number;
}

interface PanZoomState {
  pan: Pan;
  zoom: number;
}

const initialState: PanZoomState = {
  pan: { x: 0, y: 0 },
  zoom: 1,
};

const panZoomSlice = createSlice({
  name: 'panZoom',
  initialState,
  reducers: {
    setPan(state, action: PayloadAction<Pan>) {
      state.pan = action.payload;
    },
    panBy(state, action: PayloadAction<Pan>) {
      state.pan = { x: state.pan.x + action.payload.x, y: state.pan.y + action.payload.y };
    },
    setZoom(state, action: PayloadAction<number>) {
      state.zoom = action.payload;
    },
    zoomBy(state, action: PayloadAction<number>) {
      state.zoom = state.zoom * action.payload;
    },
  },
});

export const { setPan, panBy, setZoom, zoomBy } = panZoomSlice.actions;
export default panZoomSlice.reducer;
