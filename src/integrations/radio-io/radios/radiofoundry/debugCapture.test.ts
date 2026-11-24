import { describe, expect, it } from 'vitest';
import { packRadioBackupZip, parseRadioBackupZip } from '../../backup/index.ts';
import { DebugWrongFirmwareError } from '../../debugHandoff.ts';
import { RadioAbortedError, RadioProtocolError, RadioWrongIdentError } from '../../kit/errors.ts';
import { decodeDebugFrame } from '../../kit/codecs/radioFoundryDebugLink.ts';
import { stageRecorder } from '../../plannedStagesTestKit.ts';
import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import {
  BLOCK_SIZE,
  CODEPLUG_COMMAND,
  EEPROM_IMAGE_END,
  FLASH_IMAGE_START,
  OP_READ,
  OP_SUMS,
} from './constants.ts';
import {
  DM32UV_RADIOFOUNDRY_CABLE_BOARD,
  MD9600_RADIOFOUNDRY_CABLE_BOARD,
  type RadioFoundryCableBoard,
} from './board.ts';
import { classifyRadioFoundryDebugFrame } from './debugGuard.ts';
import {
  buildRadioFoundryDebugArchiveParts,
  captureRadioFoundryDebugPipe,
  RADIOFOUNDRY_DEBUG_INFO_SIDECAR,
  RADIOFOUNDRY_REGION,
} from './debugCapture.ts';
import {
  RADIOFOUNDRY_DEBUG_HOTSPOT_HINT,
  RADIOFOUNDRY_DEBUG_NO_ANSWER,
  RADIOFOUNDRY_DEBUG_OPENGD77_FOUND,
} from './debugText.ts';
import { DMR_ID_DATABASE_AREA2_ADDRESS } from './idDatabase.ts';
import {
  FakeRadioFoundryRadio,
  type FakeRadioFoundryOptions,
} from './__fixtures__/fakeRadioFoundryRadio.ts';

const protocolOpts = { protocolOptions: { pause: async () => {} } };

function versionTextFor(board: RadioFoundryCableBoard): string {
  return `proto=1\ngit=454a5b76\nboard=${board.versionBoardNames[0]}\nfeatures=\n`;
}

function fakeFor(board: RadioFoundryCableBoard, opts: FakeRadioFoundryOptions = {}) {
  return new FakeRadioFoundryRadio({
    imageEnd: board.limits.IMAGE_END,
    physicalBase: board.limits.PHYSICAL_CODEPLUG_BASE,
    versionText: versionTextFor(board),
    ...opts,
  });
}

function sumsAddresses(writes: readonly Uint8Array[]): number[] {
  const out: number[] = [];
  for (const raw of writes) {
    const frame = decodeDebugFrame(raw);
    if (frame.command !== CODEPLUG_COMMAND || frame.payload[0] !== OP_SUMS) continue;
    const addr =
      (frame.payload[1]! |
        (frame.payload[2]! << 8) |
        (frame.payload[3]! << 16) |
        (frame.payload[4]! << 24)) >>>
      0;
    out.push(addr);
  }
  return out;
}

function readAddresses(writes: readonly Uint8Array[]): number[] {
  const out: number[] = [];
  for (const raw of writes) {
    const frame = decodeDebugFrame(raw);
    if (frame.command !== CODEPLUG_COMMAND || frame.payload[0] !== OP_READ) continue;
    const addr =
      (frame.payload[1]! |
        (frame.payload[2]! << 8) |
        (frame.payload[3]! << 16) |
        (frame.payload[4]! << 24)) >>>
      0;
    out.push(addr);
  }
  return out;
}

