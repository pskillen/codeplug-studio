import { beforeEach, expect, it, vi } from 'vitest';
import { AtD890ScriptedPipe } from './__fixtures__/scriptedPipe.ts';
import { captureAtD890DebugPipe } from './debugCapture.ts';
import { AT_D890_LIMITS, AT_D890_NXDN, D890_MAP } from './constants.ts';

const injection = vi.hoisted(() => ({
  stage: '',
  frame: new Uint8Array(),
  called: [] as string[],
}));

// These wrappers inject at the caller boundary, but delegate to the actual readers on success.
vi.mock('./protocol.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./protocol.ts')>();
  return {
    ...original,
    downloadAtD890SparseRegions: async (
      ...args: Parameters<typeof original.downloadAtD890SparseRegions>
    ) => {
      injection.called.push('sparse');
      if (injection.stage === 'sparse') await args[0].write(injection.frame);
      return original.downloadAtD890SparseRegions(...args);
    },
  };
});
vi.mock('./vitalBackup.ts', async (importOriginal) => {
  const original = await importOriginal<typeof import('./vitalBackup.ts')>();
  return {
    ...original,
    readAtD890VitalUnits: async (...args: Parameters<typeof original.readAtD890VitalUnits>) => {
      injection.called.push('vital');
      if (injection.stage === 'vital') await args[0].pipe.write(injection.frame);
      return original.readAtD890VitalUnits(...args);
    },
  };
});

function syntheticRadio() {
  const pipe = new AtD890ScriptedPipe();
  const ident = new Uint8Array(16);
  ident.set(new TextEncoder().encode('ID890UV'));
  ident.set(new TextEncoder().encode('V100'), 9);
  pipe.enqueue(new Uint8Array([0x51, 0x58, 6]), ident);
  // Empty inverted talkgroup bitmap and NXDN index; all other occupancy maps are zero.
  pipe.readResponder = (address, length) => {
    const bytes = new Uint8Array(length);
    if (
      (address >= D890_MAP.TalkgroupSet &&
        address < D890_MAP.TalkgroupSet + AT_D890_LIMITS.TALKGROUP_SET_BYTES) ||
      (address >= AT_D890_NXDN.ListIndex &&
        address < AT_D890_NXDN.ListIndex + AT_D890_NXDN.ListIndexBytes)
    )
      bytes.fill(0xff);
    return bytes;
  };
  vi.spyOn(pipe, 'close');
  return pipe;
}

beforeEach(() => {
  injection.stage = '';
  injection.called = [];
});

it('runs real sparse and twice-compared vital reads through the guard before the fresh END check', async () => {
  const pipe = syntheticRadio();
  const result = await captureAtD890DebugPipe(pipe);
  expect(injection.called).toEqual(['sparse', 'vital']);
  expect(result.cache.blocks.size).toBeGreaterThan(100);
  expect(result.cache.blocks.has(D890_MAP.VfoChannels)).toBe(true);
  expect(result.vital.units).toHaveLength(4);
  expect(result.vital.bothReadsMatched).toBe(true);
  expect(pipe.writes.at(-2)).toEqual(
    new Uint8Array([
      0x52,
      D890_MAP.LocalInfo >>> 24,
      (D890_MAP.LocalInfo >>> 16) & 255,
      (D890_MAP.LocalInfo >>> 8) & 255,
      D890_MAP.LocalInfo & 255,
      16,
    ]),
  );
  expect(new TextDecoder().decode(pipe.writes.at(-1))).toBe('END');
  expect(pipe.writes.filter((frame) => frame[0] === 0x57)).toHaveLength(0);
  expect(pipe.close).toHaveBeenCalledOnce();
}, 30000);

it.each(['sparse', 'vital'])(
  'refuses forbidden caller frames from %s before transport',
  async (stage) => {
    const forbidden = [
      new Uint8Array([0x57, 0, 0, 0, 0, 16]),
      new Uint8Array([0x52, 0, 0, 0, 0, 1, 0]),
      new TextEncoder().encode('END'),
    ];
    for (const frame of forbidden) {
      injection.stage = stage;
      injection.frame = frame;
      injection.called = [];
      const pipe = syntheticRadio();
      await expect(captureAtD890DebugPipe(pipe)).rejects.toThrow(/power-cycle/i);
      expect(injection.called).toContain(stage);
      expect(
        pipe.writes.some(
          (sent) => sent.length === frame.length && sent.every((byte, i) => byte === frame[i]),
        ),
      ).toBe(false);
      expect(pipe.writes.some((sent) => new TextDecoder().decode(sent) === 'END')).toBe(false);
      expect(pipe.close).toHaveBeenCalledOnce();
    }
  },
  30000,
);
