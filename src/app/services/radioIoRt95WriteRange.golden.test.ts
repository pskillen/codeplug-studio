/**
 * Golden write-range test, app level (#1465): run each RT95 write entry point the UI calls through
 * the fake cable, and check every `W` frame it sent against the allowed set in the write-range
 * kit. The entry points decide which blocks the protocol is asked to send (the MMD1 intent, the
 * settings patches, the zone key, the pre-write read and chip guard), so a regression there shows
 * here even when the protocol layer is unchanged. The protocol's own limits are pinned by
 * `writeRange.golden.test.ts` beside the protocol.
 *
 * Entry points: `uploadPreparedRadioWrite` (stock and MM9PDY Write, with and without settings and
 * the MM9PDY zone key), `writeRt95SettingsOnly`, and `restoreRadioBackup`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/types.ts';
import { memoryMapFromBytes } from '@integrations/radio-io/kit/memoryMap.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import { RT95_IMAGE_SIZE, RT95_MODEL_ID } from '@integrations/radio-io/radios/rt95/constants.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import {
  createFakeRt95Pipe,
  type FakeRt95Pipe,
} from '@integrations/radio-io/radios/rt95/__fixtures__/fakeRt95Pipe.ts';
import { rt95OverridesAt } from '@integrations/radio-io/radios/rt95/__fixtures__/settingsFixtures.ts';
import {
  rt95WriteRangeViolations,
  sentRt95WriteFrames,
  type Rt95WriteTarget,
} from '@integrations/radio-io/radios/rt95/__fixtures__/writeRangeKit.ts';
import {
  Rt95Protocol,
  setRt95EndAtForTests,
  setRt95RetryTuningForTests,
} from '@integrations/radio-io/radios/rt95/protocol.ts';
import { RT95_PROGRAMMING_IMAGE_REGION_ID } from '@integrations/radio-io/radios/rt95/restoreFromBackup.ts';
import { restoreRadioBackup } from './radioBackupRestore.ts';
import { writeRt95SettingsOnly } from './radioIoRt95SettingsWrite.ts';
import { uploadPreparedRadioWrite } from './radioIoSession.ts';

const STOCK = 'radio-io-rt95';
const MM9PDY = 'radio-io-rt95-mm9pdy';

const channel: RadioChannelDto = {
  slotIndex: 1,
  empty: false,
  wireName: 'TEST01',
  description: 'Calling ch',
  rxHz: 146_520_000,
  txHz: 146_520_000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: 100,
  bandwidth: 'FM',
};

const zones = [{ wireName: 'LOCAL', channelNumbers: [1] }];

async function open(
  profileId: string,
  pipeOpts: Parameters<typeof createFakeRt95Pipe>[0] = {},
  connectOpts?: { handshake: 'none' },
) {
  const pipe = createFakeRt95Pipe(pipeOpts);
  const radio = new Rt95Protocol();
  await radio.connect(pipe, connectOpts);
  const session: RadioSession = { descriptor: RT95_DESCRIPTOR, pipe, radio };
  const { egress } = newRadioBuildForProfile('p1', profileId);
  return { pipe, session, egress };
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

interface AppPath {
  name: string;
  target: Rt95WriteTarget;
  /** True when the path is meant to put MMD1 blocks (0x4000-0x5FFF) on the cable. */
  mmd1: boolean;
  run: () => Promise<FakeRt95Pipe>;
}

