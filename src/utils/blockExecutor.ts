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
 * delayValueForAction is used for action types that accept a following delay as a parameter.
 */
const mapBlockToCommand = (block: Block, delayValueForAction?: number): string => {
  switch (block.type) {
    case 'up':
      return `up(${typeof delayValueForAction === 'number' ? delayValueForAction : 0})`;
    case 'down':
      return `down(${typeof delayValueForAction === 'number' ? delayValueForAction : 0})`;
    case 'delay': {
      const v = typeof block.value === 'number' ? block.value : 1;
      return `delay(${v})`;
    }
    case 'forward':
      return `forward(${typeof delayValueForAction === 'number' ? delayValueForAction : 0})`;
    case 'backward':
      return `backward(${typeof delayValueForAction === 'number' ? delayValueForAction : 0})`;
    case 'clockwise':
      // map to turnright
      return `turnright(${typeof delayValueForAction === 'number' ? delayValueForAction : 0})`;
    case 'countclockwise':
      // map to turnleft
      return `turnleft(${typeof delayValueForAction === 'number' ? delayValueForAction : 0})`;
    case 'speed-low':
      // fixed speed, do not consume a following delay
      return `speed(50)`;
    case 'speed-high':
      return `speed(100)`;
    case 'lamp-on':
      return `lampon(${typeof delayValueForAction === 'number' ? delayValueForAction : 0})`;
    case 'lamp-off':
      return `lampoff(${typeof delayValueForAction === 'number' ? delayValueForAction : 0})`;
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
 *   If multiple consecutive delay blocks follow, their values are summed and applied to the action.
 * - speed-low and speed-high are fixed and DO NOT consume a following delay (delay remains standalone).
 * - Standalone delay blocks:
 *   - If the standalone delay occurs immediately after a speed block, it is ignored (no matter single or multiple).
 *   - If at the start (no previous block) AND there are 2+ consecutive delays, the whole run of delays is ignored.
 *   - Otherwise delays are encoded as delay(x).
 */
export const executeBlocks = async (blocks: Block[]) => {
  if (!blocks || blocks.length === 0) {
    console.log('Execution chain is empty.');
    return;
  }

  const orderedBlocks = buildExecutionOrder(blocks);

  const commands: string[] = [];
  let i = 0;

  // set of types that consume the following delay(s) as a parameter
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

    // 1) If this block consumes delay(s), sum all consecutive delays after it and apply the sum
    if (consumesDelay.has(currentBlock.type)) {
      let sumDelay = 0;
      let j = i + 1;
      while (j < orderedBlocks.length && orderedBlocks[j].type === 'delay') {
        const d = typeof orderedBlocks[j].value === 'number' ? orderedBlocks[j].value! : 1;
        sumDelay += d;
        j++;
      }

      if (sumDelay > 0) {
        commands.push(mapBlockToCommand(currentBlock, sumDelay));
      } else {
        commands.push(mapBlockToCommand(currentBlock, 0));
      }
      i = j; // skip action + consumed delays
      continue;
    }

    // 2) If current is a delay (standalone)
    if (currentBlock.type === 'delay') {
      const prevBlock = i - 1 >= 0 ? orderedBlocks[i - 1] : undefined;

      // count how many consecutive delays starting from i
      let k = i;
      let consecutiveCount = 0;
      let totalConsecutiveDelay = 0;
      while (k < orderedBlocks.length && orderedBlocks[k].type === 'delay') {
        const d = typeof orderedBlocks[k].value === 'number' ? orderedBlocks[k].value! : 1;
        totalConsecutiveDelay += d;
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

      // Otherwise, emit each delay as standalone
      for (let p = i; p < k; p++) {
        const dVal = typeof orderedBlocks[p].value === 'number' ? orderedBlocks[p].value! : 1;
        commands.push(mapBlockToCommand(orderedBlocks[p]!, dVal));
      }
      i = k;
      continue;
    }

    // 3) Other blocks (including speed) — just map directly
    commands.push(mapBlockToCommand(currentBlock));
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
