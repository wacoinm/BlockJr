// src/components/AppShell.tsx
import React from 'react';
import { Block } from '../types/Block';
import { BluetoothConnector } from './BluetoothConnector';
import WorkspaceControls from './WorkspaceControls';
import { Workspace } from './Workspace';
import { BlockPalette } from './BlockPalette';

export type FabItem = { key: string; onClick: () => void; content: React.ReactNode };

export type PointerEventLike =
  | React.MouseEvent
  | React.PointerEvent
  | React.TouchEvent;

export type OnBlockDragStart = (block: Block, e: PointerEventLike) => Block | void;

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
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  fabItems: FabItem[];
  selectVisible: boolean;
  selectOpen: boolean;
  closeSelectPopup: () => void;
  projects: string[];
  selectedProject: string | null;
  handleProjectSelect: (proj: string) => void;
  ITEM_STAGGER: number;
  BASE_DURATION: number;
  ITEM_DURATION: number;
  unitLabel: string;
  theme: 'system' | 'light' | 'dark';

  // bluetooth
  bluetoothOpen: boolean;
  setBluetoothOpen: (open: boolean) => void;
  onBluetoothConnectionChange: (connected: boolean) => void;

  interactionMode: 'runner' | 'deleter';
};

export default function AppShell(props: AppShellProps) {
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
    unitLabel,
    theme,
    bluetoothOpen,
    setBluetoothOpen,
    onBluetoothConnectionChange,
    interactionMode,
  } = props;

  return (
    <>
      <BluetoothConnector open={bluetoothOpen} onConnectionChange={onBluetoothConnectionChange} />

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

      <BlockPalette onBlockDrag={(block, e) => onBlockDragStart(block, e)} selectedProject={selectedProject ?? ''} />
    </>
  );
}
