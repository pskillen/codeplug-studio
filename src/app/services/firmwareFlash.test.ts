import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FirmwareError } from '@core/firmware/errors.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import { RADIO_SAFETY_BACKUP_KEY } from '@integrations/persistence/radioSafetyBackupRecords.ts';
import * as radioIo from '@integrations/radio-io';
import {
  FirmwareFlashError,
  RadioTimeoutError,
  RadioWrongIdentError,
  type FirmwareUpdater,
  type SerialPortLike,
} from '@integrations/radio-io';

import {
  formatFirmwareFlashSummary,
  grantFirmwarePort,
  grantFirmwarePreflightPort,
  grantFirmwareRadioReportPort,
  grantFirmwareSafetyBackupPort,
  readFirmwareRadioReport,
  runFirmwareFlash,
  recordFirmwareSafetyBackupSaved,
  runFirmwarePreflightProbe,
  runFirmwareSafetyBackup,
  recordFirmwareSafetyBackupFile,
  verifyStockFiles,
  type FirmwareFlashOutcome,
} from './firmwareFlash.ts';

const pipeClose = vi.fn(async () => {});
const CAPACITOR_DEVICE = vi.hoisted(() => ({
  deviceId: 'dev_1_ab12',
  vendorId: 0x1a86,
  productId: 0x7523,
  deviceName: '/dev/bus/usb/001/002',
  serialNumber: null,
  driverType: 'Ch34xSerialDriver' as const,
  portCount: 1,
  hasPermission: true,
}));
const fakeProbe = {
  title: 'Check the radio',
  steps: ['Switch on.'],
  link: { baudRate: 9600, usbFilters: [], raiseDtrRts: true },
  run: vi.fn(),
};
const fakeSafety = {
  title: 'Safety backup',
  why: 'why',
  steps: ['Switch on.'],
  link: { baudRate: 19200, usbFilters: [], raiseDtrRts: false },
  expectedDuration: '1 minute',
  recordFamily: 'fake-family',
  serialHint: 'On the label.',
  normaliseSerial: (t: string) => t.trim().replace(/\s+/g, ' ').toUpperCase(),
  run: vi.fn(),
  verifyFile: vi.fn(),
};
const fakeUpdater = {
  identify: vi.fn(),
  flash: vi.fn(),
  checkImage: vi.fn(),
};

vi.mock('@integrations/radio-io', async (importOriginal) => {
  const actual = await importOriginal<typeof radioIo>();
  return {
    ...actual,
    openWebSerialPipe: vi.fn(async () => ({
      write: async () => {},
      readExact: async () => new Uint8Array(0),
      close: pipeClose,
    })),
    isCapacitorSerialSupported: vi.fn(() => false),
    requestWebSerialPort: vi.fn(async () => ({ close: vi.fn(async () => {}) })),
    requestCapacitorSerialPort: vi.fn(async () => CAPACITOR_DEVICE),
    openCapacitorSerialPipe: vi.fn(async () => ({
      write: async () => {},
      readExact: async () => new Uint8Array(0),
      close: pipeClose,
    })),
    getFirmwareUpdater: vi.fn((radioId: string) => {
      const real = actual.getFirmwareUpdater(radioId as 'baofeng-dm32uv');
      return (
        real && {
          ...real,
          preflight: { attestations: [], probe: fakeProbe, safetyBackup: fakeSafety },
          createUpdater: () => fakeUpdater as unknown as FirmwareUpdater,
        }
      );
    }),
  };
});

const IMAGE = {
  radioId: 'baofeng-dm32uv',
  provenance: 'stock',
  stockVersion: 'v9.9.9-test',
  title: 'stock firmware v9.9.9-test',
  package: { radioId: 'baofeng-dm32uv', files: {} },
  sha256: { bin: 'ab'.repeat(32) },
  verifyHint: 'Boots.',
} as unknown as PreparedFirmwareImage;

const IDENT = {
  radioId: 'baofeng-dm32uv' as const,
  model: 'MODEL',
  raw: Uint8Array.of(0x41, 0x42),
};