describe('captureRadioFoundryDebugPipe', () => {
  it('reports Connect, Codeplug and ID database stages in order', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, { fill: 0xaa });
    const rec = stageRecorder();
    await captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      includeArea2: true,
      onProgress: rec.onProgress,
    });
    expect(rec.stages).toEqual(['Connect', 'Codeplug', 'ID database']);
  });

  it('skips area-2 SUMS unless includeArea2', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD);
    await captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, protocolOpts);
    expect(sumsAddresses(pipe.writes).some((a) => a >= DMR_ID_DATABASE_AREA2_ADDRESS)).toBe(false);

    const withArea = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD);
    await captureRadioFoundryDebugPipe(withArea, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      includeArea2: true,
    });
    const area2Sums = sumsAddresses(withArea.writes).filter(
      (a) => a >= DMR_ID_DATABASE_AREA2_ADDRESS,
    );
    expect(area2Sums.length).toBeGreaterThan(100);
    expect(
      readAddresses(withArea.writes).every(
        (a) => a < DMR_ID_DATABASE_AREA2_ADDRESS || !withArea.block(a).every((b) => b === 0xff),
      ),
    ).toBe(true);
  });

  it('stops area 2 at the board image end', async () => {
    const dm32 = fakeFor(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await captureRadioFoundryDebugPipe(dm32, DM32UV_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      includeArea2: true,
    });
    expect(Math.max(...sumsAddresses(dm32.writes))).toBeLessThan(0x800000);

    const md = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD);
    await captureRadioFoundryDebugPipe(md, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      includeArea2: true,
    });
    expect(Math.max(...sumsAddresses(md.writes))).toBeLessThan(0xe00000);
  });

  it('lowers the guard ceiling when INFO image end is below the board', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, { imageEnd: 0x90000 });
    await captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      includeArea2: true,
    });
    expect(sumsAddresses(pipe.writes).every((a) => a + BLOCK_SIZE <= 0x90000 || a < 0x20000)).toBe(
      true,
    );
  });

  it('never READs blank blocks', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, { fill: 0xff });
    await captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, protocolOpts);
    expect(readAddresses(pipe.writes)).toEqual([]);
  });

  it('rejects CRC mismatch and closes the port', async () => {
    const pipe = fakeFor(DM32UV_RADIOFOUNDRY_CABLE_BOARD, { fill: 0x5a });
    const bad = new Map<number, number>([[0, 0]]);
    pipe.sumsCrcOverride = bad;
    await expect(
      captureRadioFoundryDebugPipe(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD, protocolOpts),
    ).rejects.toBeInstanceOf(RadioProtocolError);
    expect(pipe.closed).toBe(true);
  });

  it('rejects cancel mid-read and closes the port', async () => {
    const ac = new AbortController();
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, { fill: 0x11 });
    const task = captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      signal: ac.signal,
      onProgress: (p) => {
        if (p.stage === 'Codeplug' && (p.cur ?? 0) > 1) ac.abort();
      },
    });
    await expect(task).rejects.toBeInstanceOf(RadioAbortedError);
    expect(pipe.closed).toBe(true);
  });

  it('succeeds without iddb when IDDB status is 4', async () => {
    const pipe = fakeFor(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    pipe.iddbStatus = 4;
    const capture = await captureRadioFoundryDebugPipe(
      pipe,
      DM32UV_RADIOFOUNDRY_CABLE_BOARD,
      protocolOpts,
    );
    expect(capture.iddb).toBeUndefined();
    expect(capture.codeplug.size).toBeGreaterThan(0);
  });

  it('sends only allow-listed frames on a full capture with area 2', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, { fill: 0x42 });
    await captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      includeArea2: true,
    });
    const ceiling = 0xe00000;
    for (const raw of pipe.writes) {
      const cls = classifyRadioFoundryDebugFrame(raw, ceiling);
      expect(cls.allowed, JSON.stringify(Array.from(raw.slice(0, 12)))).toBe(true);
      if (cls.allowed) {
        expect(['info', 'version', 'sums', 'read', 'iddb']).toContain(cls.kind);
      }
    }
  });

  it('buildRadioFoundryDebugArchiveParts round-trips through pack and parse', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, { fill: 0x33 });
    pipe.setBlock(
      0x20000,
      Uint8Array.from({ length: BLOCK_SIZE }, (_, i) => i & 0xff),
    );
    const capture = await captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      includeArea2: true,
    });
    const { manifest, regions, sidecars } = buildRadioFoundryDebugArchiveParts(capture);
    const eeprom = manifest.regions.find((r) => r.id === RADIOFOUNDRY_REGION.eeprom)!;
    const flash = manifest.regions.find((r) => r.id === RADIOFOUNDRY_REGION.flash)!;
    expect(eeprom.byteLength).toBe(EEPROM_IMAGE_END);
    expect(flash.byteLength).toBe(RADIOFOUNDRY_IMAGE_SIZE - FLASH_IMAGE_START);
    expect(manifest.coverage).toBe('partial');
    expect(manifest.regions.every((r) => r.restoreRole === 'inspect-only')).toBe(true);
    const zip = packRadioBackupZip(manifest, regions, sidecars);
    const reopened = parseRadioBackupZip(zip);
    expect(reopened.manifest.radioModelId).toBe(MD9600_RADIOFOUNDRY_CABLE_BOARD.modelId);
    expect(reopened.sidecars[RADIOFOUNDRY_DEBUG_INFO_SIDECAR]).toEqual(capture.info);

    const rows = sidecars['debug/sums.bin']!;
    expect(rows.length % 9).toBe(0);
    expect(rows.length / 9).toBe(capture.codeplug.size + (capture.area2?.size ?? 0));
  });

  it('dash handshake is OpenGD77 evidence and can keep the port', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, { fill: 0xff });
    pipe.dash = true;
    await expect(
      captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, protocolOpts),
    ).rejects.toMatchObject({
      name: 'DebugWrongFirmwareError',
      found: 'opengd77',
      message: RADIOFOUNDRY_DEBUG_OPENGD77_FOUND,
    });
    expect(pipe.writes).toHaveLength(1);
    expect(pipe.closed).toBe(true);

    const kept = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, { fill: 0xff });
    kept.dash = true;
    let err: DebugWrongFirmwareError | undefined;
    try {
      await captureRadioFoundryDebugPipe(kept, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
        ...protocolOpts,
        keepPortOnOpenGd77: true,
      });
    } catch (e) {
      err = e as DebugWrongFirmwareError;
    }
    expect(err?.port?.pipe).toBe(kept);
    expect(err?.received).toEqual(new Uint8Array([0x2d]));
    expect(kept.closed).toBe(false);
  });

  it('silent MD-9600 is unknown with a hotspot hint and always closes', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD);
    pipe.silent = true;
    await expect(
      captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
        ...protocolOpts,
        keepPortOnOpenGd77: true,
      }),
    ).rejects.toMatchObject({
      found: 'unknown',
      message: `${RADIOFOUNDRY_DEBUG_NO_ANSWER} ${RADIOFOUNDRY_DEBUG_HOTSPOT_HINT}`,
    });
    expect(pipe.closed).toBe(true);
  });

  it('silent DM-32UV is unknown without a hotspot hint', async () => {
    const pipe = fakeFor(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    pipe.silent = true;
    await expect(
      captureRadioFoundryDebugPipe(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD, protocolOpts),
    ).rejects.toMatchObject({
      found: 'unknown',
      message: RADIOFOUNDRY_DEBUG_NO_ANSWER,
    });
    expect(pipe.closed).toBe(true);
  });

  it('wrong physical base stays RadioWrongIdentError', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      physicalBase: MD9600_RADIOFOUNDRY_CABLE_BOARD.limits.PHYSICAL_CODEPLUG_BASE + 0x1000,
    });
    await expect(
      captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, protocolOpts),
    ).rejects.toBeInstanceOf(RadioWrongIdentError);
  });

  it('omits iddb-area2 when every area-2 block is blank', async () => {
    const pipe = fakeFor(MD9600_RADIOFOUNDRY_CABLE_BOARD, { fill: 0xff });
    const capture = await captureRadioFoundryDebugPipe(pipe, MD9600_RADIOFOUNDRY_CABLE_BOARD, {
      ...protocolOpts,
      includeArea2: true,
    });
    const { manifest } = buildRadioFoundryDebugArchiveParts(capture);
    expect(manifest.regions.some((r) => r.id === RADIOFOUNDRY_REGION.area2)).toBe(false);
  });
});
