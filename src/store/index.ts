// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import blocksReducer from './slices/blocksSlice';
import uiReducer from './slices/uiSlice';
import projectsReducer from './slices/projectsSlice';
import historyReducer from './slices/historySlice';
import panZoomReducer from './slices/panZoomSlice';
import bluetoothReducer from './slices/bluetoothSlice';
import interactionReducer from './slices/interactionSlice';

export const store = configureStore({
  reducer: {
    blocks: blocksReducer,
    ui: uiReducer,
    projects: projectsReducer,
    history: historyReducer,
    panZoom: panZoomReducer,
    bluetooth: bluetoothReducer,
    interaction: interactionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