const downloadZip = vi.hoisted(() => vi.fn());
vi.mock('@integrations/download/browserDownload.ts', () => ({ downloadZip }));

const port = { close: vi.fn(async () => {}) } as unknown as SerialPortLike;

function run() {
  return runFirmwareFlash({
    radioId: 'baofeng-dm32uv',
    image: IMAGE,
    port,
    onProgress: () => {},
    signal: new AbortController().signal,
  });
}

describe('runFirmwareFlash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('identifies, flashes and closes the pipe', async () => {
    fakeUpdater.identify.mockResolvedValue(IDENT);
    fakeUpdater.flash.mockResolvedValue({
      framesSent: 10,
      dataFrames: 4,
      elapsedMs: 1200,
      end: 'eot-sent',
    });
    const onIdent = vi.fn();
    const outcome = await runFirmwareFlash({
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      port,
      onIdent,
      onProgress: () => {},
      signal: new AbortController().signal,
    });
    expect(outcome.ok).toBe(true);
    expect(onIdent).toHaveBeenCalledWith(IDENT);
    expect(fakeUpdater.flash).toHaveBeenCalledWith(IMAGE, expect.anything());
    expect(pipeClose).toHaveBeenCalledTimes(1);
  });

  it("opens the pipe with the updater's DTR/RTS choice", async () => {
    fakeUpdater.identify.mockResolvedValue(IDENT);
    fakeUpdater.flash.mockResolvedValue({ framesSent: 1, dataFrames: 1, elapsedMs: 1, end: 'x' });
    await run();
    expect(radioIo.openWebSerialPipe).toHaveBeenCalledWith(port, 115200, { raiseDtrRts: true });
  });

  it('passes radioTouched through on a failure after touch, and still closes', async () => {
    fakeUpdater.identify.mockResolvedValue(IDENT);
    fakeUpdater.flash.mockRejectedValue(
      new FirmwareFlashError({
        cause: new RadioTimeoutError('silent'),
        radioTouched: true,
        position: 'block#57',
      }),
    );
    const outcome = await run();
    expect(outcome).toMatchObject({
      ok: false,
      code: 'timeout',
      position: 'block#57',
      radioTouched: true,
      ident: IDENT,
    });
    expect(pipeClose).toHaveBeenCalledTimes(1);
  });

  it('reports an ident failure as untouched', async () => {
    fakeUpdater.identify.mockRejectedValue(new RadioWrongIdentError('Wrong model.'));
    const outcome = await run();
    expect(outcome).toMatchObject({
      ok: false,
      code: 'wrongIdent',
      position: 'identify',
      radioTouched: false,
    });
    expect(fakeUpdater.flash).not.toHaveBeenCalled();
    expect(pipeClose).toHaveBeenCalledTimes(1);
  });

  it('keeps the last written / total and the elapsed time for the log, success or failure', async () => {
    fakeUpdater.identify.mockResolvedValue(IDENT);
    const report = (done: number) => ({
      phase: 'transfer',
      cur: done,
      max: 32,
      msg: '',
      radioTouched: true,
      written: { done, total: 32, unit: 'blocks' },
    });
    fakeUpdater.flash.mockImplementation(
      async (_image: unknown, o: { onProgress: (p: unknown) => void }) => {
        o.onProgress(report(31));
        o.onProgress(report(32));
        o.onProgress({ phase: 'finish', cur: 0, max: 0, msg: '', radioTouched: true });
        return { framesSent: 34, dataFrames: 32, elapsedMs: 5, end: 'eot-sent' };
      },
    );
    const seen: unknown[] = [];
    const ok = await runFirmwareFlash({
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      port,
      onProgress: (p) => seen.push(p),
      signal: new AbortController().signal,
    });
    expect(seen).toHaveLength(3);
    expect(ok).toMatchObject({ ok: true, written: { done: 32, total: 32, unit: 'blocks' } });

    fakeUpdater.identify.mockResolvedValue(IDENT);
    fakeUpdater.flash.mockImplementation(
      async (_image: unknown, o: { onProgress: (p: unknown) => void }) => {
        o.onProgress(report(3));
        throw new FirmwareFlashError({
          cause: new RadioTimeoutError('silent'),
          radioTouched: true,
          position: 'block#4',
        });
      },
    );
    const failed = await run();
    expect(failed).toMatchObject({
      ok: false,
      written: { done: 3, total: 32, unit: 'blocks' },
      elapsedMs: expect.any(Number),
    });
  });

  it('swallows close errors', async () => {
    fakeUpdater.identify.mockResolvedValue(IDENT);
    fakeUpdater.flash.mockResolvedValue({
      framesSent: 1,
      dataFrames: 0,
      elapsedMs: 1,
      end: 'eot-sent',
    });
    pipeClose.mockRejectedValueOnce(new Error('close failed'));
    await expect(run()).resolves.toMatchObject({ ok: true });
  });
});

