import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenGd77ScriptedPipe } from '@integrations/radio-io/radios/opengd77/__fixtures__/scriptedPipe.ts';
import {
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
} from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { archiveOpenGd77Capture, captureOpenGd77 } from './opengd77Capture.ts';
import { syntheticOpenGd77Archive, syntheticOpenGd77Capture } from './opengd77.fixture.ts';

const transport = vi.hoisted(() => ({
  native: false,
  pipe: undefined as undefined | import('@integrations/radio-io/types.ts').BytePipe,
  baud: [] as (number | undefined)[],
}));
vi.mock('@integrations/radio-io/transport/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@integrations/radio-io/transport/index.ts')>()),
  isCapacitorSerialSupported: () => transport.native,
  requestCapacitorSerialPort: vi.fn(async () => ({})),
  openCapacitorSerialPipe: vi.fn(async (device: unknown, baud?: number) => {
    transport.baud.push(baud);
    return device ? transport.pipe : undefined;
  }),
  requestWebSerialPort: vi.fn(async () => ({})),
  openWebSerialPipe: vi.fn(async (port: unknown, baud?: number) => {
    transport.baud.push(baud);
    return port ? transport.pipe : undefined;
  }),
}));

beforeEach(() => {
  transport.native = false;
  transport.baud = [];
});

describe('archiveOpenGd77Capture', () => {
  it.each([OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID])(
    'packs %s as a reopenable live-read archive',
    async (modelId) => {
      const archive = await archiveOpenGd77Capture(syntheticOpenGd77Capture(modelId));
      expect(archive.source).toBe('live-read');
      expect(archive.manifest.radioModelId).toBe(modelId);
      expect(archive.manifest.coverage).toBe('known-map-regions');
      expect(archive.manifest.regions.map((r) => r.id)).toEqual([
        'flash-span-0',
        'flash-span-1',
        'flash-span-2',
        'flash-span-3',
        'user-database',
        'calibration-working-copy',
      ]);
      expect(archive.manifest.regions.every((r) => r.restoreRole === 'inspect-only')).toBe(true);
      expect(archive.regions['flash-span-0']!.subarray(0, 3)).toEqual(
        new Uint8Array([0x53, 0x59, 0x4e]),
      );
      expect(archive.regions['user-database']).toHaveLength(12 + 2 * 27);
      expect(archive.sidecars['debug/firmware-info.bin']).toHaveLength(46);
    },
  );

  it('keeps the 12 header bytes when there are no entries', async () => {
    const archive = await syntheticOpenGd77Archive(OPENGD77_DM1701_MODEL_ID, {
      userDatabaseEntries: 0,
    });
    expect(archive.regions['user-database']).toHaveLength(12);
  });
});

describe('captureOpenGd77', () => {
  it.each([
    [OPENGD77_DM1701_MODEL_ID, 0x08],
    [OPENGD77_MD9600_MODEL_ID, 0x05],
  ])('reads %s over Web Serial and records the transport', async (modelId, radioType) => {
    transport.pipe = new OpenGd77ScriptedPipe(radioType);
    const archive = await captureOpenGd77(modelId)();
    expect(archive.manifest.capturedVia).toBe('web-serial');
    expect(archive.manifest.radioModelId).toBe(modelId);
    expect(transport.baud).toEqual([115_200]);
  });

  it('records Android USB serial when the native transport is used', async () => {
    transport.native = true;
    transport.pipe = new OpenGd77ScriptedPipe(0x08);
    const archive = await captureOpenGd77(OPENGD77_DM1701_MODEL_ID)();
    expect(archive.manifest.capturedVia).toBe('android-usb-serial');
  });

  it('rejects an unknown model without opening a port', async () => {
    await expect(captureOpenGd77('NOT-A-RADIO')()).rejects.toThrow(/No radio descriptor/);
    expect(transport.baud).toEqual([]);
  });
});
