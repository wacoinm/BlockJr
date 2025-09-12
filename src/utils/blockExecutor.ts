// ./utils/blockExecutor.ts
import bluetoothService from './bluetoothService';
import { Block } from '../types/Block';

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
const mapBlockToCommand = (block: Block, delayUnits?: number, unitMs: number = 100): string => {
  // Helper to compute ms from units (units may be undefined)
  const unitsToMs = (u?: number) => (typeof u === 'number' ? u * unitMs : 0);

  switch (block.type) {
    case 'up':
      return `up(${unitsToMs(delayUnits)})`;
    case 'down':
      return `down(${unitsToMs(delayUnits)})`;
    case 'delay': {
      const v = typeof block.value === 'number' ? block.value : 1;
      return `delay(${v * unitMs})`;
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
 * Main executor — accepts an array of Block objects and sends the encoded command string via bluetoothService when connected.
 *
 * Rules implemented:
 * - The following types WILL consume a following delay block(s) as their parameter:
 *   up, down, forward, backward, clockwise, countclockwise, lamp-on, lamp-off
 *   If multiple consecutive delay blocks follow, their values are summed and applied to the action (in units, then multiplied by `unit`).
 * - speed-low and speed-high are fixed and DO NOT consume a following delay (delay remains standalone).
 * - Standalone delay blocks:
 *   - If the standalone delay occurs immediately after a speed block, it is ignored (no matter single or multiple).
 *   - If at the start (no previous block) AND there are 2+ consecutive delays, the whole run of delays is ignored.
 *   - Otherwise delays are encoded as delay(x) where x is block.value * unit
 *
 * New: accepts optional `unit` parameter (milliseconds per unit). For:
 * - 100m => pass 100
 * - 10m  => pass 10
 * - 1s   => pass 1000
 */
export const executeBlocks = async (blocks: Block[], unit: number = 100) => {
  if (!blocks || blocks.length === 0) {
    console.log('Execution chain is empty.');
    return;
  }

  const orderedBlocks = buildExecutionOrder(blocks);

  const commands: string[] = [];
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

  while (i < orderedBlocks.length) {
    const currentBlock = orderedBlocks[i];
    if (!currentBlock) {
      i++;
      continue;
    }

    // 1) If this block consumes delay(s), sum all consecutive delays after it (in units) and apply the sum
    if (consumesDelay.has(currentBlock.type)) {
      let sumDelayUnits = 0;
      let j = i + 1;
      while (j < orderedBlocks.length && orderedBlocks[j].type === 'delay') {
        const d = typeof orderedBlocks[j].value === 'number' ? orderedBlocks[j].value! : 1;
        sumDelayUnits += d;
        j++;
      }

      // mapBlockToCommand will multiply units by `unit` (ms)
      commands.push(mapBlockToCommand(currentBlock, sumDelayUnits, unit));
      i = j; // skip action + consumed delays
      continue;
    }

    // 2) If current is a delay (standalone)
    if (currentBlock.type === 'delay') {
      const prevBlock = i - 1 >= 0 ? orderedBlocks[i - 1] : undefined;

      // count how many consecutive delays starting from i
      let k = i;
      let consecutiveCount = 0;
      let totalConsecutiveDelayUnits = 0;
      while (k < orderedBlocks.length && orderedBlocks[k].type === 'delay') {
        const d = typeof orderedBlocks[k].value === 'number' ? orderedBlocks[k].value! : 1;
        totalConsecutiveDelayUnits += d;
        consecutiveCount++;
        k++;
      }

      // Rule: if prev is speed => ignore all consecutive delays
      if (isSpeed(prevBlock?.type)) {
        i = k;
        continue;
      }

      // Rule: if at start and 2+ consecutive delays => ignore them
      if (prevBlock === undefined && consecutiveCount >= 2) {
        i = k;
        continue;
      }

      // Otherwise, emit each delay as standalone (mapBlockToCommand handles multiplying by `unit`)
      for (let p = i; p < k; p++) {
        // For 'delay' type we simply call mapBlockToCommand which reads block.value and multiplies by `unit`
        commands.push(mapBlockToCommand(orderedBlocks[p]!, undefined, unit));
      }
      i = k;
      continue;
    }

    // 3) Other blocks (including speed) — just map directly (no delay parameter)
    commands.push(mapBlockToCommand(currentBlock, undefined, unit));
    i += 1;
  }

  const finalCommand = commands.join('_');
  console.log('Executing command:', finalCommand);

  try {
    const connected = await bluetoothService.isConnected();
    if (connected) {
      await bluetoothService.sendString(finalCommand);
      console.log('Sent command over Bluetooth.');
    } else {
      console.log('Not connected to Bluetooth device — command not sent.');
    }
  } catch (e) {
    console.log(finalCommand);
    console.error('Failed to send command over Bluetooth:', e);
  }
};

export default executeBlocks;
