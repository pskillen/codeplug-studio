import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { DM32UV_FIRMWARE_BLOCK0_FILE_NAME } from '@core/radios/baofeng/dm-32uv/firmware.ts';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import { getFirmwareUpdater, listFirmwareUpdaters } from '../../../firmware/registry.ts';
import type { FirmwareFlashProgress } from '../../../firmware/types.ts';
import { RadioWrongIdentError } from '../../../kit/errors.ts';
import { Dm32BootloaderMock } from './__fixtures__/dm32BootloaderMock.ts';
import { preparedDm32Image, syntheticDm32Image } from './__fixtures__/syntheticImage.ts';
import type { Dm32PlanStep } from './plan.ts';
import { createDm32FirmwareUpdater } from './updater.ts';

const capturedPlans: Dm32PlanStep[][] = [];
vi.mock('./plan.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./plan.ts')>();
  return {
    ...mod,
    buildDm32FirmwarePlan: (...args: Parameters<typeof mod.buildDm32FirmwarePlan>) => {
      const plan = mod.buildDm32FirmwarePlan(...args);
      capturedPlans.push(plan);
      return plan;
    },
  };
});

const BIN = syntheticDm32Image();
const IMAGE = preparedDm32Image(BIN);
const STOCK_FRAMES = 6 + 1 + 840 * 2 + 1;

async function run(
  mock: Dm32BootloaderMock,
  opts: { onProgress?: (p: FirmwareFlashProgress) => void; signal?: AbortSignal } = {},
) {
  const updater = createDm32FirmwareUpdater({ preSendDelayMs: 0 });
  await updater.identify(mock);
  return updater.flash(IMAGE, opts);
}

async function flashError(promise: Promise<unknown>): Promise<FirmwareFlashError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(FirmwareFlashError);
  return err as FirmwareFlashError;
}

