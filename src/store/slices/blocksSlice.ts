// src/store/slices/blocksSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Block } from '../../types/Block';

interface BlocksState {
  blocks: Block[];
  selectedBlockId?: string | null;
}

const initialState: BlocksState = {
  blocks: [],
  selectedBlockId: null,
};

const blocksSlice = createSlice({
  name: 'blocks',
  initialState,
  reducers: {
    setBlocks(state, action: PayloadAction<Block[]>) {
      state.blocks = action.payload;
    },
    addBlock(state, action: PayloadAction<Block>) {
      state.blocks.push(action.payload);
    },
    updateBlock(state, action: PayloadAction<Block>) {
      const idx = state.blocks.findIndex(b => b.id === action.payload.id);
      if (idx >= 0) state.blocks[idx] = action.payload;
    },
    removeBlock(state, action: PayloadAction<string>) {
      state.blocks = state.blocks.filter(b => b.id !== action.payload);
      if (state.selectedBlockId === action.payload) state.selectedBlockId = null;
    },
    selectBlock(state, action: PayloadAction<string | null>) {
      state.selectedBlockId = action.payload;
    },
    clearBlocks(state) {
      state.blocks = [];
      state.selectedBlockId = null;
    },
  },
});

export const {
  setBlocks,
  addBlock,
  updateBlock,
  removeBlock,
  selectBlock,
  clearBlocks,
} = blocksSlice.actions;

export default blocksSlice.reducer;
