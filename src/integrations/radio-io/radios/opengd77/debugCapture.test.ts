import { describe, expect, it } from 'vitest';
import { packRadioBackupZip, parseRadioBackupZip } from '../../backup/index.ts';
import { RadioAbortedError, RadioTimeoutError, RadioWrongIdentError } from '../../kit/errors.ts';
import { getRadioDescriptor } from '../../registry.ts';
import {
  OPENGD77_BACKUP_FLASH_SPANS,
  OPENGD77_BACKUP_USER_DATABASE_ID,
} from './backupRestoreRoles.ts';
import {
  OPENGD77_CALIBRATION_ADDRESS,
  OPENGD77_CALIBRATION_REGION_ID,
  OPENUV380_USER_DB_HEADER_ABS,
} from './constants.ts';
import { classifyOpenGd77DebugFrame, OpenGd77DebugRefusedError } from './debugGuard.ts';
import type { OpenGd77Protocol } from './protocol.ts';
import {
  buildOpenGd77DebugArchiveParts,
  captureOpenGd77DebugPipe,
  OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR,
} from './debugCapture.ts';
import { OPENGD77_DM1701_MODEL_ID, OPENGD77_MD9600_MODEL_ID } from './hydration.ts';
import { OpenGd77ScriptedPipe } from './__fixtures__/scriptedPipe.ts';

const CASES: [string, string, number][] = [
  ['DM-1701', OPENGD77_DM1701_MODEL_ID, 0x08],
  ['DM-1701 RGB', OPENGD77_DM1701_MODEL_ID, 0x0a],
  ['MD-9600', OPENGD77_MD9600_MODEL_ID, 0x05],
];

const opts = { signal: undefined };

describe.each(CASES)('captureOpenGd77DebugPipe on %s (type 0x%s)', (_name, modelId, radioType) => {
  const descriptor = getRadioDescriptor(modelId)!;

  it('sends only allow-listed frames: ping, show CPS, close CPS and no control', async () => {
    const pipe = new OpenGd77ScriptedPipe(radioType);
    pipe.plantByte(0x80, 0x42);
    const capture = await captureOpenGd77DebugPipe(pipe, descriptor, opts);
    expect(pipe.writes.length).toBeGreaterThan(100);
    for (const frame of pipe.writes) {
      expect(classifyOpenGd77DebugFrame(frame).allowed, `frame ${frame[0]}`).toBe(true);
      expect([0x58, 0x57, 0x44]).not.toContain(frame[0]);
    }
    expect(pipe.controls).toEqual([]);
    expect(pipe.commands).toEqual(
      [
        [0xfe, undefined],
        [0x00, undefined],
        [0x05, undefined],
      ].map(([a, b]) => (b === undefined ? [a] : [a, b])),
    );
    expect(pipe.cpsDepth).toBe(0);
    expect(capture.modelId).toBe(descriptor.modelIds[0]);
    expect(capture.firmwareInfoRaw).toHaveLength(46);
  });

  it('packs an inspect-only known-map-regions archive with the FirmwareInfo sidecar', async () => {
    const pipe = new OpenGd77ScriptedPipe(radioType);
    const capture = await captureOpenGd77DebugPipe(pipe, descriptor, {
      capturedVia: 'android-usb-serial',
      includeUserDatabase: true,
    });
    const { manifest, regions, sidecars } = buildOpenGd77DebugArchiveParts(capture);
    expect(manifest.coverage).toBe('known-map-regions');
    expect(manifest.capturedVia).toBe('android-usb-serial');
    expect(manifest.serial).toBeUndefined();
    expect(manifest.firmware).toBe('R20240101000000');
    expect(manifest.regions.map((r) => r.id)).toEqual([
      ...OPENGD77_BACKUP_FLASH_SPANS.map((s) => s.id),
      OPENGD77_BACKUP_USER_DATABASE_ID,
      OPENGD77_CALIBRATION_REGION_ID,
    ]);
    expect(manifest.regions.every((r) => r.restoreRole === 'inspect-only')).toBe(true);
    for (const span of OPENGD77_BACKUP_FLASH_SPANS) {
      const region = manifest.regions.find((r) => r.id === span.id)!;
      expect([region.address, region.byteLength]).toEqual([span.start, span.length]);
    }
    const db = manifest.regions.find((r) => r.id === OPENGD77_BACKUP_USER_DATABASE_ID)!;
    expect(db.address).toBe(OPENUV380_USER_DB_HEADER_ABS);
    // An empty scripted flash has no `Id` header: the 12 raw bytes are kept.
    expect(db.byteLength).toBe(12);
    expect(sidecars[OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]).toEqual(capture.firmwareInfoRaw);

    const zip = packRadioBackupZip(manifest, regions, sidecars);
    const reopened = parseRadioBackupZip(zip);
    expect(reopened.manifest.radioModelId).toBe(descriptor.modelIds[0]);
    expect(reopened.sidecars[OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]).toHaveLength(46);
  });

  it('skips only the User Database unless asked for it', async () => {
    const readsUserDb = (frames: readonly Uint8Array[]) =>
      frames.some((frame) => {
        if (frame[0] !== 0x52 || frame.length < 8) return false;
        const address =
          ((frame[2]! << 24) | (frame[3]! << 16) | (frame[4]! << 8) | frame[5]!) >>> 0;
        return (
          address >= OPENUV380_USER_DB_HEADER_ABS && address < OPENUV380_USER_DB_HEADER_ABS + 12
        );
      });
    const skipped = new OpenGd77ScriptedPipe(radioType);
    const capture = await captureOpenGd77DebugPipe(skipped, descriptor);
    expect(capture.userDatabase).toBeUndefined();
    expect(readsUserDb(skipped.writes)).toBe(false);
    const { manifest } = buildOpenGd77DebugArchiveParts(capture);
    expect(manifest.regions.map((r) => r.id)).toEqual([
      ...OPENGD77_BACKUP_FLASH_SPANS.map((s) => s.id),
      OPENGD77_CALIBRATION_REGION_ID,
    ]);
    expect(skipped.cpsDepth).toBe(0);

    const included = new OpenGd77ScriptedPipe(radioType);
    await captureOpenGd77DebugPipe(included, descriptor, { includeUserDatabase: true });
    expect(readsUserDb(included.writes)).toBe(true);
  });

  it('captures the planted flash byte in the first span', async () => {
    const pipe = new OpenGd77ScriptedPipe(radioType);
    pipe.plantByte(0x80, 0x42);
    const capture = await captureOpenGd77DebugPipe(pipe, descriptor);
    const { regions } = buildOpenGd77DebugArchiveParts(capture);
    expect(regions['flash-span-0']![0]).toBe(0x42);
  });
});

