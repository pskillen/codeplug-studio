import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FirmwareError } from '@core/firmware/errors.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
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
  runFirmwareFlash,
  verifyStockFiles,
  type FirmwareFlashOutcome,
} from './firmwareFlash.ts';

const pipeClose = vi.fn(async () => {});
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
    getFirmwareUpdater: vi.fn((radioId: string) => {
      const real = actual.getFirmwareUpdater(radioId as 'baofeng-dm32uv');
      return real && { ...real, createUpdater: () => fakeUpdater as unknown as FirmwareUpdater };
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
