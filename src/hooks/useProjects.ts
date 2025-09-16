// src/hooks/useProjects.ts
import { useCallback, useState } from 'react';

export default function useProjects(initialProject: string = 'elevator') {
  const [selectVisible, setSelectVisible] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>(initialProject);

  // animation timing (ms)
  const ITEM_STAGGER = 80;
  const BASE_DURATION = 220;
  const ITEM_DURATION = 180;
  const totalCloseDelay = BASE_DURATION + ITEM_STAGGER * 2 + 40;

  const openSelectPopup = useCallback(() => {
    setSelectVisible(true);
    requestAnimationFrame(() => setSelectOpen(true));
  }, []);

  const closeSelectPopup = useCallback(() => {
    setSelectOpen(false);
    setTimeout(() => setSelectVisible(false), totalCloseDelay);
  }, [totalCloseDelay]);

  const handleProjectSelect = useCallback((proj: string) => {
    setSelectedProject(proj);
    closeSelectPopup();
  }, [closeSelectPopup]);

  return {
    selectVisible,
    selectOpen,
    selectedProject,
    openSelectPopup,
    closeSelectPopup,
    handleProjectSelect,
    ITEM_STAGGER,
    BASE_DURATION,
    ITEM_DURATION,
  } as const;
}
