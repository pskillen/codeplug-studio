import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioTimeoutError } from '../../kit/errors.ts';
import { memoryMapToBytes } from '../../kit/memoryMap.ts';
import {
  PROGRAM_QX_BLOCK_SIZE,
  makeProgramQxReadFrame as kitReadFrame,
  makeProgramQxWriteFrame,
} from '../../kit/codecs/programQx.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { Rt95Protocol } from './protocol.ts';
import { planRt95Stages } from './plannedStages.ts';
import {
  expectEmittedWithinPlan,
  expectEventsFollowPlan,
  stageRecorder,
} from '../../plannedStagesTestKit.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import {
  RT95_BLOCK_ADDR_END,
  RT95_BLOCK_ADDR_START,
  RT95_BLOCK_SIZE,
  RT95_IMAGE_SIZE,
  RT95_UPLOAD_PRIME_ADDR,
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

    const writes: Uint8Array[] = [];
    const inner = scriptedEchoPipe(reads);
    const pipe: BytePipe = {
      write: async (data) => {
        writes.push(data.slice());
        await inner.write(data);
      },
      readExact: (n, t) => inner.readExact(n, t),
      close: () => inner.close(),
    };
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    const stages: string[] = [];
    const map = await radio.download({
      progressStage: 'Pre-write read',
      onProgress: (p) => {
        if (p.stage) stages.push(p.stage);
      },
    });
    expect(memoryMapToBytes(map).length).toBe(RT95_IMAGE_SIZE);
    expect(map.bytes[0]).toBe(image[0]);
    expect(stages.every((s) => s === 'Pre-write read')).toBe(true);
    const plan = planRt95Stages('write', {});
    expectEmittedWithinPlan(plan, stages);
    expect(plan.map((s) => s.label)).toEqual(['Pre-write read', 'Upload']);
    expect(stages.length).toBeGreaterThan(0);
    const program = new TextEncoder().encode('PROGRAM');
    const programIdx = writes.findIndex(
      (w) => w.length === program.length && w.every((b, i) => b === program[i]),
    );
    const firstR = writes.findIndex((w) => w[0] === 0x52);
    expect(programIdx).toBeGreaterThanOrEqual(0);
    expect(firstR).toBeGreaterThan(programIdx);
    await radio.disconnect();
  });

  it('a full Write (pre-write read, then upload) follows the plan in order (#1393)', async () => {
    const image = buildSyntheticRt95Image();
    const byteChunks = (frame: Uint8Array) => Array.from(frame, (b) => new Uint8Array([b]));
    const reads: Uint8Array[] = [...enterReplyBytes(), ...identReplyBytes()];
    for (let addr = RT95_BLOCK_ADDR_START; addr <= RT95_BLOCK_ADDR_END; addr += RT95_BLOCK_SIZE) {
      const payload = image.subarray(addr, addr + PROGRAM_QX_BLOCK_SIZE);
      reads.push(
        ...byteChunks(
          new Uint8Array([...makeProgramQxReadFrame(addr), ...buildReadReply(addr, payload)]),
        ),
      );
    }
    // Upload: enter, ident, prime read, then an echoed frame and a 0x06 ACK per block.
    reads.push(...enterReplyBytes(), ...identReplyBytes());
    const primeFrame = kitReadFrame(RT95_UPLOAD_PRIME_ADDR, PROGRAM_QX_BLOCK_SIZE);
    reads.push(
      ...byteChunks(
        new Uint8Array([
          ...primeFrame,
          ...buildReadReply(RT95_UPLOAD_PRIME_ADDR, new Uint8Array(PROGRAM_QX_BLOCK_SIZE)),
        ]),
      ),
    );
    const upImage = createMemoryMap(RT95_IMAGE_SIZE);
    upImage.set(0, image.subarray(0, RT95_IMAGE_SIZE));
    for (let addr = RT95_BLOCK_ADDR_START; addr <= RT95_BLOCK_ADDR_END; addr += RT95_BLOCK_SIZE) {
      const frame = makeProgramQxWriteFrame(
        addr,
        PROGRAM_QX_BLOCK_SIZE,
        upImage.get(addr, RT95_BLOCK_SIZE),
      );
      reads.push(...byteChunks(frame), new Uint8Array([0x06]));
    }
    const radio = new Rt95Protocol();
    await radio.connect(scriptedEchoPipe(reads));
    const rec = stageRecorder();
    await radio.download({ progressStage: 'Pre-write read', onProgress: rec.onProgress });
    await radio.upload(upImage, { onProgress: rec.onProgress });
    expectEventsFollowPlan(planRt95Stages('write', {}), rec.events);
    expect(rec.stages).toEqual(['Pre-write read', 'Upload']);
  });
});

function makeProgramQxReadFrame(addr: number): Uint8Array {
  return new Uint8Array([0x52, (addr >>> 8) & 0xff, addr & 0xff, 0x10]);
}
