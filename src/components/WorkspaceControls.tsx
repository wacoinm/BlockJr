import React from 'react';
import { X, FolderKanban } from 'lucide-react';
import Kamaan from '../../public/icon.svg?react';
import KamaanLight from '../../public/icon-light.svg?react';

import { useAppSelector, useAppDispatch } from '../store/hooks';
import {
  setMenuOpen as setMenuOpenAction,
  toggleMode as toggleModeAction,
} from '../store/slices/interactionSlice';
import {
  setSelectVisible as setSelectVisibleAction,
  setSelectOpen as setSelectOpenAction,
  selectProject as selectProjectAction,
} from '../store/slices/projectsSlice';
import useUnits from '../hooks/useUnits';

export type FabItem = {
  key: string;
  onClick: () => void;
  content: React.ReactNode;
  title?: string;
};

interface WorkspaceControlsProps {
  // top-right menu / FAB (still supported as props for gradual migration)
  menuOpen?: boolean;
  setMenuOpen?: (open: boolean) => void;
  fabItems?: FabItem[];

  // project select popup
  selectVisible?: boolean;
  selectOpen?: boolean;
  closeSelectPopup?: () => void;
  projects?: string[];
  selectedProject?: string | null;
  handleProjectSelect?: (proj: string) => void;

  // animation timing values used for the popup
  ITEM_STAGGER?: number;
  BASE_DURATION?: number;
  ITEM_DURATION?: number;

  // bottom-right debug
  viewportWidth?: number;
  zoom?: number;
  panX?: number;
  panY?: number;
  unitLabel?: string;

  // theme (used to pick icon)
  theme?: 'system' | 'light' | 'dark';
}