const APP_PATHS: AppPath[] = [
  {
    name: 'stock Write',
    target: 'stock',
    mmd1: false,
    async run() {
      const { pipe, session, egress } = await open(STOCK);
      await uploadPreparedRadioWrite(session, egress, undefined, { channels: [channel] });
      return pipe;
    },
  },
  {
    name: 'stock Write with every setting',
    target: 'stock',
    mmd1: false,
    async run() {
      const { pipe, session, egress } = await open(STOCK);
      await uploadPreparedRadioWrite(session, egress, undefined, {
        channels: [channel],
        rt95SettingsOverrides: rt95OverridesAt('first'),
        beforeTransmit: async () => 'apply',
      });
      return pipe;
    },
  },
  {
    name: 'stock Write with a zone key and zones present',
    target: 'stock',
    mmd1: false,
    async run() {
      // The stock profile never carries MM9PDY data, even when the organisation holds it.
      const { pipe, session, egress } = await open(STOCK);
      await uploadPreparedRadioWrite(session, egress, undefined, {
        channels: [channel],
        organisation: { zones, rt95ZoneKey: { group: 1, key: 1 } },
      });
      return pipe;
    },
  },
  {
    name: 'MM9PDY Write',
    target: 'mm9pdy',
    mmd1: true,
    async run() {
      const { pipe, session, egress } = await open(MM9PDY);
      await uploadPreparedRadioWrite(session, egress, undefined, {
        channels: [channel],
        organisation: { writeRt95ModData: true, zones },
      });
      return pipe;
    },
  },
  {
    name: 'MM9PDY Write with every setting',
    target: 'mm9pdy',
    mmd1: true,
    async run() {
      const { pipe, session, egress } = await open(MM9PDY);
      await uploadPreparedRadioWrite(session, egress, undefined, {
        channels: [channel],
        organisation: { writeRt95ModData: true, zones },
        rt95SettingsOverrides: rt95OverridesAt('first'),
        beforeTransmit: async () => 'apply',
      });
      return pipe;
    },
  },
  {
    name: 'MM9PDY Write with settings and the zone key',
    target: 'mm9pdy',
    mmd1: true,
    async run() {
      const { pipe, session, egress } = await open(MM9PDY);
      await uploadPreparedRadioWrite(session, egress, undefined, {
        channels: [channel],
        organisation: { writeRt95ModData: true, zones, rt95ZoneKey: { group: 1, key: 1 } },
        rt95SettingsOverrides: rt95OverridesAt('first'),
        beforeTransmit: async () => 'apply',
      });
      return pipe;
    },
  },
  {
    name: 'MM9PDY Write without MM9PDY data selected',
    target: 'mm9pdy',
    mmd1: false,
    async run() {
      const { pipe, session, egress } = await open(MM9PDY);
      await uploadPreparedRadioWrite(session, egress, undefined, { channels: [channel] });
      return pipe;
    },
  },
  {
    name: 'settings-only Write (stock)',
    target: 'stock',
    mmd1: false,
    async run() {
      const { pipe, session, egress } = await open(STOCK);
      await writeRt95SettingsOnly(session, egress, rt95OverridesAt('first'), {
        beforeTransmit: async () => 'apply',
      });
      return pipe;
    },
  },
  {
    name: 'settings-only Write (MM9PDY profile)',
    target: 'mm9pdy',
    mmd1: false,
    async run() {
      const { pipe, session, egress } = await open(MM9PDY);
      await writeRt95SettingsOnly(session, egress, rt95OverridesAt('first'), {
        beforeTransmit: async () => 'apply',
      });
      return pipe;
    },
  },
  {
    name: 'Restore',
    target: 'stock',
    mmd1: false,
    async run() {
      const { pipe, session } = await open(STOCK, {}, { handshake: 'none' });
      const image = memoryMapFromBytes(pipe.eeprom.slice(0, RT95_IMAGE_SIZE));
      await restoreRadioBackup(
        session,
        { manifest: backupManifest(), image },
        { regionIds: [RT95_PROGRAMMING_IMAGE_REGION_ID] },
      );
      return pipe;
    },
  },
];

beforeEach(() => {
  setRt95EndAtForTests(0);
  setRt95RetryTuningForTests({ intervalMs: 20, budgetMs: 400, timeoutMs: 10 });
});
afterEach(() => {
  setRt95EndAtForTests(0);
  setRt95RetryTuningForTests({});
});

describe('RT95 golden write range, app entry points (#1465)', () => {
  for (const path of APP_PATHS) {
    it(`${path.name} sends only 16-byte aligned blocks inside the allowed set`, async () => {
      const pipe = await path.run();
      const frames = sentRt95WriteFrames(pipe);
      expect(frames.length).toBeGreaterThan(0);
      expect(rt95WriteRangeViolations(frames, path.target)).toEqual([]);
    });

    it(`${path.name} ${path.mmd1 ? 'sends' : 'never sends'} MM9PDY blocks at 0x4000-0x5FFF`, async () => {
      const pipe = await path.run();
      const high = sentRt95WriteFrames(pipe).filter((f) => f.address >= 0x4000);
      if (path.mmd1) expect(high.length).toBeGreaterThan(0);
      else expect(high).toEqual([]);
    });
  }

  it('stock Write on the stock profile reads nothing at the chip-guard address', async () => {
    const pipe = await APP_PATHS[0]!.run();
    expect(pipe.log.some((e) => e.op === 'R' && e.addr === 0x7b00)).toBe(false);
  });

  it('every MM9PDY Write that sends 0x4000+ blocks reads the chip guard first', async () => {
    for (const path of APP_PATHS.filter((p) => p.mmd1)) {
      const pipe = await path.run();
      const firstMmd1 = pipe.log.findIndex((e) => e.op === 'W' && e.addr! >= 0x4000);
      const lastGuardRead = pipe.log.map((e) => `${e.op} ${e.addr}`).lastIndexOf(`R ${0x7b00}`);
      expect(lastGuardRead, path.name).toBeGreaterThan(-1);
      expect(lastGuardRead, path.name).toBeLessThan(firstMmd1);
    }
  });

  it('a 16 KiB (aliasing) chip stops every MM9PDY Write with no block sent', async () => {
    const { pipe, session, egress } = await open(MM9PDY, { aliasing16k: true });
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, {
        channels: [channel],
        organisation: { writeRt95ModData: true, zones, rt95ZoneKey: { group: 1, key: 1 } },
        rt95SettingsOverrides: rt95OverridesAt('first'),
        beforeTransmit: async () => 'apply',
      }),
    ).rejects.toThrow(/memory is too small for MM9PDY zones and descriptions/);
    expect(sentRt95WriteFrames(pipe)).toEqual([]);
  });
});
