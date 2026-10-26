/**
 * `beforeTransmit` leaves the wire unchanged for the DM-32UV (#1393): the same write with and
 * without the hook puts the same frames on a scripted pipe, and the hook runs after the
 * in-session read and before the first block write.
 */

import { describe, expect, it } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from '@integrations/radio-io/radios/dm32uv/constants.ts';
import { DM32UV_DESCRIPTOR } from '@integrations/radio-io/radios/dm32uv/descriptor.ts';
import {
  Dm32ScriptedPipe,
  enqueueReadReply,
  scriptDm32DownloadTwoBlocks,
} from '@integrations/radio-io/radios/dm32uv/__fixtures__/scriptedPipe.ts';
import { Dm32uvProtocol } from '@integrations/radio-io/radios/dm32uv/protocol.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import { uploadPreparedRadioWrite, type BeforeTransmitContext } from './radioIoSession.ts';

const { egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');

async function dm32Session(): Promise<{ session: RadioSession; pipe: Dm32ScriptedPipe }> {
  const pipe = new Dm32ScriptedPipe();
  const { start } = scriptDm32DownloadTwoBlocks(pipe, 1);
  // The write's in-session read consumes the download script above; the upload then discovers the
  // live map again and acknowledges each dirty block.
  enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
  enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([DM32_METADATA.VFO_SETTINGS]));
  for (let i = 0; i < 4; i += 1) pipe.enqueue(new Uint8Array([0x06]));
  const radio = new Dm32uvProtocol();
  await radio.connect(pipe, { settleScale: 0 });
  return { session: { descriptor: DM32UV_DESCRIPTOR, pipe, radio }, pipe };
}

function isBlockWrite(frame: number[]): boolean {
  return frame[0] === 0x57 && frame.length === 6 + DM32_BLOCK_SIZE;
}

async function run(hook: boolean): Promise<{
  frames: number[][];
  ctx?: BeforeTransmitContext;
  framesAtHook: number;
}> {
  const { session, pipe } = await dm32Session();
  const before = pipe.writes.length;
  let ctx: BeforeTransmitContext | undefined;
  let framesAtHook = -1;
  await uploadPreparedRadioWrite(session, egress, undefined, {
    channels: [],
    organisation: {},
    ...(hook
      ? {
          beforeTransmit: async (c: BeforeTransmitContext) => {
            ctx = c;
            framesAtHook = pipe.writes.length - before;
          },
        }
      : {}),
  });
  return { frames: pipe.writes.slice(before).map((f) => [...f]), ctx, framesAtHook };
}

describe('uploadPreparedRadioWrite beforeTransmit, DM-32UV frames', () => {
  it('writes the same frames with and without the hook; the hook runs after the read', async () => {
    const plain = await run(false);
    const hooked = await run(true);
    expect(plain.frames.some(isBlockWrite)).toBe(true);
    expect(hooked.frames).toEqual(plain.frames);
    expect(hooked.ctx?.identity.model).toBe(DM32UV_DESCRIPTOR.label);
    // The in-session read had already happened (read frames only); no block write yet.
    expect(hooked.frames.slice(0, hooked.framesAtHook).some(isBlockWrite)).toBe(false);
    expect(hooked.frames.slice(hooked.framesAtHook).some(isBlockWrite)).toBe(true);
  }, 20_000);
});
