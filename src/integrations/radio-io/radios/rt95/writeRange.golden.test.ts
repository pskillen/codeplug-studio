/**
 * Golden write-range test, protocol level (#1465): drive `Rt95Protocol` through the fake cable and
 * check every `W` frame sent against the allowed set in `__fixtures__/writeRangeKit.ts`. This file
 * pins the protocol's own limits (a widened constant or a removed chip guard fails here). The
 * app's write entry points, which decide what the protocol is asked to send, are covered by
 * `src/app/services/radioIoRt95WriteRange.golden.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '../../backup/types.ts';
import { memoryMapFromBytes } from '../../kit/memoryMap.ts';
import { RT95_IMAGE_SIZE, RT95_MODEL_ID } from './constants.ts';
import { createFakeRt95Pipe, type FakeRt95Pipe } from './__fixtures__/fakeRt95Pipe.ts';
import { MMD1_VECTORS, MMD1_VECTOR_CHANNELS } from './__fixtures__/mmd1Vectors.ts';
import { rt95OverridesAt } from './__fixtures__/settingsFixtures.ts';
import {
  RT95_CPS_WRITE_RANGES,
  RT95_GOLDEN_ALLOWED_WRITE_SET,
  RT95_MM9PDY_WRITE_RANGE,
  RT95_STUDIO_EXTRA_WRITE_RANGE,
  rt95WriteRangeViolations,
  sentRt95WriteFrames,
  type Rt95WriteFrame,
  type Rt95WriteTarget,
} from './__fixtures__/writeRangeKit.ts';
import type { Rt95ModDataInput } from './modData/index.ts';
import { Rt95Protocol, setRt95EndAtForTests, setRt95RetryTuningForTests } from './protocol.ts';
import { RT95_PROGRAMMING_IMAGE_REGION_ID } from './restoreFromBackup.ts';
import { resolveRt95SettingsPatches } from './settingsFields.ts';

function dtos(): RadioChannelDto[] {
  return MMD1_VECTOR_CHANNELS.map((c) => ({
    slotIndex: c.slotIndex,
    empty: false,
    wireName: c.wireName,
    rxHz: c.rxHz,
    txHz: c.rxHz,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
  }));
}

function mm9pdyIntent(): Rt95ModDataInput {
  const v = MMD1_VECTORS.find((x) => x.id === 'D')!;
  return { zones: v.zones, descriptions: v.descriptions };
}

/** Stock or MM9PDY Write, as the session runs it: connect, pre-write read, probe, encode, upload. */
async function write(pipe: FakeRt95Pipe, target: Rt95WriteTarget): Promise<void> {
  const radio = new Rt95Protocol();
  await radio.connect(pipe);
  const prior = await radio.download();
  radio.setModDataIntent(target === 'mm9pdy' ? mm9pdyIntent() : null);
  if (target === 'mm9pdy') await radio.probeChipGuard();
  await radio.upload(radio.encodeChannels(prior, dtos()));
}

/** Protocol settings patches: every registered setting at its first value, on the stock target. */
async function settingsPatches(pipe: FakeRt95Pipe): Promise<void> {
  const radio = new Rt95Protocol();
  await radio.connect(pipe);
  const image = await radio.download();
  await radio.uploadSettingsPatches(
    resolveRt95SettingsPatches(rt95OverridesAt('first'), 'stock'),
    image,
  );
}

function backupManifest(): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-11-04T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: RT95_MODEL_ID,
    descriptorLabel: 'Retevis RT95 VOX',
    firmware: 'V100',
    coverage: 'full-clone',
    imageByteLength: RT95_IMAGE_SIZE,
    regions: [
      {
        id: RT95_PROGRAMMING_IMAGE_REGION_ID,
        label: 'Programming image',
        address: 0,
        byteLength: RT95_IMAGE_SIZE,
        path: 'regions/programming-image.bin',
        restoreRole: 'restorable',
      },
    ],
  };
}

async function restore(pipe: FakeRt95Pipe): Promise<void> {
  const radio = new Rt95Protocol();
  await radio.connect(pipe, { handshake: 'none' });
  const bytes = pipe.eeprom.slice(0, RT95_IMAGE_SIZE);
  await radio.restoreFromBackup(
    { manifest: backupManifest(), image: memoryMapFromBytes(bytes) },
    { regionIds: [RT95_PROGRAMMING_IMAGE_REGION_ID] },
  );
}

const PATHS: {
  name: string;
  target: Rt95WriteTarget;
  run: (pipe: FakeRt95Pipe) => Promise<void>;
}[] = [
  { name: 'stock Write', target: 'stock', run: (p) => write(p, 'stock') },
  { name: 'MM9PDY Write', target: 'mm9pdy', run: (p) => write(p, 'mm9pdy') },
  { name: 'settings patches', target: 'stock', run: settingsPatches },
  { name: 'Restore', target: 'stock', run: restore },
];

