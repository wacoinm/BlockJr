// src/store/slices/projectsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ProjectsState {
  projects: string[];
  selectedProject: string | null;
  selectVisible: boolean;
  selectOpen: boolean;
}

const initialState: ProjectsState = {
  projects: ['elevator', 'bulldozer', 'lift truck'],
  selectedProject: 'elevator',
  selectVisible: false,
  selectOpen: false,
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setProjects(state, action: PayloadAction<string[]>) {
      state.projects = action.payload;
    },
    selectProject(state, action: PayloadAction<string>) {
      state.selectedProject = action.payload;
    },
    setSelectVisible(state, action: PayloadAction<boolean>) {
      state.selectVisible = action.payload;
    },
    setSelectOpen(state, action: PayloadAction<boolean>) {
      state.selectOpen = action.payload;
    },
  },
});

export const { setProjects, selectProject, setSelectVisible, setSelectOpen } = projectsSlice.actions;
export default projectsSlice.reducer;