describe('formatFirmwareFlashSummary', () => {
  it('summarises a success', () => {
    const outcome: FirmwareFlashOutcome = {
      ok: true,
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      ident: IDENT,
      result: { framesSent: 10, dataFrames: 4, elapsedMs: 1200, end: 'eot-sent' },
      startedAt: '2026-01-01T00:00:00.000Z',
    };
    const text = formatFirmwareFlashSummary(outcome);
    expect(text).toContain('Result: OK');
    expect(text).toContain('Radio: Baofeng DM-32UV');
    expect(text).toContain('Firmware: stock firmware v9.9.9-test');
    expect(text).toContain(`Flashed bin sha256: ${'ab'.repeat(32)}`);
    expect(text).toContain('Bootloader: MODEL (41 42)');
    expect(text).toContain('Frames sent: 10 (4 data)');
    expect(text).toContain('End: eot-sent');
    expect(text).toMatch(/^Studio .+ \(.+\)$/m);
    expect(text).not.toContain('Written:');
  });

  it('adds the final written / total when the updater knows a total', () => {
    const text = formatFirmwareFlashSummary({
      ok: true,
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      ident: IDENT,
      result: { framesSent: 10, dataFrames: 4, elapsedMs: 1200, end: 'eot-sent' },
      startedAt: '2026-01-01T00:00:00.000Z',
      written: { done: 4, total: 4, unit: 'blocks' },
    });
    expect(text).toContain('Written: 4 / 4 blocks');
    expect(text).toContain('Elapsed: 00:01 (1.2 s)');
  });

  it('adds how far a failure got and when it stopped', () => {
    const text = formatFirmwareFlashSummary({
      ok: false,
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      code: 'timeout',
      message: 'silent',
      position: 'block#57',
      radioTouched: true,
      startedAt: '2026-01-01T00:00:00.000Z',
      elapsedMs: 72_000,
      written: { done: 56, total: 478, unit: 'blocks' },
    });
    expect(text).toContain('Elapsed: 01:12 (72.0 s)');
    expect(text).toContain('Written: 56 / 478 blocks');
  });

  it('says "back to stock" for a to-stock patch', () => {
    const text = formatFirmwareFlashSummary({
      ok: true,
      radioId: 'baofeng-dm32uv',
      image: {
        ...IMAGE,
        provenance: 'unreviewed',
        backToStock: true,
        patchSha256: 'cd'.repeat(32),
        patchVersion: '0.1',
      } as PreparedFirmwareImage,
      ident: IDENT,
      result: { framesSent: 10, dataFrames: 4, elapsedMs: 1200, end: 'eot-sent' },
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(text).toContain(
      `Firmware: back to stock, stock firmware v9.9.9-test (user-supplied patch, sha256 ${'cd'.repeat(32)}, version 0.1)`,
    );
  });

  it('adds the elapsed time and frame round-trip timing when measured', () => {
    const text = formatFirmwareFlashSummary({
      ok: true,
      radioId: 'anytone-at-d890uv',
      image: IMAGE,
      ident: IDENT,
      result: {
        framesSent: 52_518,
        dataFrames: 52_515,
        elapsedMs: 125_300,
        end: 'port-closed-by-radio',
        timing: { medianFrameMs: 1.234, p99FrameMs: 3.5, maxFrameMs: 31.25 },
      },
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(text).toContain('Radio: AnyTone AT-D890UV');
    expect(text).toContain('Elapsed: 02:05 (125.3 s)');
    expect(text).toContain('End: port-closed-by-radio');
    expect(text).toContain('Frame round trip: median 1.23 ms, p99 3.50 ms, max 31.3 ms');
  });

  it('adds frame timing to a failure when measured', () => {
    const text = formatFirmwareFlashSummary({
      ok: false,
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      code: 'protocol',
      message: 'no 06',
      position: 'frame 3/32',
      radioTouched: true,
      startedAt: '2026-01-01T00:00:00.000Z',
      timing: { medianFrameMs: 1, p99FrameMs: 2, maxFrameMs: 3 },
    });
    expect(text).toContain('Frame round trip: median 1.00 ms, p99 2.00 ms, max 3.00 ms');
  });

  it('summarises a failure', () => {
    const text = formatFirmwareFlashSummary({
      ok: false,
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      code: 'timeout',
      message: 'silent',
      position: 'block#57',
      radioTouched: true,
      startedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(text).toContain('Result: FAILED');
    expect(text).toContain('Error code: timeout');
    expect(text).toContain('Stopped at: block#57');
    expect(text).toContain('Radio touched: yes');
  });
});

describe('verifyStockFiles', () => {
  it('passes FirmwareError through', async () => {
    const err = await verifyStockFiles('baofeng-dm32uv', [
      { name: 'notes.txt', bytes: Uint8Array.of(1, 2, 3) },
    ]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FirmwareError);
    expect((err as FirmwareError).code).toBe('stock-missing-member');
  });
});

describe('runFirmwarePreflightProbe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens at the probe's baud rate, returns the summary and closes", async () => {
    fakeProbe.run.mockResolvedValue({ summary: 'RT95-P, version V100' });
    const out = await runFirmwarePreflightProbe({ radioId: 'baofeng-dm32uv', port });
    expect(out).toEqual({ ok: true, summary: 'RT95-P, version V100' });
    expect(radioIo.openWebSerialPipe).toHaveBeenCalledWith(port, 9600, { raiseDtrRts: true });
    expect(pipeClose).toHaveBeenCalledTimes(1);
  });

  it('maps a refusal to { ok: false } and still closes', async () => {
    fakeProbe.run.mockRejectedValue(new RadioWrongIdentError('Wrong model.'));
    const out = await runFirmwarePreflightProbe({ radioId: 'baofeng-dm32uv', port });
    expect(out).toEqual({ ok: false, code: 'wrongIdent', message: 'Wrong model.' });
    expect(pipeClose).toHaveBeenCalledTimes(1);
  });

  it('closes the port when the pipe never opened', async () => {
    vi.mocked(radioIo.openWebSerialPipe).mockRejectedValueOnce(new Error('busy'));
    const out = await runFirmwarePreflightProbe({ radioId: 'baofeng-dm32uv', port });
    expect(out).toMatchObject({ ok: false, message: 'busy' });
    expect(port.close).toHaveBeenCalledTimes(1);
    expect(fakeProbe.run).not.toHaveBeenCalled();
  });
});

describe('readFirmwareRadioReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the UV-5R Mini at the clone baud rate with DTR and RTS raised, returns the bytes and closes', async () => {
    const reader = radioIo.getFirmwareUpdater('baofeng-uv5rmini')!.radioReport!;
    const bytes = new Uint8Array(64).fill(0xff);
    const read = vi.spyOn(reader, 'read').mockResolvedValueOnce(bytes);
    const out = await readFirmwareRadioReport({ radioId: 'baofeng-uv5rmini', port });
    expect(out).toEqual({ ok: true, bytes });
    expect(read).toHaveBeenCalledTimes(1);
    expect(radioIo.openWebSerialPipe).toHaveBeenCalledWith(port, 115200, { raiseDtrRts: true });
    expect(pipeClose).toHaveBeenCalledTimes(1);
  });

  it('retries once at 38400 when the handshake gets no answer, as the codeplug session does', async () => {
    const reader = radioIo.getFirmwareUpdater('baofeng-uv5rmini')!.radioReport!;
    const bytes = new Uint8Array(64).fill(0xff);
    const read = vi
      .spyOn(reader, 'read')
      .mockRejectedValueOnce(new RadioTimeoutError('No answer.'))
      .mockResolvedValueOnce(bytes);
    const out = await readFirmwareRadioReport({ radioId: 'baofeng-uv5rmini', port });
    expect(out).toEqual({ ok: true, bytes });
    expect(read).toHaveBeenCalledTimes(2);
    expect(vi.mocked(radioIo.openWebSerialPipe).mock.calls).toEqual([
      [port, 115200, { raiseDtrRts: true }],
      [port, 38400, { raiseDtrRts: true }],
    ]);
    // The first pipe is closed before the retry, the second once the read is done.
    expect(pipeClose).toHaveBeenCalledTimes(2);
  });

  it('maps a read that fails at both rates to { ok: false } and closes each pipe', async () => {
    const reader = radioIo.getFirmwareUpdater('baofeng-uv5rmini')!.radioReport!;
    vi.spyOn(reader, 'read')
      .mockRejectedValueOnce(new RadioTimeoutError('No answer.'))
      .mockRejectedValueOnce(new RadioWrongIdentError('Wrong radio.'));
    const out = await readFirmwareRadioReport({ radioId: 'baofeng-uv5rmini', port });
    expect(out).toMatchObject({ ok: false, message: 'Wrong radio.' });
    expect(radioIo.openWebSerialPipe).toHaveBeenCalledTimes(2);
    expect(pipeClose).toHaveBeenCalledTimes(2);
  });

  it('does not retry a failure that is not a handshake one', async () => {
    const reader = radioIo.getFirmwareUpdater('baofeng-uv5rmini')!.radioReport!;
    vi.spyOn(reader, 'read').mockRejectedValueOnce(new Error('Port lost.'));
    const out = await readFirmwareRadioReport({ radioId: 'baofeng-uv5rmini', port });
    expect(out).toMatchObject({ ok: false, message: 'Port lost.' });
    expect(radioIo.openWebSerialPipe).toHaveBeenCalledTimes(1);
    expect(pipeClose).toHaveBeenCalledTimes(1);
  });

  it('refuses a radio with no report reader without opening the port', async () => {
    const out = await readFirmwareRadioReport({ radioId: 'baofeng-dm32uv', port });
    expect(out).toMatchObject({ ok: false });
    expect(radioIo.openWebSerialPipe).not.toHaveBeenCalled();
    expect(port.close).toHaveBeenCalledTimes(1);
  });
});

describe('firmware safety backup', () => {
  const TAKEN = {
    kind: 'taken' as const,
    radioKey: 'AB 123',
    summary: 'RT95-P V100, fingerprint 1a2b3c4d',
    region: 'cal',
    fileName: 'x.zip',
    zipBytes: Uint8Array.of(1, 2),
    sha256: 'ab'.repeat(32),
    fingerprint: '1a2b3c4d',
  };
  const records = () => JSON.parse(window.localStorage.getItem(RADIO_SAFETY_BACKUP_KEY) ?? '[]');

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('already-saved downloads nothing, and asks isSaved with the normalised serial', async () => {
    recordFirmwareSafetyBackupSaved('baofeng-dm32uv', TAKEN);
    fakeSafety.run.mockImplementation(async (_p, o) => ({
      kind: 'already-saved',
      radioKey: o.radioKey,
      summary: o.isSaved(o.radioKey) ? 'saved' : 'not saved',
    }));
    const out = await runFirmwareSafetyBackup({
      radioId: 'baofeng-dm32uv',
      port,
      serial: '  ab  123 ',
    });
    expect(out).toMatchObject({ ok: true, outcome: { kind: 'already-saved', summary: 'saved' } });
    expect(fakeSafety.run.mock.calls[0]![1]).toMatchObject({
      serial: 'ab  123',
      radioKey: 'AB 123',
    });
    expect(downloadZip).not.toHaveBeenCalled();
    expect(pipeClose).toHaveBeenCalledTimes(1);
  });

  it('taken downloads once and records nothing until the tick', async () => {
    fakeSafety.run.mockResolvedValue(TAKEN);
    const out = await runFirmwareSafetyBackup({
      radioId: 'baofeng-dm32uv',
      port,
      serial: 'AB 123',
    });
    expect(out.ok).toBe(true);
    expect(downloadZip).toHaveBeenCalledTimes(1);
    expect(downloadZip).toHaveBeenCalledWith(TAKEN.zipBytes, 'x.zip');
    expect(records()).toEqual([]);
    expect(recordFirmwareSafetyBackupSaved('baofeng-dm32uv', TAKEN)).toBe(true);
    expect(records()).toHaveLength(1);
    expect(records()[0]).toMatchObject({ family: 'fake-family', radioKey: 'AB 123' });
  });

  it('refuses an empty serial before opening anything, and closes the port', async () => {
    const out = await runFirmwareSafetyBackup({ radioId: 'baofeng-dm32uv', port, serial: '  ' });
    expect(out).toMatchObject({ ok: false });
    expect(radioIo.openWebSerialPipe).not.toHaveBeenCalled();
    expect(port.close).toHaveBeenCalledTimes(1);
  });

  it('a thrown run returns { ok: false } and closes the pipe', async () => {
    fakeSafety.run.mockRejectedValue(new RadioWrongIdentError('Wrong model.'));
    const out = await runFirmwareSafetyBackup({ radioId: 'baofeng-dm32uv', port, serial: 'AB' });
    expect(out).toEqual({ ok: false, code: 'wrongIdent', message: 'Wrong model.' });
    expect(pipeClose).toHaveBeenCalledTimes(1);
    expect(downloadZip).not.toHaveBeenCalled();
  });

  it('a good backup file is recorded; a bad one records nothing', async () => {
    fakeSafety.verifyFile.mockResolvedValueOnce({ ...TAKEN });
    const ok = await recordFirmwareSafetyBackupFile('baofeng-dm32uv', Uint8Array.of(1), 'AB 123');
    expect(ok).toMatchObject({ ok: true, recorded: true });
    expect(fakeSafety.verifyFile).toHaveBeenCalledWith(expect.anything(), {
      fallbackSerial: 'AB 123',
    });
    expect(records()).toHaveLength(1);
    window.localStorage.clear();
    fakeSafety.verifyFile.mockRejectedValueOnce(new Error('Not a backup.'));
    const bad = await recordFirmwareSafetyBackupFile('baofeng-dm32uv', Uint8Array.of(1), '');
    expect(bad).toEqual({ ok: false, message: 'Not a backup.' });
    expect(records()).toEqual([]);
  });
});

describe('the transport seam (Web Serial or the Android app)', () => {
  const capPort = { transport: 'capacitor' as const, device: CAPACITOR_DEVICE };
  const miniLink = () => radioIo.getFirmwareUpdater('baofeng-uv5rmini')!.link;
  const miniReport = () => radioIo.getFirmwareUpdater('baofeng-uv5rmini')!.radioReport!;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(radioIo.isCapacitorSerialSupported).mockReturnValue(false);
  });

  it('in a browser, grants through the Web Serial picker narrowed to the cable', async () => {
    await grantFirmwarePort('baofeng-uv5rmini');
    expect(radioIo.requestWebSerialPort).toHaveBeenCalledWith(true, miniLink().usbFilters);
    expect(radioIo.requestCapacitorSerialPort).not.toHaveBeenCalled();
  });

  it("in the Android app, grants the flash and report links by the cable's filters (no first-device fall-back)", async () => {
    vi.mocked(radioIo.isCapacitorSerialSupported).mockReturnValue(true);
    expect(await grantFirmwarePort('baofeng-uv5rmini')).toEqual(capPort);
    expect(await grantFirmwareRadioReportPort('baofeng-uv5rmini')).toEqual(capPort);
    expect(radioIo.requestCapacitorSerialPort).toHaveBeenNthCalledWith(1, {
      usbFilters: miniLink().usbFilters,
    });
    expect(radioIo.requestCapacitorSerialPort).toHaveBeenNthCalledWith(2, {
      usbFilters: miniReport().link.usbFilters,
    });
    expect(radioIo.requestWebSerialPort).not.toHaveBeenCalled();
  });

  it("flashes through the Capacitor pipe at the link's rate with its DTR/RTS choice, and closes it", async () => {
    fakeUpdater.identify.mockResolvedValue(IDENT);
    fakeUpdater.flash.mockResolvedValue({ framesSent: 1, dataFrames: 0, elapsedMs: 1, end: 'x' });
    const outcome = await runFirmwareFlash({
      radioId: 'baofeng-uv5rmini',
      image: IMAGE,
      port: capPort,
      onProgress: () => {},
      signal: new AbortController().signal,
    });
    expect(outcome.ok).toBe(true);
    expect(radioIo.openCapacitorSerialPipe).toHaveBeenCalledWith(
      CAPACITOR_DEVICE,
      miniLink().baudRate,
      { raiseDtrRts: miniLink().raiseDtrRts },
    );
    expect(miniLink().raiseDtrRts).toBe(false);
    expect(radioIo.openWebSerialPipe).not.toHaveBeenCalled();
    expect(pipeClose).toHaveBeenCalledTimes(1);
  });

  it('reads the report through the Capacitor pipe, with the same rate fall-back', async () => {
    const bytes = new Uint8Array(64).fill(0xff);
    vi.spyOn(miniReport(), 'read')
      .mockRejectedValueOnce(new RadioTimeoutError('No answer.'))
      .mockResolvedValueOnce(bytes);
    const out = await readFirmwareRadioReport({ radioId: 'baofeng-uv5rmini', port: capPort });
    expect(out).toEqual({ ok: true, bytes });
    expect(vi.mocked(radioIo.openCapacitorSerialPipe).mock.calls).toEqual([
      [CAPACITOR_DEVICE, 115200, { raiseDtrRts: true }],
      [CAPACITOR_DEVICE, 38400, { raiseDtrRts: true }],
    ]);
    expect(pipeClose).toHaveBeenCalledTimes(2);
  });

  it('a Capacitor port that never opened needs no close', async () => {
    vi.mocked(radioIo.openCapacitorSerialPipe).mockRejectedValueOnce(new Error('IO_ERROR'));
    const outcome = await runFirmwareFlash({
      radioId: 'baofeng-uv5rmini',
      image: IMAGE,
      port: capPort,
      onProgress: () => {},
      signal: new AbortController().signal,
    });
    expect(outcome).toMatchObject({ ok: false, message: 'IO_ERROR', radioTouched: false });
    expect(pipeClose).not.toHaveBeenCalled();
  });

  it('in the Android app, the pre-flight probe and the safety backup refuse before any port is asked for', async () => {
    vi.mocked(radioIo.isCapacitorSerialSupported).mockReturnValue(true);
    await expect(grantFirmwarePreflightPort('baofeng-dm32uv')).rejects.toThrow(
      /not available in the Android app/,
    );
    await expect(grantFirmwareSafetyBackupPort('baofeng-dm32uv')).rejects.toThrow(
      /not available in the Android app/,
    );
    expect(radioIo.requestCapacitorSerialPort).not.toHaveBeenCalled();
    expect(radioIo.requestWebSerialPort).not.toHaveBeenCalled();
  });

  it('the probe and the safety backup refuse a Capacitor port cleanly, opening nothing', async () => {
    const probe = await runFirmwarePreflightProbe({ radioId: 'baofeng-dm32uv', port: capPort });
    expect(probe).toMatchObject({ ok: false, code: 'unsupported' });
    const backup = await runFirmwareSafetyBackup({
      radioId: 'baofeng-dm32uv',
      port: capPort,
      serial: 'AB 123',
    });
    expect(backup).toMatchObject({ ok: false, code: 'unsupported' });
    expect(radioIo.openWebSerialPipe).not.toHaveBeenCalled();
    expect(radioIo.openCapacitorSerialPipe).not.toHaveBeenCalled();
    expect(fakeProbe.run).not.toHaveBeenCalled();
    expect(fakeSafety.run).not.toHaveBeenCalled();
  });
});
