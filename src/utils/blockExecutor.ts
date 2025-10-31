// src/utils/blockExecutor.ts
import bluetoothService from './bluetoothService';
import { Block } from '../types/Block';
import { toast } from 'react-toastify'; // show small toast messages for errors

/**
 * Build an ordered list of blocks to execute.
 * Preference: follow chains defined by parentId/childId starting from roots (parentId === null).
 * Any blocks not reachable via chains will be appended in the original array order (preserving uniqueness).
 * Prevents infinite loops by tracking visited IDs.
 */
const buildExecutionOrder = (blocks: Block[]): Block[] => {
  const idMap = new Map<string, Block>();
  blocks.forEach((b) => idMap.set(b.id, b));

  const visited = new Set<string>();
  const ordered: Block[] = [];

  // helper to follow chain from a starting block
  const followChain = (start: Block | undefined) => {
    let curr = start;
    while (curr && !visited.has(curr.id)) {
      ordered.push(curr);
      visited.add(curr.id);
      if (curr.childId) {
        const next = idMap.get(curr.childId);
        if (!next || visited.has(next.id)) break;
        curr = next;
      } else {
        break;
      }
    }
  };

  for (const b of blocks) {
    if (b.parentId === null && !visited.has(b.id)) {
      followChain(b);
    }
  }

  for (const b of blocks) {
    if (!visited.has(b.id)) {
      followChain(b);
    }
  }

  return ordered;
};

/**
 * Map a block into the appropriate command string fragment.
 *
 * - delayUnits: number of base-units to convert (e.g. sum of consecutive delay blocks or a single delay value)
 * - unitMs: multiplier in milliseconds (100 for 100m, 10 for 10m, 1000 for 1s)
 *
 * For action types that accept a delay parameter we multiply delayUnits * unitMs to produce a milli-second value.
 * For 'delay' block we multiply the block.value by unitMs.
 */
export const mapBlockToCommand = (block: Block, delayUnits?: number, unitMs: number = 100): string => {
  // Helper to compute ms from units (units may be undefined)
  const unitsToMs = (u: any) => {
    if (typeof u !== 'number') return '0.00';
    // keep two decimal places for compatibility with device protocol if needed
    return (u * unitMs).toFixed(2);
  };

  switch (block.type) {
    case 'up':
      return `up(${unitsToMs(delayUnits)})`;
    case 'down':
      return `down(${unitsToMs(delayUnits)})`;
    case 'delay': {
      // Changed: emit sleep(...) instead of delay(...)
      const v = typeof block.value === 'number' ? block.value : 1;
      // sleep expects milliseconds total (unitMs * v)
      return `sleep(${v * unitMs})`;
    }
    case 'forward':
      return `forward(${unitsToMs(delayUnits)})`;
    case 'backward':
      return `backward(${unitsToMs(delayUnits)})`;
    case 'clockwise':
      // map to turnright
      return `turnright(${unitsToMs(delayUnits)})`;
    case 'countclockwise':
      // map to turnleft
      return `turnleft(${unitsToMs(delayUnits)})`;
    case 'speed-low':
      // fixed speed, do not consume a following delay
      return `speed(50)`;
    case 'speed-high':
      return `speed(100)`;
    case 'lamp-on':
      return `lampon(${unitsToMs(delayUnits)})`;
    case 'lamp-off':
      return `lampoff(${unitsToMs(delayUnits)})`;
    default: {
      const v = block.value !== undefined ? block.value : '';
      return `${block.type}(${v})`;
    }
  }
};

/**
 * Build a command queue (array) mapping blocks -> command string(s).
 *
 * Each entry in the returned array is { id: string, cmd: string } where `id` is the originating block's id
 * (for delay-consuming actions the action block is the id; for standalone delay the delay block is the id).
 *
 * This mirrors the encoding rules in the older executeBlocks() but returns individual commands rather than a joined string.
 *
 * unit: multiplier in ms (100, 10, 1000, etc.)
 */
