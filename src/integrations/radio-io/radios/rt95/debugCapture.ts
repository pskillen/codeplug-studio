import {
  RT95_CALIBRATION_LENGTH,
  RT95_CALIBRATION_START,
} from '@core/radios/retevis/rt95/calibration.ts';
import type { Rt95Protocol } from './protocol.ts';

/** Read only the fixed debug prefix through the existing protocol and guard. */
export async function readRt95Calibration(
  radio: Pick<Rt95Protocol, 'readBlocks'>,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const addresses = Array.from(
    { length: RT95_CALIBRATION_LENGTH / 16 },
    (_, i) => RT95_CALIBRATION_START + i * 16,
  );
  const blocks = await radio.readBlocks(addresses, { signal });
  const bytes = new Uint8Array(RT95_CALIBRATION_LENGTH);
  for (const address of addresses) {
    const block = blocks.get(address);
    if (!block || block.length !== 16) throw new Error('Invalid RT95 calibration block.');
    bytes.set(block, address - RT95_CALIBRATION_START);
  }
  return bytes;
}
