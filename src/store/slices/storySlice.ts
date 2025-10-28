import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface StoryState {
  currentChapter?: string | null;
  messages: Record<string, any[]>;
}

const initialState: StoryState = {
  currentChapter: null,
  messages: {},
};

const storySlice = createSlice({
  name: 'story',
  initialState,
  reducers: {
    setCurrentChapter: (state, action: PayloadAction<string | null>) => {
      state.currentChapter = action.payload;
    },
    setMessages: (state, action: PayloadAction<{ chapter: string; messages: any[] }>) => {
      state.messages[action.payload.chapter] = action.payload.messages;
    },
  },
});

export const { setCurrentChapter, setMessages } = storySlice.actions;
export default storySlice.reducer;