export const buildCommandQueue = (blocks: Block[], unit: number = 100): { id: string; cmd: string }[] => {
  if (!blocks || blocks.length === 0) return [];

  const orderedBlocks = buildExecutionOrder(blocks);

  const queue: { id: string; cmd: string }[] = [];
  let i = 0;

  // set of types that consume the following delay(s) as a parameter (in units)
  const consumesDelay = new Set<Block['type']>([
    'up',
    'down',
    'forward',
    'backward',
    'clockwise',
    'countclockwise',
    'lamp-on',
    'lamp-off',
  ]);

  const isSpeed = (t: Block['type'] | undefined) => t === 'speed-low' || t === 'speed-high';

  // === ENFORCE EXACTLY ONE RULE: if a move is IMMEDIATELY followed by speed => show toast and abort
  for (let idx = 0; idx < orderedBlocks.length - 1; idx++) {
    const curr = orderedBlocks[idx];
    const next = orderedBlocks[idx + 1];
    if (consumesDelay.has(curr.type) && isSpeed(next.type)) {
      toast.error('A move block cannot be immediately followed by a speed block.');
      console.error(
        `Validation error: move '${curr.type}' at index ${idx} is immediately followed by speed '${next.type}' at index ${idx + 1}.`
      );
      return [];
    }
  }

  while (i < orderedBlocks.length) {
    const currentBlock = orderedBlocks[i];
    if (!currentBlock) {
      i++;
      continue;
    }

    // 1) If this block consumes delay(s)
    if (consumesDelay.has(currentBlock.type)) {
      // If the action block itself has a numeric value, use it AS the delay and do NOT consume following delay blocks
      if (typeof currentBlock.value === 'number') {
        const explicitUnits = currentBlock.value;
        queue.push({ id: currentBlock.id, cmd: mapBlockToCommand(currentBlock, explicitUnits, unit) });
        i = i + 1; // only the action consumed
        continue;
      }

      // Otherwise sum following delay blocks as before
      let sumDelayUnits = 0;
      let j = i + 1;
      while (j < orderedBlocks.length && orderedBlocks[j].type === 'delay') {
        const d = typeof orderedBlocks[j].value === 'number' ? orderedBlocks[j].value! : 1;
        sumDelayUnits += d;
        j++;
      }

      queue.push({ id: currentBlock.id, cmd: mapBlockToCommand(currentBlock, sumDelayUnits, unit) });
      i = j; // skip action + consumed delays
      continue;
    }

    // 2) If current is a delay (standalone)
    if (currentBlock.type === 'delay') {
      const prevBlock = i - 1 >= 0 ? orderedBlocks[i - 1] : undefined;

      // count how many consecutive delays starting from i
      let k = i;
      let consecutiveCount = 0;
      while (k < orderedBlocks.length && orderedBlocks[k].type === 'delay') {
        consecutiveCount++;
        k++;
      }

      // if previous is speed => ignore consecutive delays
      if (isSpeed(prevBlock?.type)) {
        i = k;
        continue;
      }

      // if at start and 2+ consecutive delays => ignore them
      if (prevBlock === undefined && consecutiveCount >= 2) {
        i = k;
        continue;
      }

      // otherwise emit each delay as standalone `sleep(...)` mapped to that delay block
      for (let p = i; p < k; p++) {
        queue.push({ id: orderedBlocks[p]!.id, cmd: mapBlockToCommand(orderedBlocks[p]!, undefined, unit) });
      }
      i = k;
      continue;
    }

    // 3) Other blocks (including speed) — just map directly (no delay parameter)
    queue.push({ id: currentBlock.id, cmd: mapBlockToCommand(currentBlock, undefined, unit) });
    i += 1;
  }

  return queue;
};

/**
 * Backwards-compatible helper — keeps the previous behavior of sending a joined command.
 * (We keep it for other parts of the app that may still call executeBlocks()).
 */
export const executeBlocks = async (blocks: Block[], unit: number = 100) => {
  const queue = buildCommandQueue(blocks, unit);
  if (!queue || queue.length === 0) {
    console.log('Execution chain is empty or invalid.');
    return;
  }
  const finalCommand = queue.map((q) => q.cmd).join('_');
  console.log('Executing command (joined):', finalCommand);
  try {
    const connected = await bluetoothService.isConnected();
    if (connected) {
      await bluetoothService.sendString(finalCommand);
      console.log('Sent command over Bluetooth.');
    } else {
      console.log('Not connected to Bluetooth device — command not sent.');
    }
  } catch (e) {
    console.error('Failed to send command over Bluetooth:', e);
  }
};

export default executeBlocks;
