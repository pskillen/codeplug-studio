import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioTimeoutError } from '../../kit/errors.ts';
import { memoryMapToBytes } from '../../kit/memoryMap.ts';
import { PROGRAM_QX_BLOCK_SIZE } from '../../kit/codecs/programQx.ts';
import { createRt95Protocol } from './protocol.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import {
  RT95_BLOCK_ADDR_END,
  RT95_BLOCK_ADDR_START,
  RT95_BLOCK_SIZE,
  RT95_IMAGE_SIZE,
} from './constants.ts';
import { programQxChecksum8AfterOpcode } from '../../kit/codecs/programQx.ts';

function buildReadReply(addr: number, payload: Uint8Array): Uint8Array {
  const header = new Uint8Array(4);
  header[0] = 0x52;
  header[1] = (addr >>> 8) & 0xff;
  header[2] = addr & 0xff;
  header[3] = payload.length & 0xff;
  const body = new Uint8Array(4 + payload.length);
  body.set(header, 0);
  body.set(payload, 4);
  const checksum = programQxChecksum8AfterOpcode(body);
  const frame = new Uint8Array(body.length + 2);
  frame.set(body, 0);
  frame[body.length] = checksum;
  frame[body.length + 1] = 0x06;
  return frame;
}

function scriptedEchoPipe(readChunks: Uint8Array[]): BytePipe {
  const queue = [...readChunks];
  return {
    async write() {},
    async readExact(n) {
      const next = queue.shift();
      if (!next || next.length !== n) {
        throw new RadioTimeoutError('scriptedEchoPipe exhausted');
      }
      return next.slice();
    },
    async close() {},
  };
}

function identBytes(): Uint8Array {
  const model = 'RT95-P'.padEnd(7, '\0');
  const version = 'V100'.padEnd(6, '\0');
  const bytes: number[] = [0x49];
  for (const c of model) bytes.push(c.charCodeAt(0));
  bytes.push(0x01);
  for (const c of version) bytes.push(c.charCodeAt(0));
  bytes.push(0x06);
  return new Uint8Array(bytes);
}

function enterReplyBytes(): Uint8Array[] {
  const program = new TextEncoder().encode('PROGRAM');
  const echoed = new Uint8Array([...program, 0x51, 0x58, 0x06]);
  return Array.from(echoed, (b) => new Uint8Array([b]));
}

function identReplyBytes(): Uint8Array[] {
  const cmd = new Uint8Array([0x02]);
  const ident = identBytes();
  const echoed = new Uint8Array([...cmd, ...ident]);
  return Array.from(echoed, (b) => new Uint8Array([b]));
}

describe('Rt95Protocol', () => {
  it('downloads synthetic image blocks via mocked echo pipe', async () => {
    const image = buildSyntheticRt95Image();
    const reads: Uint8Array[] = [...enterReplyBytes(), ...identReplyBytes()];

    for (let addr = RT95_BLOCK_ADDR_START; addr <= RT95_BLOCK_ADDR_END; addr += RT95_BLOCK_SIZE) {
      const payload = image.subarray(addr, addr + PROGRAM_QX_BLOCK_SIZE);
      const reply = buildReadReply(addr, payload);
      const frame = new Uint8Array([...makeProgramQxReadFrame(addr), ...reply]);
      for (const b of frame) {
        reads.push(new Uint8Array([b]));
      }
    }

    const pipe = scriptedEchoPipe(reads);
    const radio = createRt95Protocol();
    await radio.connect(pipe);
    const map = await radio.download({});
    expect(memoryMapToBytes(map).length).toBe(RT95_IMAGE_SIZE);
    expect(map.bytes[0]).toBe(image[0]);
    await radio.disconnect();
  });
});

function makeProgramQxReadFrame(addr: number): Uint8Array {
  return new Uint8Array([0x52, (addr >>> 8) & 0xff, addr & 0xff, 0x10]);
}
