import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  Dm32ScriptedPipe,
  enqueueDm32FactorySectorReply,
  enqueueReadReply,
  enqueueVFrame,
  makeEmptyBlock,
  makeFirstChannelBlock,
} from './__fixtures__/scriptedPipe.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_FACTORY_SECTOR_READ_FRAME,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
  DM32_VFRAME_QUERY_IDS,
} from './constants.ts';
import { captureDm32DebugPipe, createDm32DebugGuard } from './debugCapture.ts';

const te = new TextEncoder();
const ascii = (s: string) => te.encode(s);
const u32 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
const read = (address: number, length: number) =>
  new Uint8Array([
    0x52,
    address & 0xff,
    (address >>> 8) & 0xff,
    (address >>> 16) & 0xff,
    length & 0xff,
    length >>> 8,
  ]);
const PROGRAM = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x0c, ...ascii('PROGRAM')]);
const START = 0x1000;
const END = 0x3fff;
const FACTORY = new Uint8Array(4096).fill(0x5a);

interface ScriptOpts {
  factory?: [Uint8Array, Uint8Array];
  layout?: Uint8Array;
  vframe?: (id: number, pipe: Dm32ScriptedPipe) => boolean;
  stopAfterVFrames?: boolean;
}

/** Enqueue a full synthetic session; return the frames the radio should receive. */
function script(pipe: Dm32ScriptedPipe, opts: ScriptOpts = {}): Uint8Array[] {
  const frames: Uint8Array[] = [];
  const psearch = new Uint8Array(8);
  psearch[0] = 0x06;
  psearch.set(ascii('DP570UV'), 1);
  pipe.enqueue(psearch, new Uint8Array([0x50, 0, 0]), new Uint8Array([0x06]));
  frames.push(ascii('PSEARCH'), ascii('PASSSTA'), ascii('SYSINFO'));
  for (const copy of opts.factory ?? [FACTORY, FACTORY]) {
    enqueueDm32FactorySectorReply(pipe, copy);
    frames.push(DM32_FACTORY_SECTOR_READ_FRAME);
  }
  for (const id of DM32_VFRAME_QUERY_IDS) {
    frames.push(new Uint8Array([0x56, 0, 0, 0, id]));
    if (opts.vframe?.(id, pipe)) continue;
    if (id === 0x0a)
      enqueueVFrame(pipe, id, opts.layout ?? new Uint8Array([...u32(START), ...u32(END)]));
    else if (id === 0x01) enqueueVFrame(pipe, id, ascii('DM32.SYN.001\0'));
    else if (id === 0x02)
      enqueueVFrame(
        pipe,
        id,
        new Uint8Array(12).map((_, i) => i + 1),
      );
    else enqueueVFrame(pipe, id, new Uint8Array(0));
  }
  if (opts.stopAfterVFrames) return frames;
  pipe.enqueue(new Uint8Array([0x06]), new Uint8Array(8).fill(0xff), new Uint8Array([0x06]));
  frames.push(PROGRAM, new Uint8Array([0x02]), new Uint8Array([0x06]));
  const tags = [DM32_METADATA.CHANNEL_FIRST, DM32_METADATA.VFO_SETTINGS, DM32_METADATA.CALIBRATION];
  tags.forEach((tag, i) => {
    const address = START + i * DM32_BLOCK_SIZE + DM32_METADATA_OFFSET;
    enqueueReadReply(pipe, address, new Uint8Array([tag]));
    frames.push(read(address, 1));
  });
  enqueueReadReply(pipe, START, new Uint8Array([1, 0]));
  frames.push(read(START, 2));
  const blocks = [makeFirstChannelBlock(1), makeEmptyBlock(0x04), makeEmptyBlock(0x02)];
  blocks.forEach((block, i) => {
    enqueueReadReply(pipe, START + i * DM32_BLOCK_SIZE, block);
    frames.push(read(START + i * DM32_BLOCK_SIZE, DM32_BLOCK_SIZE));
  });
  return frames;
}

function radio() {
  const pipe = new Dm32ScriptedPipe();
  vi.spyOn(pipe, 'close');
  return pipe;
}

const capture = (pipe: Dm32ScriptedPipe, signal?: AbortSignal) =>
  captureDm32DebugPipe(pipe, { settleScale: 0, signal });