describe.each(CASES)('calibration working copy on %s (type 0x%s)', (_name, modelId, radioType) => {
  const descriptor = getRadioDescriptor(modelId)!;
  const hex = (frame: Uint8Array) =>
    Array.from(frame, (b) => b.toString(16).padStart(2, '0')).join(' ');

  it('reads 16 aligned blocks right after show CPS, before the flash spans', async () => {
    const pipe = new OpenGd77ScriptedPipe(radioType);
    pipe.plantByte(0x10000, 0x11);
    pipe.plantByte(0x101ff, 0x22);
    const capture = await captureOpenGd77DebugPipe(pipe, descriptor);
    const frames = pipe.writes.map(hex);
    const first = frames.indexOf('52 01 00 01 00 00 00 20');
    expect(frames.slice(0, first)).toEqual(['43 fe', '52 09 00 00 00 00 00 2e', '43 00']);
    const expected = Array.from({ length: 16 }, (_, i) => {
      const a = 0x10000 + i * 32;
      return `52 01 00 01 ${((a >> 8) & 0xff).toString(16).padStart(2, '0')} ${(a & 0xff)
        .toString(16)
        .padStart(2, '0')} 00 20`;
    });
    expect(frames.slice(first, first + 16)).toEqual(expected);
    expect(frames.filter((f) => f.startsWith('52 01 00 01 0')).length).toBe(16);
    expect(capture.calibrationWorkingCopy).toHaveLength(512);
    expect(capture.calibrationWorkingCopy[0]).toBe(0x11);
    expect(capture.calibrationWorkingCopy[511]).toBe(0x22);
  });

  it('stores an inspect-only 512-byte region at 0x10000', async () => {
    const capture = await captureOpenGd77DebugPipe(new OpenGd77ScriptedPipe(radioType), descriptor);
    const { manifest, regions } = buildOpenGd77DebugArchiveParts(capture);
    const region = manifest.regions.find((r) => r.id === OPENGD77_CALIBRATION_REGION_ID)!;
    expect([region.address, region.byteLength, region.restoreRole, region.path]).toEqual([
      OPENGD77_CALIBRATION_ADDRESS,
      512,
      'inspect-only',
      'regions/calibration-working-copy.bin',
    ]);
    expect(region.label).toMatch(/not stock factory calibration/);
    expect(regions[OPENGD77_CALIBRATION_REGION_ID]).toHaveLength(512);
  });

  it.each([
    ['refused', (p: OpenGd77ScriptedPipe) => p.failReadsAt.add(0x10000 + 32 * 5)],
    ['short', (p: OpenGd77ScriptedPipe) => p.shortReadsAt.add(0x10000 + 32 * 5)],
    ['silent', (p: OpenGd77ScriptedPipe) => p.silentReadsAt.add(0x10000 + 32 * 5)],
  ])('a %s calibration read fails the capture with no archive', async (_kind, arrange) => {
    const pipe = new OpenGd77ScriptedPipe(radioType);
    arrange(pipe);
    await expect(captureOpenGd77DebugPipe(pipe, descriptor)).rejects.toThrow();
    expect(pipe.commands).toEqual([[0xfe], [0x00], [0x05]]);
    expect(pipe.cpsDepth).toBe(0);
    // Failed early: no flash span was read.
    expect(
      pipe.writes.some((w) => w[0] === 0x52 && w[1] === 0x01 && w[2] === 0 && w[3] === 0),
    ).toBe(false);
  });
});

