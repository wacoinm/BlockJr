import bluetoothService from './bluetoothService';

export type Block = {
  type: string;
  value?: number | string;
};

export const executeBlocks = async (blocks: Block[]) => {
  if (!blocks || blocks.length === 0) {
    console.log('Execution chain is empty.');
    return;
  }

  const commands: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const currentBlock = blocks[i];

    if (!currentBlock) {
      i++;
      continue;
    }

    if (currentBlock.type === 'up' || currentBlock.type === 'down') {
      const nextBlock = blocks[i + 1];
      if (nextBlock && nextBlock.type === 'delay') {
        const delayValue = typeof nextBlock.value === 'number' ? nextBlock.value : Number(nextBlock.value) || 1;
        commands.push(`${currentBlock.type}(${delayValue})`);
        i += 2;
      } else {
        commands.push(`${currentBlock.type}(0)`);
        i += 1;
      }
    } else if (currentBlock.type === 'delay') {
      // a standalone delay block — encode as delay(x)
      const v = typeof currentBlock.value === 'number' ? currentBlock.value : Number(currentBlock.value) || 1;
      commands.push(`delay(${v})`);
      i += 1;
    } else {
      // other block types: append a generic representation
      const v = currentBlock.value !== undefined ? currentBlock.value : '';
      commands.push(`${currentBlock.type}(${v})`);
      i += 1;
    }
  }

  const finalCommand = commands.join('_');
  console.log('Executing command:', finalCommand);

  // Try to send via Bluetooth if connected
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
