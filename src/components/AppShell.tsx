// src/components/AppShell.tsx
import React from "react";
import { Block } from "../types/Block";
import { BluetoothConnector } from "./BluetoothConnector";
import WorkspaceControls from "./WorkspaceControls";
import { Workspace } from "./Workspace";
import { BlockPalette } from "./BlockPalette";
import { useAppSelector } from "../store/hooks";
import type { RootState } from "../store";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import GamepadPng from "../assets/images/gamepad.png"; // <-- your PNG (you said you'll add this)
import BatteryGauge from "./BatteryGauge";

export type FabItem = {
  key: string;
  onClick: () => void;
  content: React.ReactNode;
};

export type PointerEventLike =
  | React.MouseEvent
  | React.PointerEvent
  | React.TouchEvent;

export type OnBlockDragStart = (
  block: Block,
  e: PointerEventLike
) => Block | void;

export type AppShellProps = {
  blocks: Block[];
  isDragging: boolean;
  draggedBlockId?: string;
  viewportWidth: number;

  // pan/zoom
  panX: number;
  panY: number;
  zoom: number;
  onPan: (dx: number, dy: number) => void;
  onZoom: (factor: number, cx?: number, cy?: number) => void;

  // handlers
  onGreenFlagClick: (blockId: string) => Promise<void> | void;
  onDelayChange: (blockId: string, value: number) => void;
  onBlockRemove: (blockId: string) => void;
  onBlockDragStart: OnBlockDragStart;

  // controls / UI
  menuOpen?: boolean;
  setMenuOpen?: (open: boolean) => void;
  fabItems: FabItem[];
  selectVisible?: boolean;
  selectOpen?: boolean;
  closeSelectPopup?: () => void;
  projects: string[];
  selectedProject?: string | null;
  handleProjectSelect: (proj: string) => void;
  ITEM_STAGGER: number;
  BASE_DURATION: number;
  ITEM_DURATION: number;
  unitLabel: string;
  theme: "system" | "light" | "dark";

  // bluetooth
  bluetoothOpen?: boolean;
  setBluetoothOpen?: (open: boolean) => void;
  onBluetoothConnectionChange?: (connected: boolean) => void;

  interactionMode?: "runner" | "deleter";
  blockPaletteBottom?: number;
  setBlockPaletteBottom?: (n: number) => void;
};

export default function AppShell(props: AppShellProps) {
  // Unconditional hooks (read-only selectors)
  const reduxSelectedProject = useAppSelector((s: RootState) => (s.projects ? s.projects.selectedProject : null));
  const reduxMenuOpen = useAppSelector((s: RootState) => (s.ui ? s.ui.menuOpen : undefined));
  const reduxBluetoothOpen = useAppSelector((s: RootState) => (s.ui ? s.ui.bluetoothOpen : undefined));
  const reduxInteractionMode = useAppSelector((s: RootState) => (s.ui ? s.ui.interactionMode : undefined));

  const navigate = useNavigate();

  // prefer props when provided, else fall back to redux or defaults
  const {
    blocks,
    isDragging,
    draggedBlockId,
    viewportWidth,
    panX,
    panY,
    zoom,
    onPan,
    onZoom,
    onGreenFlagClick,
    onDelayChange,
    onBlockRemove,
    onBlockDragStart,
    fabItems,
    projects,
    handleProjectSelect,
    ITEM_STAGGER,
    BASE_DURATION,
    ITEM_DURATION,
    unitLabel,
    theme,
    blockPaletteBottom,
    setBlockPaletteBottom,
  } = props;

  const menuOpen = typeof props.menuOpen === "boolean" ? props.menuOpen : reduxMenuOpen ?? false;
  const setMenuOpen = props.setMenuOpen ?? (() => {});
  const selectVisible = typeof props.selectVisible === "boolean" ? props.selectVisible : false;
  const selectOpen = typeof props.selectOpen === "boolean" ? props.selectOpen : false;
  const closeSelectPopup = props.closeSelectPopup ?? (() => {});
  const selectedProject = typeof props.selectedProject !== "undefined" ? props.selectedProject : reduxSelectedProject ?? null;
  const bluetoothOpen = typeof props.bluetoothOpen === "boolean" ? props.bluetoothOpen : reduxBluetoothOpen ?? false;
  const setBluetoothOpen = props.setBluetoothOpen ?? (() => {});
  const onBluetoothConnectionChange = props.onBluetoothConnectionChange ?? (() => {});
  const interactionMode = typeof props.interactionMode !== "undefined" ? props.interactionMode : reduxInteractionMode ?? "runner";

  // Handler to open gamepad page for the currently selected project
  const openGamepadForProject = (id?: string | null) => {
    const pid = id ?? selectedProject;
    if (!pid) {
      toast.warn("یک پروژه انتخاب نشده — ابتدا پروژه‌ای انتخاب کنید.");
      return;
    }
    // navigate to gamepad page
    navigate(`/gamepad/${encodeURIComponent(String(pid))}`);
  };

  return (
    <>
      <BluetoothConnector
        open={bluetoothOpen}
        onConnectionChange={onBluetoothConnectionChange}
        isMenuOpen={bluetoothOpen}
        setIsMenuOpen={setBluetoothOpen}
      />

      <WorkspaceControls
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        fabItems={fabItems}
        selectVisible={selectVisible}
        selectOpen={selectOpen}
        closeSelectPopup={closeSelectPopup}
        projects={projects}
        selectedProject={selectedProject}
        handleProjectSelect={handleProjectSelect}
        ITEM_STAGGER={ITEM_STAGGER}
        BASE_DURATION={BASE_DURATION}
        ITEM_DURATION={ITEM_DURATION}
        viewportWidth={viewportWidth}
        zoom={zoom}
        panX={panX}
        panY={panY}
        unitLabel={unitLabel}
        theme={theme}
      />

      <Workspace
        blocks={blocks}
        isDragging={isDragging}
        draggedBlockId={draggedBlockId}
        onGreenFlagClick={onGreenFlagClick}
        onDelayChange={onDelayChange}
        onBlockRemove={onBlockRemove}
        onBlockDragStart={onBlockDragStart}
        panX={panX}
        panY={panY}
        zoom={zoom}
        onPan={onPan}
        onZoom={onZoom}
        interactionMode={interactionMode}
      />

      <BlockPalette
        onBlockDrag={(block, e) => onBlockDragStart(block, e)}
        selectedProject={selectedProject ?? ""}
        blockPaletteBottom={blockPaletteBottom}
        setBlockPaletteBottom={setBlockPaletteBottom}
      />

      {/* Left-top helper UI (zoom + battery + gamepad button) */}
      {/* <div style={{ position: 'absolute', left: 8, top: 200, zIndex: 80 }}>
          <button
            type="button"
            onClick={() => openGamepadForProject(selectedProject)}
            className={
              "mt-2 w-12 h-12 rounded-full flex items-center justify-center shadow-inner transition-transform active:scale-95 " +
              "bg-white/90 dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
            }
            title="Gamepad"
            aria-label="Open gamepad"
          >
            <img src={GamepadPng} alt="gamepad" className="w-7 h-7" />
          </button>
      </div> */}
    </>
  );
}