describe('wrong radio', () => {
  it.each([
    [OPENGD77_DM1701_MODEL_ID, 0x05],
    [OPENGD77_MD9600_MODEL_ID, 0x08],
    [OPENGD77_MD9600_MODEL_ID, 0x0a],
  ])('%s refuses radio type 0x%s before show CPS', async (modelId, radioType) => {
    const pipe = new OpenGd77ScriptedPipe(radioType);
    await expect(captureOpenGd77DebugPipe(pipe, getRadioDescriptor(modelId)!)).rejects.toThrow(
      new RegExp(`radioType 0x${radioType.toString(16)}`),
    );
    await expect(
      captureOpenGd77DebugPipe(new OpenGd77ScriptedPipe(radioType), getRadioDescriptor(modelId)!),
    ).rejects.toBeInstanceOf(RadioWrongIdentError);
    expect(pipe.commands).toEqual([[0xfe]]);
    expect(pipe.writes.every((w) => w[0] === 0x43 || w[1] === 0x09)).toBe(true);
    expect(pipe.cpsDepth).toBe(0);
  });
});

describe('failures return no archive and only close CPS follows', () => {
  const descriptor = getRadioDescriptor(OPENGD77_DM1701_MODEL_ID)!;
  const expectClosed = (pipe: OpenGd77ScriptedPipe) => {
    expect(pipe.commands).toEqual([[0xfe], [0x00], [0x05]]);
    expect(pipe.controls).toEqual([]);
    expect(pipe.cpsDepth).toBe(0);
    expect(pipe.writes.some((w) => w[0] === 0x58 || w[0] === 0x57)).toBe(false);
  };

  it('a refused read', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    pipe.failReadsAt.add(0x80 + 32 * 3);
    await expect(captureOpenGd77DebugPipe(pipe, descriptor)).rejects.toThrow();
    expectClosed(pipe);
  });

  it('a short read', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    pipe.shortReadsAt.add(0x80 + 32 * 3);
    await expect(captureOpenGd77DebugPipe(pipe, descriptor)).rejects.toThrow();
    expectClosed(pipe);
  });

  it('a silent read (timeout)', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    pipe.silentReadsAt.add(0x80 + 32 * 3);
    await expect(captureOpenGd77DebugPipe(pipe, descriptor)).rejects.toBeInstanceOf(
      RadioTimeoutError,
    );
    expectClosed(pipe);
  });

  it('cancel mid-read sends nothing but the CPS close', async () => {
    const controller = new AbortController();
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const original = pipe.write.bind(pipe);
    let reads = 0;
    pipe.write = async (data: Uint8Array) => {
      if (data[0] === 0x52 && data[1] === 0x01 && ++reads === 5) controller.abort();
      return original(data);
    };
    await expect(
      captureOpenGd77DebugPipe(pipe, descriptor, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(RadioAbortedError);
    expectClosed(pipe);
  });

  it('cancel before the first frame sends nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    const pipe = new OpenGd77ScriptedPipe(0x08);
    await expect(
      captureOpenGd77DebugPipe(pipe, descriptor, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(RadioAbortedError);
    expect(pipe.writes).toEqual([]);
  });
});

describe('captureOpenGd77DebugPipe guard wiring', () => {
  const descriptor = getRadioDescriptor(OPENGD77_DM1701_MODEL_ID)!;

  it('hands the protocol the guard pipe: a forbidden frame never reaches the transport', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const forbidden = new Uint8Array([0x58, 0x00]);
    const fake = {
      ...descriptor,
      protocolFactory: () => {
        const radio = descriptor.protocolFactory() as InstanceType<typeof OpenGd77Protocol>;
        radio.connect = async (p) => {
          await p.write(forbidden);
          throw new Error('guard let a forbidden frame through');
        };
        return radio;
      },
    };
    await expect(captureOpenGd77DebugPipe(pipe, fake)).rejects.toBeInstanceOf(
      OpenGd77DebugRefusedError,
    );
    expect(pipe.writes).toEqual([]);
  });

  it('closes the transport when the descriptor returns an unexpected protocol', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    let closed = 0;
    pipe.close = async () => {
      closed++;
    };
    const fake = { ...descriptor, protocolFactory: () => ({}) as never };
    await expect(captureOpenGd77DebugPipe(pipe, fake)).rejects.toThrow(/unexpected protocol/);
    expect(closed).toBe(1);
  });
});
