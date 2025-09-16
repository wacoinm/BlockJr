import React from 'react';
import { X, FolderKanban } from 'lucide-react';
import Kamaan from '../../public/icon.svg?react';
import KamaanLight from '../../public/icon-light.svg?react';

export type FabItem = {
  key: string;
  onClick: () => void;
  content: React.ReactNode;
};

interface WorkspaceControlsProps {
  // top-right menu / FAB
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  fabItems: FabItem[];

  // project select popup
  selectVisible: boolean;
  selectOpen: boolean;
  closeSelectPopup: () => void;
  projects: string[];
  selectedProject: string | null;
  handleProjectSelect: (proj: string) => void;

  // animation timing values used for the popup
  ITEM_STAGGER: number;
  BASE_DURATION: number;
  ITEM_DURATION: number;

  // bottom-right debug
  viewportWidth: number;
  zoom: number;
  panX: number;
  panY: number;
  unitLabel: string;

  // theme (used to pick icon)
  theme: 'system' | 'light' | 'dark';
}

const WorkspaceControls: React.FC<WorkspaceControlsProps> = ({
  menuOpen,
  setMenuOpen,
  fabItems,
  selectVisible,
  selectOpen,
  closeSelectPopup,
  projects,
  selectedProject,
  handleProjectSelect,
  ITEM_STAGGER,
  BASE_DURATION,
  ITEM_DURATION,
  viewportWidth,
  zoom,
  panX,
  panY,
  unitLabel,
  theme,
}) => {
  return (
    <>
      {/* Hamburger + animated FABs */}
      <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-3">
        {/* Hamburger (rounded) */}
        <button
          type="button"
          onClick={() => setMenuOpen((p) => !p)}
          className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-100 transition-transform duration-200 hover:scale-105"
          aria-label="Open menu"
        >
          <div className="relative w-6 h-6">
            {theme === 'dark' ? (
              <Kamaan
                className={`absolute inset-0 w-6 h-6 scale-[200%] transform transition-all duration-300 ${
                  menuOpen ? 'scale-0 rotate-90 opacity-0' : 'scale-100 opacity-100'
                }`}
                aria-hidden
              />
            ) : (
              <KamaanLight
                className={`absolute inset-0 w-6 h-6 scale-[200%] transform transition-all duration-300 ${
                  menuOpen ? 'scale-0 rotate-90 opacity-0' : 'scale-100 opacity-100'
                }`}
                aria-hidden
              />
            )}

            <X
              className={`absolute inset-0 w-6 h-6 transform transition-all duration-300 ${
                menuOpen ? 'scale-100 rotate-90 opacity-100' : 'scale-0 opacity-0'
              }`}
              aria-hidden
            />
          </div>
        </button>

        {/* Floating Action Buttons */}
        {fabItems.map((f, idx) => {
          const delay = idx * 80;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => f.onClick()}
              style={{ transitionDelay: `${delay}ms` }}
              className={`
                w-12 h-12 rounded-full shadow-lg flex items-center justify-center
                transform transition-all duration-300
                ${
                  menuOpen
                    ? 'scale-100 opacity-100 translate-y-0'
                    : 'scale-75 opacity-0 -translate-y-2 pointer-events-none'
                }
                bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-700
              `}
              aria-label={f.key === 'unit' ? `Unit: ${unitLabel}` : f.key}
              title={f.key === 'unit' ? `Unit: ${unitLabel} (click to cycle)` : undefined}
            >
              {f.content}
            </button>
          );
        })}
      </div>

      {/* Select project popup */}
      {selectVisible && (
        <div
          className="fixed inset-0 z-[88] pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSelectPopup();
          }}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black transition-opacity"
            style={{
              zIndex: 88,
              transitionDuration: `${BASE_DURATION}ms`,
              opacity: selectOpen ? 0.36 : 0,
            }}
          />

          <div
            className="absolute right-6 top-20"
            style={{ zIndex: 90 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="relative w-64 rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-4 transform origin-top-right"
              style={{
                transitionProperty: 'transform, opacity',
                transitionDuration: `${BASE_DURATION}ms`,
                transform: selectOpen ? 'translateY(0px) scale(1)' : 'translateY(6px) scale(0.96)',
                opacity: selectOpen ? 1 : 0,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-1 items-center">
                  <FolderKanban className="w-5 h-5" />
                  <div className="text-sm font-semibold">Projects</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSelectPopup();
                  }}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700"
                  aria-label="Close select project"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {projects.map((p, i) => {
                  const openDelay = i * ITEM_STAGGER;
                  const closeDelay = (projects.length - 1 - i) * ITEM_STAGGER;
                  const delay = selectOpen ? openDelay : closeDelay;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleProjectSelect(p)}
                      className="w-full text-left px-3 py-2 rounded-lg transform transition-all"
                      style={{
                        transitionProperty: 'transform, opacity',
                        transitionDuration: `${ITEM_DURATION}ms`,
                        transitionDelay: `${delay}ms`,
                        transform: selectOpen ? 'translateY(0px) scale(1)' : 'translateY(-6px) scale(0.96)',
                        opacity: selectOpen ? 1 : 0,
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="text-sm capitalize">{p}</div>
                      {selectedProject === p && (
                        <div className="text-xs text-slate-500">Selected</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* bottom-right debug panel */}
      <div className="fixed right-4 bottom-4 text-xs text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 px-3 py-2 rounded-md shadow-sm z-60">
        <div>vw: {viewportWidth}px</div>
        <div>zoom: {zoom.toFixed(2)}</div>
        <div>
          pan: {Math.round(panX)}, {Math.round(panY)}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          project: {selectedProject ?? 'none'}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          unit: {unitLabel}
        </div>
      </div>
    </>
  );
};

export default WorkspaceControls;