describe('createDm32FirmwareUpdater', () => {
  it('runs a full session that reassembles the body', async () => {
    const mock = new Dm32BootloaderMock();
    const progress: FirmwareFlashProgress[] = [];
    const result = await run(mock, { onProgress: (p) => progress.push(p) });
    expect(mock.violations).toEqual([]);
    expect(mock.erased && mock.eotSeen).toBe(true);
    expect(mock.body).toEqual(BIN.slice(0x100));
    expect(mock.frames).toHaveLength(STOCK_FRAMES);
    expect(new TextDecoder().decode(mock.meta)).toBe(
      `${DM32UV_FIRMWARE_BLOCK0_FILE_NAME}\x00860160`,
    );
    expect(result).toMatchObject({ framesSent: STOCK_FRAMES, dataFrames: 840, end: 'eot-sent' });
    expect(new Set(progress.map((p) => p.phase))).toEqual(
      new Set(['handshake', 'erase', 'transfer', 'finish']),
    );
    expect(progress.find((p) => p.phase === 'handshake')!.radioTouched).toBe(false);
    expect(progress.find((p) => p.phase === 'transfer')!.radioTouched).toBe(true);
    expect(progress.some((p) => p.msg === 'Transfer 120/840')).toBe(true);
  }, 15_000);

  it('returns the bootloader ident', async () => {
    const ident = await createDm32FirmwareUpdater({ preSendDelayMs: 0 }).identify(
      new Dm32BootloaderMock(),
    );
    expect(ident.radioId).toBe('baofeng-dm32uv');
    expect(ident.model).toBe('BFUV32-V2');
    expect(new TextDecoder().decode(ident.raw)).toBe('BFUV32-V2');
  });

  it.each([3, 7, 8, 400, 1000])(
    'stops sending when the radio goes silent (reply %i)',
    async (k) => {
      const mock = new Dm32BootloaderMock({ silentAt: k });
      const err = await flashError(run(mock));
      expect(mock.frames).toHaveLength(k + 1);
      expect(err.code).toBe('timeout');
      expect(err.radioTouched).toBe(k >= 6);
      if (k === 400) expect(err.position).toBe(`block#${(400 - 8) / 2}`);
    },
  );

  it('stops during the ident when the radio is silent from the start', async () => {
    const mock = new Dm32BootloaderMock({ silentAt: 0 });
    await expect(createDm32FirmwareUpdater({ preSendDelayMs: 0 }).identify(mock)).rejects.toThrow();
    expect(mock.frames).toHaveLength(1);
  });

  it('refuses a wrong model ident before the erase', async () => {
    const mock = new Dm32BootloaderMock({ model: 'BFUV32-V1' });
    const updater = createDm32FirmwareUpdater({ preSendDelayMs: 0 });
    await expect(updater.identify(mock)).rejects.toBeInstanceOf(RadioWrongIdentError);
    expect(mock.frames.length).toBeLessThan(5);
    expect(mock.erased).toBe(false);
    const err = await flashError(updater.flash(IMAGE, {}));
    expect(err.radioTouched).toBe(false);
    expect(mock.frames.length).toBeLessThan(5);
  });

  it('aborts on an erase-failure reply', async () => {
    const mock = new Dm32BootloaderMock({
      wrongReplyAt: new Map([[6, Uint8Array.of(0x06, 0x15)]]),
    });
    const err = await flashError(run(mock));
    expect(err.position).toBe('block0+erase');
    expect(err.radioTouched).toBe(true);
    expect(mock.frames).toHaveLength(7);
  });

  it('aborts at once on a NAK-like reply to a data block', async () => {
    const mock = new Dm32BootloaderMock({
      wrongReplyAt: new Map([[7 + 2 * 5 + 1, Uint8Array.of(0x15)]]),
    });
    const err = await flashError(run(mock));
    expect(err.position).toBe('block#5');
    expect(mock.frames).toHaveLength(7 + 2 * 6);
  });

  it('treats a silent EOT as success', async () => {
    const mock = new Dm32BootloaderMock({ silentAt: 6 + 1 + 840 * 2 });
    const result = await run(mock);
    expect(mock.eotSeen).toBe(true);
    expect(result.end).toBe('eot-sent');
  });

  it('aborts before the erase without touching the radio', async () => {
    const mock = new Dm32BootloaderMock();
    const ctrl = new AbortController();
    const err = await flashError(
      run(mock, {
        signal: ctrl.signal,
        onProgress: (p) => {
          if (p.phase === 'handshake') ctrl.abort();
        },
      }),
    );
    expect(err.code).toBe('aborted');
    expect(err.radioTouched).toBe(false);
    expect(mock.erased).toBe(false);
  });

  it('aborts after the erase with radioTouched', async () => {
    const mock = new Dm32BootloaderMock();
    const ctrl = new AbortController();
    const err = await flashError(
      run(mock, {
        signal: ctrl.signal,
        onProgress: (p) => {
          if (p.phase === 'transfer') ctrl.abort();
        },
      }),
    );
    expect(err.code).toBe('aborted');
    expect(err.radioTouched).toBe(true);
    expect(mock.erased).toBe(true);
  });

  it('refuses to flash without identify', async () => {
    const err = await flashError(createDm32FirmwareUpdater({ preSendDelayMs: 0 }).flash(IMAGE, {}));
    expect(err.radioTouched).toBe(false);
  });

  it('refuses a frame changed after the plan was built, and sends nothing more', async () => {
    const mock = new Dm32BootloaderMock();
    capturedPlans.length = 0;
    const err = await flashError(
      run(mock, {
        onProgress: (p) => {
          if (p.phase === 'transfer' && p.msg === 'Transfer 8/840') {
            const plan = capturedPlans[0]!;
            const step = plan.find((s) => s.name === 'block#20')!;
            step.tx[10] = step.tx[10]! ^ 0xff;
          }
        },
      }),
    );
    expect(err.code).toBe('interlock');
    expect(err.position).toBe('block#20');
    // Frames up to and including type#20 were sent; block#20 never was.
    expect(mock.frames).toHaveLength(7 + 2 * 20 + 1);
  });

  it('refuses an image that fails the interlocks before sending anything more', async () => {
    const mock = new Dm32BootloaderMock();
    const updater = createDm32FirmwareUpdater({ preSendDelayMs: 0 });
    await updater.identify(mock);
    const err = await flashError(updater.flash(preparedDm32Image(BIN.slice(0, 1000)), {}));
    expect(err.code).toBe('interlock');
    expect(err.radioTouched).toBe(false);
    expect(mock.frames).toHaveLength(3);
  });
});

describe('one write call site', () => {
  const here = dirname(fileURLToPath(import.meta.url));

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === '__fixtures__' ? [] : sourceFiles(path);
      return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [path] : [];
    });
  }

  it('has no write call in the DM-32UV updater sources', () => {
    const files = sourceFiles(here);
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toContain('.write(');
  });

  it('has exactly one pipe.write call in the guarded send', () => {
    const src = readFileSync(join(here, '../../../firmware/guardedSend.ts'), 'utf8');
    expect(src.match(/pipe\.write\(/g)).toHaveLength(1);
  });
});

describe('firmware registry', () => {
  it('lists the DM-32UV, enabled in prod and hidden on Capacitor', () => {
    const d = getFirmwareUpdater('baofeng-dm32uv');
    expect(listFirmwareUpdaters()).toContain(d);
    expect(d).toMatchObject({ prodFlashDisabled: false, capacitorSupported: false });
    expect(d!.createUpdater().radioId).toBe('baofeng-dm32uv');
  });
});
