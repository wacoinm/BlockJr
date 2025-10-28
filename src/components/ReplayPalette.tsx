import React, { useCallback } from 'react';
import { Play, ListChecks } from 'lucide-react';
import { useDialogue } from 'dialogue-story';
import { useAppSelector } from '../store/hooks';
import type { RootState } from '../store';
import { getTaskListForProject } from '../utils/manifest';
import type { TaskItem } from '../utils/manifest';

type ReplayPaletteProps = {
  onReplayTasks: () => void;
  blockPaletteBottom?: number;
  setShowTaskList: (show: boolean) => void;
  setActiveTaskList: (tasks: TaskItem[] | null) => void;
};

export const ReplayPalette: React.FC<ReplayPaletteProps> = ({
  onReplayTasks,
  blockPaletteBottom,
  setShowTaskList,
  setActiveTaskList
}) => {
  const { dialogue } = useDialogue();
  const selectedProject = useAppSelector((s: RootState) => s.projects?.selectedProject);
  const currentChapter = useAppSelector((s: RootState) => s.story?.currentChapter);
  const dialogueMessages = useAppSelector((s: RootState) => 
    currentChapter && s.story?.messages?.[currentChapter]
  );

  const handleReplayDialogue = useCallback(async () => {
    if (dialogueMessages && currentChapter) {
      try {
        await dialogue(dialogueMessages);
      } catch (err) {
        console.warn('ReplayDialogue failed:', err);
      }
    }
  }, [dialogue, dialogueMessages, currentChapter]);

  return (
    <div 
      style={{ bottom: blockPaletteBottom ? blockPaletteBottom + 80 : 80 }}
      className="fixed right-4 z-50 flex flex-col gap-2
                bg-white dark:bg-slate-800 rounded-2xl shadow-lg 
                border border-gray-200 dark:border-slate-700
                p-2 w-14"
    >
      <button
        onClick={handleReplayDialogue}
        disabled={!dialogueMessages}
        className="w-10 h-10 rounded-xl flex items-center justify-center
                   bg-slate-100 dark:bg-slate-700/50 
                   hover:bg-slate-200 dark:hover:bg-slate-700
                   transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
        title="پخش مجدد دیالوگ"
      >
        <Play className="w-5 h-5 text-slate-700 dark:text-slate-300" />
      </button>
      
      <button
        onClick={() => {
          if (!selectedProject || !currentChapter) return;
          const taskList = getTaskListForProject(selectedProject, currentChapter);
          if (taskList && taskList.tasks && taskList.tasks.length > 0) {
            setActiveTaskList(taskList.tasks);
            setShowTaskList(true);
          }
          onReplayTasks();
        }}
        disabled={!selectedProject || !currentChapter}
        className="w-10 h-10 rounded-xl flex items-center justify-center
                   bg-slate-100 dark:bg-slate-700/50
                   hover:bg-slate-200 dark:hover:bg-slate-700
                   transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
        title="پخش مجدد تسک‌ها"
      >
        <ListChecks className="w-5 h-5 text-slate-700 dark:text-slate-300" />
      </button>
    </div>
  );
};