describe('DM-32 debug capture session', () => {
  it('sends exactly the expected read-only transcript', async () => {
    const pipe = radio();
    const expected = script(pipe);
    const result = await capture(pipe);
    expect(pipe.writes).toEqual(expected);
    // ASCII SYSINFO starts with 0x53 ('S'); every other frame is binary.
    const binary = pipe.writes.filter((w) => !/^[A-Z]{7}$/.test(new TextDecoder().decode(w)));
    expect(binary).toHaveLength(expected.length - 3);
    expect(binary.some((w) => w[0] === 0x57 || w[0] === 0x43 || w[0] === 0x53)).toBe(false);
    expect(pipe.writes.filter((w) => w[0] === 0x47)).toHaveLength(2);
    expect(result.window).toEqual({ start: START, end: 0x3000 });
    expect(result.rawRange).toEqual({ start: START, end: END });
    expect([...result.blocks.keys()]).toEqual([0x1000, 0x2000, 0x3000]);
    expect(result.discovered.map((b) => [b.address, b.metadata])).toEqual([
      [0x1000, 0x12],
      [0x2000, 0x04],
      [0x3000, 0x02],
    ]);
    expect(result.factory.status).toBe('kept');
    expect(result.modelString).toBe('DP570UV');
    expect(result.vframes).toHaveLength(DM32_VFRAME_QUERY_IDS.length);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
});

/** Drive a bare guard to a phase by sending each scripted frame and reading its reply. */
async function guardAt(phase: 'start' | 'before-program' | 'reads' | 'factory-done') {
  const pipe = radio();
  const frames = script(pipe);
  const guard = createDm32DebugGuard(pipe);
  const count = { start: 0, 'factory-done': 5, 'before-program': 20, reads: 23 }[phase];
  // Reply chunk sizes are fixed by the queue: read each queued chunk for the frames sent.
  const queue = (pipe as unknown as { queue: Uint8Array[] }).queue;
  const replyChunks = [1, 1, 1, 2, 2, ...DM32_VFRAME_QUERY_IDS.map(() => 0), 1, 1, 1];
  for (let i = 0; i < count; i++) {
    await guard.pipe.write(frames[i]!);
    if (i >= 5 && i < 20) {
      const header = await guard.pipe.readExact(3, 1000);
      if (header[2]! > 0) await guard.pipe.readExact(header[2]!, 1000);
    } else {
      for (let c = 0; c < replyChunks[i]!; c++) {
        await guard.pipe.readExact(queue[0]!.length, 1000);
      }
    }
  }
  return { pipe, guard, next: frames[count]! };
}

const NEVER_SEND: [string, Uint8Array][] = [
  ['57 block write', new Uint8Array([0x57, 0, 0x10, 0, 0, 0x10, ...new Uint8Array(4096)])],
  ['57 short', new Uint8Array([0x57, 0, 0x10, 0, 1, 0])],
  ['43 erase', new Uint8Array([0x43, 0, 0, 0, 0, 0x10])],
  ['53 reprogram', new Uint8Array([0x53, 0, 0, 0, 0, 0x10])],
  ['47 boot-image (5 bytes)', new Uint8Array([0x47, 0, 0, 0, 0])],
  ['47 00 01 00 00 01', new Uint8Array([0x47, 0, 1, 0, 0, 1])],
  ['4D', new Uint8Array([0x4d])],
  ['45', new Uint8Array([0x45, 0, 0])],
  ['31', new Uint8Array([0x31])],
  ['01', new Uint8Array([0x01])],
  ['04', new Uint8Array([0x04])],
  ['single 52', new Uint8Array([0x52])],
  ['STX block', new Uint8Array([0x02, 0x00, 0x10, 0xaa, 0xbb])],
  ['PCTESTM', ascii('PCTESTM')],
  ['RTCITEM', ascii('RTCITEM')],
  ['PASWORD', ascii('PASWORD')],
  ['IDCHECK', ascii('IDCHECK')],
  ['DEL-RCD', ascii('DEL-RCD')],
  ['V-frame 0x0C', new Uint8Array([0x56, 0, 0, 0, 0x0c])],
  ['V-frame 0x11', new Uint8Array([0x56, 0, 0, 0, 0x11])],
  ['V-frame non-zero param', new Uint8Array([0x56, 0, 0, 1, 0x01])],
  ['52 below window', read(0x0fff, 1)],
  ['52 above window', read(0x4000, 1)],
  ['52 spans window end', read(0x3fff, 2)],
  ['52 length 3', read(0x1000, 3)],
  ['52 length 256', read(0x1000, 0x100)],
  ['52 length 4095', read(0x1000, 4095)],
  ['concatenated PSEARCH PASSSTA', ascii('PSEARCHPASSSTA')],
  ['short PSEARC', ascii('PSEARC')],
  ['short PROGRAM', PROGRAM.subarray(0, 11)],
];

describe('DM-32 debug guard refusals', () => {
  it.each(
    (['start', 'factory-done', 'before-program', 'reads'] as const).flatMap((phase) =>
      NEVER_SEND.map(([name, frame]) => [phase, name, frame] as const),
    ),
  )('at %s refuses %s and latches', async (phase, _name, frame) => {
    const { pipe, guard, next } = await guardAt(phase);
    const sent = pipe.writes.length;
    await expect(guard.pipe.write(frame)).rejects.toThrow(/refused/);
    expect(pipe.writes).toHaveLength(sent);
    await expect(guard.pipe.write(next ?? read(0x1000, 1))).rejects.toThrow(/no longer usable/);
    expect(pipe.writes).toHaveLength(sent);
  });

  it.each([
    ['52 before PROGRAM', 'before-program', read(0x1000, 1)],
    ['repeated PSEARCH', 'factory-done', ascii('PSEARCH')],
    ['47 after V-frames', 'before-program', DM32_FACTORY_SECTOR_READ_FRAME],
    ['a third 47', 'factory-done', DM32_FACTORY_SECTOR_READ_FRAME],
    ['V-frame after PROGRAM', 'reads', new Uint8Array([0x56, 0, 0, 0, 0x01])],
    ['PROGRAM again', 'reads', PROGRAM],
    ['PSEARCH in PROGRAM', 'reads', ascii('PSEARCH')],
  ] as const)('refuses %s', async (_name, phase, frame) => {
    const { pipe, guard } = await guardAt(phase);
    const sent = pipe.writes.length;
    await expect(guard.pipe.write(frame)).rejects.toThrow(/refused/);
    expect(pipe.writes).toHaveLength(sent);
  });

  it('refuses a write while a reply is outstanding', async () => {
    const { pipe, guard } = await guardAt('reads');
    await guard.pipe.write(read(0x1fff, 1));
    await expect(guard.pipe.write(read(0x2fff, 1))).rejects.toThrow(/outstanding/);
    expect(pipe.writes.at(-1)).toEqual(read(0x1fff, 1));
  });

  it('refuses a read of the wrong reply size and a read with nothing outstanding', async () => {
    const { guard } = await guardAt('start');
    await expect(guard.pipe.readExact(8, 1000)).rejects.toThrow(/no reply outstanding/);
    const second = await guardAt('start');
    await second.guard.pipe.write(ascii('PSEARCH'));
    await expect(second.guard.pipe.readExact(4, 1000)).rejects.toThrow(/expected 8/);
  });

  it('refuses PROGRAM when the 0x0A window is not known', async () => {
    const pipe = radio();
    script(pipe, {
      layout: new Uint8Array(0),
      stopAfterVFrames: true,
    });
    await expect(capture(pipe)).rejects.toThrow(/0x0A/);
    expect(pipe.writes.some((w) => w[0] === 0xff)).toBe(false);
    expect(pipe.close).toHaveBeenCalledOnce();
  });

  it.each([
    ['start after end', [...u32(0x5000), ...u32(0x1000)]],
    ['end above 0x0FFFFF', [...u32(0x1000), ...u32(0x100000)]],
    ['unaligned start', [...u32(0x1800), ...u32(0x3fff)]],
    ['short layout', [...u32(0x1000), 0, 0]],
  ])('fails on a bad window: %s', async (_name, layout) => {
    const pipe = radio();
    script(pipe, { layout: new Uint8Array(layout), stopAfterVFrames: true });
    await expect(capture(pipe)).rejects.toThrow(/refused|0x0A/);
    expect(pipe.writes.some((w) => w[0] === 0xff || w[0] === 0x52)).toBe(false);
    expect(pipe.close).toHaveBeenCalledOnce();
  });

  it('refuses a read reply whose address echo is wrong', async () => {
    const { pipe, guard } = await guardAt('reads');
    (pipe as unknown as { queue: Uint8Array[] }).queue.length = 0;
    enqueueReadReply(pipe, 0x2fff, new Uint8Array([1]));
    await guard.pipe.write(read(0x1fff, 1));
    await expect(guard.pipe.readExact(6, 1000)).rejects.toThrow(/header/);
    await expect(guard.pipe.write(read(0x2fff, 1))).rejects.toThrow(/no longer usable/);
  });
});

describe('DM-32 debug capture failures', () => {
  it('continues on a factory-sector mismatch and keeps nothing', async () => {
    const pipe = radio();
    const other = FACTORY.slice();
    other[9] = 1;
    script(pipe, { factory: [FACTORY, other] });
    const result = await capture(pipe);
    expect(result.factory).toEqual({ status: 'not-kept', reason: 'mismatch' });
  });

  it('fails closed on a malformed factory-sector reply, with no further frames', async () => {
    const pipe = radio();
    script(pipe, { stopAfterVFrames: true });
    const queue = (pipe as unknown as { queue: Uint8Array[] }).queue;
    queue[3] = new Uint8Array([0x57, 0, 0, 0, 0, 0x10]);
    await expect(capture(pipe)).rejects.toThrow(/factory-sector reply header/);
    expect(pipe.writes).toHaveLength(4);
    expect(pipe.close).toHaveBeenCalledOnce();
  });

  it('records a single V-frame that answers another id and continues', async () => {
    const pipe = radio();
    script(pipe, {
      vframe: (id, p) => {
        if (id !== 0x04) return false;
        enqueueVFrame(p, 0x05, new Uint8Array([1]));
        return true;
      },
    });
    const result = await capture(pipe);
    expect(result.vframes.find((v) => v.id === 0x04)?.status).toBe('failed');
    expect(result.blocks.size).toBe(3);
  });

  it.each([
    [
      'bad reply opcode',
      (p: Dm32ScriptedPipe) => p.enqueue(new Uint8Array([0x57, 0x03, 0])),
      /opcode/,
    ],
    ['timeout', () => undefined, /no queued bytes/],
  ] as const)('fails on a V-frame %s', async (_name, reply, error) => {
    const pipe = radio();
    script(pipe, {
      stopAfterVFrames: true,
      vframe: (id, p) => {
        if (id < 0x03) return false;
        if (id === 0x03) reply(p);
        return true;
      },
    });
    await expect(capture(pipe)).rejects.toThrow(error);
    expect(pipe.writes.filter((w) => w[0] === 0x56)).toHaveLength(3);
    expect(pipe.close).toHaveBeenCalledOnce();
  });

  it('fails on a short read reply', async () => {
    const pipe = radio();
    script(pipe);
    const original = pipe.readExact.bind(pipe);
    pipe.readExact = async (n, t) => {
      const bytes = await original(n, t);
      return n === DM32_BLOCK_SIZE && pipe.writes.at(-1)?.[0] === 0x52
        ? bytes.subarray(0, 100)
        : bytes;
    };
    await expect(capture(pipe)).rejects.toThrow(/short/);
    expect(pipe.writes.filter((w) => w[0] === 0x52 && w[4] === 0 && w[5] === 0x10)).toHaveLength(1);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
});

describe('DM-32 debug capture abort', () => {
  it('sends nothing when aborted before start', async () => {
    const pipe = radio();
    script(pipe);
    const controller = new AbortController();
    controller.abort();
    await expect(capture(pipe, controller.signal)).rejects.toThrow();
    expect(pipe.writes).toHaveLength(0);
    expect(pipe.close).toHaveBeenCalledOnce();
  });

  it.each([
    ['factory read', (n: number, last?: Uint8Array) => n === 4096 && last?.[0] === 0x47, 4],
    [
      'discovery',
      (n: number, last?: Uint8Array, ones = 0) => n === 1 && last?.[0] === 0x52 && ones === 2,
      25,
    ],
    [
      'bulk read',
      (n: number, last?: Uint8Array) => n === DM32_BLOCK_SIZE && last?.[0] === 0x52,
      28,
    ],
  ] as const)('stops after abort during %s', async (_stage, when, writes) => {
    const pipe = radio();
    script(pipe);
    const controller = new AbortController();
    const original = pipe.readExact.bind(pipe);
    let ones = 0;
    let sent = -1;
    pipe.readExact = async (n, t) => {
      const bytes = await original(n, t);
      const last = pipe.writes.at(-1);
      if (n === 1 && last?.[0] === 0x52) ones += 1;
      if (sent < 0 && when(n, last, ones)) {
        controller.abort();
        sent = pipe.writes.length;
      }
      return bytes;
    };
    await expect(capture(pipe, controller.signal)).rejects.toThrow();
    expect(sent).toBe(writes);
    expect(pipe.writes).toHaveLength(sent);
    expect(pipe.close).toHaveBeenCalledOnce();
  });

  it('rejects when aborted after the last read', async () => {
    const pipe = radio();
    const expected = script(pipe);
    const controller = new AbortController();
    const original = pipe.readExact.bind(pipe);
    pipe.readExact = async (n, t) => {
      const bytes = await original(n, t);
      if (pipe.writes.length === expected.length && n === DM32_BLOCK_SIZE) controller.abort();
      return bytes;
    };
    await expect(capture(pipe, controller.signal)).rejects.toThrow();
    expect(pipe.writes).toEqual(expected);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
});

describe('DM-32 debug capture source', () => {
  it('does not reach write, restore or hydration code', () => {
    const source = readFileSync(new URL('./debugCapture.ts', import.meta.url), 'utf8');
    for (const name of [
      'makeDm32WriteFrame',
      'dm32WriteMemory',
      'restoreFromBackup',
      'Dm32uvProtocol',
      'hydration',
    ]) {
      expect(source).not.toContain(name);
    }
  });
});
