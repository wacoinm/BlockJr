// ./utils/blockExecutor.ts
import { toast } from 'react-toastify';
import bluetoothService from './bluetoothService';
import { Block } from '../types/Block';

/**
 * Safe alert helper:
 * - Uses window.alert when available (browser).
 * - Falls back to console.log / console.error otherwise.
 */
const showAlert = (msg: string, isError = false) => {
  try {
    const text = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      toast.info(text);
      return;
    }
  } catch {
    // ignore
  }

  if (isError) {
    // eslint-disable-next-line no-console
    console.error('ALERT (error):', msg);
  } else {
    // eslint-disable-next-line no-console
    console.log('ALERT:', msg);
  }
};

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
 * Additional enforced rules requested:
 * 1) Execution MUST start with a speed block (speed-low or speed-high). Otherwise show an error and abort.
 * 2) Every move that consumes delays (forward/backward/up/down/clockwise/countclockwise/lamp-on/lamp-off) MUST be immediately followed by a delay block. Otherwise show an error and abort.
 * 3) No delay block is allowed immediately after ANY speed block. If a speed is followed by delay => show an error and abort.
 *
 * New: accepts optional `unit` parameter (milliseconds per unit). For:
 * - 100m => pass 100
 * - 10m  => pass 10
 * - 1s   => pass 1000
 */
export const executeBlocks = async (blocks: Block[], unit: number = 100) => {
  if (!blocks || blocks.length === 0) {
    showAlert('Execution chain is empty.');
    return;
  }

  const orderedBlocks = buildExecutionOrder(blocks);

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

  // --- Validation according to user's rules (show errors as alert and abort) ---
  const errors: string[] = [];

  // 1) Start must be a speed block
  if (orderedBlocks.length === 0 || !isSpeed(orderedBlocks[0].type)) {
    errors.push('Error: in start must start via set speeds! (first block must be speed-low or speed-high).');
  }

  // 2) After any speed, there must NOT be a delay immediately after
  for (let idx = 0; idx < orderedBlocks.length - 1; idx++) {
    const b = orderedBlocks[idx];
    const next = orderedBlocks[idx + 1];
    if (isSpeed(b.type) && next && next.type === 'delay') {
      errors.push(`Error: after speed did not set delay — speed at index ${idx} is followed by a delay at index ${idx + 1}.`);
    }
  }

  // 3) Every move that consumes delays must be immediately followed by a delay block
  for (let idx = 0; idx < orderedBlocks.length; idx++) {
    const b = orderedBlocks[idx];
    if (consumesDelay.has(b.type)) {
      const next = orderedBlocks[idx + 1];
      if (!next || next.type !== 'delay') {
        errors.push(
          `Error: move '${b.type}' at index ${idx} must be immediately followed by a delay block (e.g. delay(1)).`
        );
      }
    }
  }

  if (errors.length > 0) {
    // Show all errors in a single alert (and log them)
    showAlert(errors.join('\n'), true);
    // also log for diagnostics
    // eslint-disable-next-line no-console
    console.error('Validation errors before execution:', errors);
    return;
  }

  // --- Build commands from validated orderedBlocks --------------------------------
  const commands: string[] = [];
  let i = 0;

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