const WorkspaceControls: React.FC<WorkspaceControlsProps> = (props) => {
  const dispatch = useAppDispatch();

  // ---- call hooks unconditionally (fixes rules-of-hooks) ----
  const reduxMenuOpen = useAppSelector((s) => s.interaction.menuOpen);
  const reduxSelectVisible = useAppSelector((s) => s.projects.selectVisible);
  const reduxSelectOpen = useAppSelector((s) => s.projects.selectOpen);
  const reduxProjects = useAppSelector((s) => s.projects.projects);
  const reduxSelectedProject = useAppSelector((s) => s.projects.selectedProject);
  const reduxZoom = useAppSelector((s) => s.panZoom.zoom);
  const reduxPan = useAppSelector((s) => s.panZoom.pan);
  const reduxUi = useAppSelector((s) => s.ui); // may be undefined if ui slice not present

  // call hook unconditionally
  const hookUnits = useUnits();

  // ---- derive final values (hooks called already) ----
  const menuOpen = typeof props.menuOpen === 'boolean' ? props.menuOpen : reduxMenuOpen;
  const setMenuOpen = props.setMenuOpen ?? ((open: boolean) => dispatch(setMenuOpenAction(open)));

  const selectVisible = typeof props.selectVisible === 'boolean' ? props.selectVisible : reduxSelectVisible;
  const selectOpen = typeof props.selectOpen === 'boolean' ? props.selectOpen : reduxSelectOpen;
  const projects = props.projects ?? reduxProjects;
  const selectedProject = props.selectedProject ?? reduxSelectedProject;
  const handleProjectSelect = props.handleProjectSelect ?? ((p: string) => dispatch(selectProjectAction(p)));

  const ITEM_STAGGER = props.ITEM_STAGGER ?? 40;
  const BASE_DURATION = props.BASE_DURATION ?? 180;
  const ITEM_DURATION = props.ITEM_DURATION ?? 220;

  const viewportWidth = props.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  const zoom = props.zoom ?? reduxZoom;
  const panX = props.panX ?? reduxPan.x;
  const panY = props.panY ?? reduxPan.y;

  const unitLabel = props.unitLabel ?? hookUnits.unitLabel;
  const cycleUnit = hookUnits.cycleUnit;

  const theme = props.theme ?? (reduxUi ? reduxUi.theme : 'system');

  // fabItems: if parent passed custom ones, use them. Otherwise provide reasonable defaults
  const defaultFabItems: FabItem[] = [
    {
      key: 'bluetooth',
      onClick: () => dispatch(setMenuOpenAction(!menuOpen)),
      content: <div className="w-6 h-6">🔵</div>,
      title: 'بلوتوث',
    },
    {
      key: 'theme',
      onClick: () => dispatch(toggleModeAction()), // placeholder - replace with setTheme if you add ui thunks
      content:
        theme === 'system' ? (
          <div className="w-6 h-6">🖥️</div>
        ) : theme === 'light' ? (
          <div className="w-6 h-6">☀️</div>
        ) : (
          <div className="w-6 h-6">🌙</div>
        ),
      title: 'حالت شب/روز',
    },
    // {
    //   key: 'selectProject',
    //   onClick: () => {
    //     if (!selectVisible) dispatch(setSelectVisibleAction(true));
    //     dispatch(setSelectOpenAction(!selectOpen));
    //   },
    //   content: <div className="w-6 h-6">📁</div>,
    //   title: 'پروژه',
    // },
    {
      key: 'unit',
      onClick: cycleUnit,
      content: <div className="text-xs font-semibold select-none pointer-events-none">{unitLabel}</div>,
      title: 'واحد',
    },
  ];

  const fabItems = props.fabItems ?? defaultFabItems;

  return (
    <>
      {/* Hamburger + animated FABs */}
      <div className="absolute [top:calc(1rem+var(--safe-area-inset-top))] right-4 z-50 flex flex-col items-end gap-3">
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

        {/* Label animation CSS (inline for easy testing) */}
        <style>{`
          /* Container for each fab + label */
          .fab-wrapper { position: relative; display: flex; align-items: center; }

          /* Label itself - starts over FAB and expands to the left */
          .fab-label {
            position: absolute;
            right: calc(100% + 12px); /* final resting position: to the left of the fab */
            top: 50%;
            transform: translateY(-50%) translateX(12px); /* start slightly over the fab */
            opacity: 0;
            padding: 8px 12px;
            min-width: 54px;
            white-space: nowrap;
            border-radius: 999px; /* start circular to suggest it's coming from the FAB */
            font-size: 13px;
            line-height: 1;
            box-shadow: 0 6px 18px rgba(2,6,23,0.12);
            background: rgba(255,255,255,0.95);
            color: #0f172a;
            border: 1px solid rgba(2,6,23,0.06);
            pointer-events: none;
            transform-origin: right center;
            will-change: transform, opacity, border-radius;
          }

          .dark .fab-label {
            background: rgba(10,16,24,0.85);
            color: #e6eef8;
            border-color: rgba(255,255,255,0.04);
          }

          /* Entrance: slide left from over the FAB, overshoot (bounce), settle */
          @keyframes fab-label-in {
            0% {
              transform: translateY(-50%) translateX(12px) scale(0.92);
              opacity: 0;
              border-radius: 999px;
            }
            60% {
              transform: translateY(-50%) translateX(-14px) scale(1.06);
              opacity: 1;
              border-radius: 16px;
            }
            80% {
              transform: translateY(-50%) translateX(-6px) scale(0.98);
            }
            100% {
              transform: translateY(-50%) translateX(0) scale(1);
              opacity: 1;
              border-radius: 12px;
            }
          }

          /* Exit: fade & retract slightly back to FAB */
          @keyframes fab-label-out {
            0% {
              transform: translateY(-50%) translateX(0) scale(1);
              opacity: 1;
              border-radius: 12px;
            }
            60% {
              transform: translateY(-50%) translateX(8px) scale(0.96);
              opacity: 0.6;
              border-radius: 999px;
            }
            100% {
              transform: translateY(-50%) translateX(12px) scale(0.92);
              opacity: 0;
              border-radius: 999px;
            }
          }

          .fab-label.show {
            animation: fab-label-in 420ms cubic-bezier(.2,1.2,.2,1) forwards;
          }
          .fab-label.hide {
            animation: fab-label-out 220ms cubic-bezier(.4,0,.2,1) forwards;
          }
        `}</style>

        {/* Floating Action Buttons with animated Persian labels */}
        {fabItems.map((f, idx) => {
          const delay = idx * ITEM_STAGGER;
          return (
            <div key={f.key} className="fab-wrapper" style={{ transitionDelay: `${delay}ms` }}>
              {/* Label: shown only if title exists */}
              {f.title ? (
                <div
                  aria-hidden
                  className={`fab-label ${menuOpen ? 'show' : 'hide'}`}
                  // stagger label a bit after the fab's own appearance
                  style={{ animationDelay: `${menuOpen ? delay + 80 : 0}ms` }}
                  dir="rtl"
                >
                  <span className="select-none text-sm font-medium font-[Vazirmatn]">{f.title}</span>
                </div>
              ) : null}

              {/* Actual FAB button */}
              <button
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
            </div>
          );
        })}
      </div>

      {/* Select project popup */}
      {selectVisible && (
        <div
          className="fixed inset-0 z-[88] pointer-events-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (props.closeSelectPopup) props.closeSelectPopup();
              else dispatch(setSelectVisibleAction(false));
            }
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
                    if (props.closeSelectPopup) props.closeSelectPopup();
                    else {
                      dispatch(setSelectOpenAction(false));
                      dispatch(setSelectVisibleAction(false));
                    }
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
                      onClick={() => {
                        handleProjectSelect(p);
                        if (props.closeSelectPopup) props.closeSelectPopup();
                        else {
                          dispatch(setSelectOpenAction(false));
                          dispatch(setSelectVisibleAction(false));
                        }
                      }}
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
                      {selectedProject === p && <div className="text-xs text-slate-500">Selected</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* bottom-right debug panel */}
      <div className="fixed right-4 [bottom:calc(1rem+var(--safe-area-inset-bottom))] text-xs text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-900/80 px-3 py-2 rounded-md shadow-sm z-60">
        <div>vw: {viewportWidth}px</div>
        <div>zoom: {zoom.toFixed(2)}</div>
        <div>
          pan: {Math.round(panX)}, {Math.round(panY)}
        </div>
        <div className="mt-1 text-xs text-slate-500">project: {selectedProject ?? 'none'}</div>
        <div className="mt-1 text-xs text-slate-500">unit: {unitLabel}</div>
      </div>
    </>
  );
};

export default WorkspaceControls;