beforeEach(() => {
  setRt95EndAtForTests(0);
  setRt95RetryTuningForTests({ intervalMs: 20, budgetMs: 400, timeoutMs: 10 });
});
afterEach(() => {
  setRt95EndAtForTests(0);
  setRt95RetryTuningForTests({});
});

describe('RT95 golden write range, protocol level (#1465)', () => {
  for (const path of PATHS) {
    it(`${path.name} sends only 16-byte aligned blocks inside the allowed set`, async () => {
      const pipe = createFakeRt95Pipe();
      await path.run(pipe);
      const frames = sentRt95WriteFrames(pipe);
      expect(frames.length).toBeGreaterThan(0);
      expect(rt95WriteRangeViolations(frames, path.target)).toEqual([]);
    });
  }

  it('only the MM9PDY Write addresses 0x4000-0x5FFF, and only after the chip guard reads', async () => {
    for (const path of PATHS) {
      const pipe = createFakeRt95Pipe();
      await path.run(pipe);
      const mmd1 = sentRt95WriteFrames(pipe).filter(
        (f) => f.address >= RT95_MM9PDY_WRITE_RANGE.start,
      );
      if (path.name !== 'MM9PDY Write') {
        expect(mmd1, path.name).toEqual([]);
        continue;
      }
      expect(mmd1.length).toBeGreaterThan(0);
      const firstMmd1 = pipe.log.findIndex((e) => e.op === 'W' && e.addr! >= 0x4000);
      const lastGuardRead = pipe.log.map((e) => `${e.op} ${e.addr}`).lastIndexOf(`R ${0x7b00}`);
      expect(lastGuardRead).toBeGreaterThan(-1);
      expect(lastGuardRead).toBeLessThan(firstMmd1);
    }
  });

  it('a 16 KiB (aliasing) chip stops the MM9PDY Write with no block sent', async () => {
    const pipe = createFakeRt95Pipe({ aliasing16k: true });
    await expect(write(pipe, 'mm9pdy')).rejects.toThrow();
    expect(sentRt95WriteFrames(pipe)).toEqual([]);
  });

  it('never addresses 0x32A0-0x3FFF or 0x6000 and above on any path', async () => {
    for (const path of PATHS) {
      const pipe = createFakeRt95Pipe();
      await path.run(pipe);
      for (const f of sentRt95WriteFrames(pipe)) {
        expect(f.address > 0x329f && f.address < 0x4000, path.name).toBe(false);
        expect(f.address >= 0x6000, path.name).toBe(false);
      }
    }
  });

  it('the only blocks beyond the CPS write set are the named 0x30F0-0x31FF exception', async () => {
    const pipe = createFakeRt95Pipe();
    await write(pipe, 'stock');
    const sent = new Set(sentRt95WriteFrames(pipe).map((f) => f.address));
    const { start, end } = RT95_STUDIO_EXTRA_WRITE_RANGE;
    // Studio uploads 0x0000-0x3290 contiguously; the CPS skips this gap (F114, F115).
    for (let a = start; a <= end; a += 16) expect(sent.has(a), `0x${a.toString(16)}`).toBe(true);
    // Everything else the stock path sends is a block the CPS sends too.
    expect(sent.size).toBe(0x3290 / 16 + 1);
  });

  it('the checker flags ident, calibration, signature, alias and unaligned or short writes', () => {
    const frame = (address: number, length = 16): Rt95WriteFrame => ({
      address,
      length,
      frameBytes: 4 + length + 2,
    });
    for (const address of [0x32a0, 0x3b00, 0x3b10, 0x3ff0, 0x6000, 0x7b00]) {
      expect(
        rt95WriteRangeViolations([frame(address)], 'mm9pdy'),
        `0x${address.toString(16)}`,
      ).toHaveLength(1);
    }
    expect(rt95WriteRangeViolations([frame(0x4000)], 'stock')).toHaveLength(1);
    expect(rt95WriteRangeViolations([frame(0x3201)], 'stock').length).toBeGreaterThan(0);
    expect(rt95WriteRangeViolations([frame(0x3200, 8)], 'stock').length).toBeGreaterThan(0);
    expect(rt95WriteRangeViolations([frame(0x3290), frame(0x4000)], 'mm9pdy')).toEqual([]);
  });

  it('0x30F0-0x31FF is allowed only because of the named Studio exception', () => {
    const frame = (address: number): Rt95WriteFrame => ({ address, length: 16, frameBytes: 22 });
    const allowed = RT95_GOLDEN_ALLOWED_WRITE_SET.stock;
    expect(rt95WriteRangeViolations([frame(0x3100)], 'stock')).toEqual([]);
    expect(allowed).toContain(RT95_STUDIO_EXTRA_WRITE_RANGE);
    for (const r of RT95_CPS_WRITE_RANGES) {
      expect(0x3100 >= r.start && 0x3100 <= r.end).toBe(false);
    }
    expect(rt95WriteRangeViolations([frame(0x30f0), frame(0x31f0)], 'stock')).toEqual([]);
    expect(rt95WriteRangeViolations([frame(0x3200)], 'stock')).toEqual([]);
  });
});
