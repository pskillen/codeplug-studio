import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioTimeoutError } from '../../kit/errors.ts';
import { memoryMapToBytes } from '../../kit/memoryMap.ts';
import {
  PROGRAM_QX_BLOCK_SIZE,
  makeProgramQxReadFrame as kitReadFrame,
  makeProgramQxWriteFrame,
} from '../../kit/codecs/programQx.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { exitProgramQxMode } from '../../kit/codecs/programQx.ts';
import { createFakeRt95Pipe, buildFakeRt95Eeprom } from './__fixtures__/fakeRt95Pipe.ts';
import {
  Rt95Protocol,
  getLastRt95EndAt,
  setRt95EndAtForTests,
  setRt95RetryTuningForTests,
} from './protocol.ts';
import { planRt95Stages } from './plannedStages.ts';
import {
  expectEmittedWithinPlan,
  expectEventsFollowPlan,
  stageRecorder,
} from '../../plannedStagesTestKit.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import { resolveRt95SettingsPatches } from './settingsFields.ts';
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

  it('upload without settings patches matches the pre-pause image bytes written', async () => {
    const eeprom = buildFakeRt95Eeprom();
    eeprom[0x3200] = 0x55;
    const map = createMemoryMap(RT95_IMAGE_SIZE);
    map.set(0, eeprom.subarray(0, RT95_IMAGE_SIZE));
    const pipe = createFakeRt95Pipe({ eeprom });
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    await radio.upload(map, {});
    const w3200 = pipe.writes.find((w) => w[0] === 0x57 && w[1] === 0x32 && w[2] === 0x00);
    expect(w3200?.[4]).toBe(0x55);
  });

  it('upload applies a registered settings patch after a fresh read of the touched block', async () => {
    const eeprom = buildFakeRt95Eeprom();
    eeprom[0x3200] = 0xf0;
    const map = createMemoryMap(RT95_IMAGE_SIZE);
    map.set(0, eeprom.subarray(0, RT95_IMAGE_SIZE));
    const pipe = createFakeRt95Pipe({ eeprom });
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    const patches = resolveRt95SettingsPatches([{ fieldId: 'beepVolume', value: 3 }], 'stock');
    await radio.upload(map, { settingsPatches: patches });
    const w3200 = pipe.writes.find((w) => w[0] === 0x57 && w[1] === 0x32 && w[2] === 0x00);
    expect(w3200).toBeDefined();
    expect(w3200![4]! & 0x07).toBe(3);
    expect(w3200![4]! & 0xf8).toBe(0xf0);
  });

  it('upload settings-only writes a single block and never 0x3B00', async () => {
    const eeprom = buildFakeRt95Eeprom();
    const map = createMemoryMap(RT95_IMAGE_SIZE);
    map.set(0, eeprom.subarray(0, RT95_IMAGE_SIZE));
    const pipe = createFakeRt95Pipe({ eeprom });
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    const patches = resolveRt95SettingsPatches([{ fieldId: 'beepVolume', value: 2 }], 'stock');
    await radio.uploadSettingsPatches(patches, map, {});
    const writeAddrs = pipe.writes.filter((w) => w[0] === 0x57).map((w) => (w[1]! << 8) | w[2]!);
    expect(writeAddrs).toEqual([0x3200]);
    expect(writeAddrs.some((a) => a >= 0x3b00)).toBe(false);
  });
});

function makeProgramQxReadFrame(addr: number): Uint8Array {
  return new Uint8Array([0x52, (addr >>> 8) & 0xff, addr & 0xff, 0x10]);
}

describe('Rt95Protocol after END (#1461)', () => {
  const decode = (w: Uint8Array) => new TextDecoder().decode(w);

  beforeEach(() => {
    setRt95EndAtForTests(0);
    setRt95RetryTuningForTests({ intervalMs: 20, budgetMs: 400, timeoutMs: 10 });
  });
  afterEach(() => {
    setRt95EndAtForTests(0);
    setRt95RetryTuningForTests({});
  });

  function imageToWrite(): ReturnType<typeof createMemoryMap> {
    const bytes = buildSyntheticRt95Image();
    bytes[0x0100] = 0x42;
    const image = createMemoryMap(RT95_IMAGE_SIZE);
    image.set(0, bytes.subarray(0, RT95_IMAGE_SIZE));
    return image;
  }

  it('upload, then ensureProgramMode waits out the deaf window and a download follows', async () => {
    const pipe = createFakeRt95Pipe({ deafAfterEndMs: 40 });
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    await radio.upload(imageToWrite(), {});
    expect(getLastRt95EndAt()).toBeGreaterThan(0);

    await radio.ensureProgramMode();

    const endAt = pipe.writes.findIndex((w) => decode(w) === 'END');
    const programsAfterEnd = pipe.writes.slice(endAt).filter((w) => decode(w) === 'PROGRAM');
    expect(programsAfterEnd.length).toBeGreaterThanOrEqual(2);
    const ops = pipe.log.map((e) => e.op);
    expect(ops.slice(ops.lastIndexOf('END'))).toEqual(['END', 'PROGRAM', 'IDENT']);

    const readsBefore = pipe.count('R');
    const image = await radio.download();
    expect(pipe.count('R') - readsBefore).toBe(
      (RT95_BLOCK_ADDR_END - RT95_BLOCK_ADDR_START) / 16 + 1,
    );
    expect(image.bytes[0x0100]).toBe(0x42);
  });

  it('ensureProgramMode is a no-op while the session is already in PC mode', async () => {
    const pipe = createFakeRt95Pipe();
    const radio = new Rt95Protocol();
    await radio.connect(pipe);
    await radio.ensureProgramMode();
    expect(pipe.count('PROGRAM')).toBe(1);
  });

  it("connect within 15 s of Studio's own END retries PROGRAM", async () => {
    const pipe = createFakeRt95Pipe({ deafAfterEndMs: 40 });
    await exitProgramQxMode(pipe);
    setRt95EndAtForTests(Date.now());

    await new Rt95Protocol().connect(pipe);

    const programs = pipe.writes.filter((w) => decode(w) === 'PROGRAM');
    expect(programs.length).toBeGreaterThanOrEqual(2);
    expect(pipe.count('PROGRAM')).toBe(1);
  });

  it('connect with no recent END sends PROGRAM once and fails fast on a silent pipe', async () => {
    const pipe = createFakeRt95Pipe({ deafAfterEndMs: 60_000 });
    await exitProgramQxMode(pipe);
    await new Promise((resolve) => setTimeout(resolve, 5)); // let the END echo land

    await expect(new Rt95Protocol().connect(pipe)).rejects.toBeInstanceOf(RadioTimeoutError);

    expect(pipe.writes.filter((w) => decode(w) === 'PROGRAM')).toHaveLength(1);
  });
});
