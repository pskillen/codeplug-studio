import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import type { FirmwareFlashProgress } from '../../../firmware/types.ts';
import { getFirmwareUpdater } from '../../../firmware/registry.ts';
import { Rt95BootloaderMock } from './__fixtures__/rt95BootloaderMock.ts';
import {
  preparedRt95HeadImage,
  RT95_GOLDEN_FRAMES,
  RT95_GOLDEN_SHA256,
  RT95_GOLDEN_STREAM_LEN,
  synthRt95HeadPackage,
} from './__fixtures__/syntheticPackage.ts';
import { createRt95HeadFirmwareUpdater, summariseRt95FrameTiming } from './updater.ts';

const FILES = synthRt95HeadPackage();
const IMAGE = preparedRt95HeadImage(FILES);

async function run(
  mock: Rt95BootloaderMock,
  opts: { onProgress?: (p: FirmwareFlashProgress) => void; signal?: AbortSignal } = {},
  image = IMAGE,
) {
  const updater = createRt95HeadFirmwareUpdater();
  await updater.identify(mock);
  return updater.flash(image, opts);
}

async function flashError(promise: Promise<unknown>): Promise<FirmwareFlashError> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(FirmwareFlashError);
  return err as FirmwareFlashError;
}

const dataLog = (m: Rt95BootloaderMock) => m.log.filter((l) => l.startsWith('data '));
const unsafe = (m: Rt95BootloaderMock) =>
  m.log.filter((l) => l.startsWith('unknown') || l === 'badframe');

describe('RT95 head updater: golden session', () => {
  it.each([true, false])(
    'reproduces the image byte-exact and the stream hash (echo %s)',
    async (echo) => {
      const mock = new Rt95BootloaderMock({ echo });
      const result = await run(mock);
      expect(result).toMatchObject({
        dataFrames: RT95_GOLDEN_FRAMES,
        framesSent: RT95_GOLDEN_FRAMES + 2,
        end: 'acknowledged',
      });
      expect(dataLog(mock)).toHaveLength(RT95_GOLDEN_FRAMES);
      expect(mock.image(0x08002000, FILES.cdd.length)).toEqual(FILES.cdd);
      expect(mock.received).toHaveLength(RT95_GOLDEN_STREAM_LEN);
      expect(createHash('sha256').update(Uint8Array.from(mock.received)).digest('hex')).toBe(
        RT95_GOLDEN_SHA256.stream,
      );
      expect(unsafe(mock)).toEqual([]);
      expect(result.timing).toBeDefined();
    },
  );

  it('reports handshake, transfer and finish with radioTouched from the first frame', async () => {
    const seen: FirmwareFlashProgress[] = [];
    await run(new Rt95BootloaderMock(), { onProgress: (p) => seen.push(p) });
    expect(seen[0]).toMatchObject({ phase: 'handshake', radioTouched: false });
    expect(seen[1]).toMatchObject({ phase: 'transfer', cur: 0, radioTouched: true });
    expect(seen.filter((p) => p.phase === 'transfer')).toHaveLength(RT95_GOLDEN_FRAMES + 1);
    expect(seen.at(-1)).toMatchObject({ phase: 'finish', msg: 'Finished' });
  });
});

describe('RT95 head updater: faults', () => {
  it('resends after one NAK and one silence, then succeeds', async () => {
    const mock = new Rt95BootloaderMock({ nakAt: [3], silentAt: [10] });
    const result = await run(mock);
    expect(result.end).toBe('acknowledged');
    expect(mock.image(0x08002000, FILES.cdd.length)).toEqual(FILES.cdd);
    expect(result.framesSent).toBe(RT95_GOLDEN_FRAMES + 2 + 2);
  });

  it('aborts after four failures: radioTouched, no 18, no further frame', async () => {
    const mock = new Rt95BootloaderMock({ nakAt: [4, 5, 6, 7] });
    const err = await flashError(run(mock));
    expect(err.radioTouched).toBe(true);
    expect(err.position).toMatch(/^frame 4\//);
    expect(mock.log).not.toContain('end');
    expect(mock.frames).toBe(7);
  });

  it('treats no reply to 18 as no-reply', async () => {
    const result = await run(new Rt95BootloaderMock({ endReply: false }));
    expect(result.end).toBe('no-reply');
  });

  it('stops on a corrupt echo and sends nothing more', async () => {
    const mock = new Rt95BootloaderMock({ corruptEchoAt: [5] });
    const err = await flashError(run(mock));
    expect(err.message).toMatch(/cable echo did not match/);
    expect(err.radioTouched).toBe(true);
    expect(mock.frames).toBe(5);
    expect(mock.log).not.toContain('end');
  });

  it('refuses a radio in normal mode: sends END, no frame, says normal mode', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'normal' });
    const updater = createRt95HeadFirmwareUpdater();
    await expect(updater.identify(mock)).rejects.toThrow(/switched on normally/);
    expect(mock.log).toEqual(['PROGRAM', 'END']);
    expect(mock.frames).toBe(0);
    // And a flash after that refusal has nothing bound.
    const err = await flashError(updater.flash(IMAGE, {}));
    expect(err.radioTouched).toBe(false);
  });

  it('refuses a radio in normal mode without echo too', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'normal', echo: false });
    await expect(createRt95HeadFirmwareUpdater().identify(mock)).rejects.toThrow(
      /switched on normally/,
    );
    expect(mock.log).toEqual(['PROGRAM', 'END']);
  });

  it('tries PROGRAM three times with a silent radio, then explains', async () => {
    const mock = new Rt95BootloaderMock({ mode: 'silent' });
    await expect(createRt95HeadFirmwareUpdater().identify(mock)).rejects.toThrow(
      /Is it in update mode\? Hold P1 and the knob/,
    );
    expect(mock.log.filter((l) => l === 'PROGRAM')).toHaveLength(3);
    expect(mock.frames).toBe(0);
  });

  it('refuses a flash without identify, untouched', async () => {
    const err = await flashError(createRt95HeadFirmwareUpdater().flash(IMAGE, {}));
    expect(err.radioTouched).toBe(false);
    expect(err.message).toMatch(/not been identified/);
  });

  it('allows one flash per identify', async () => {
    const mock = new Rt95BootloaderMock();
    const updater = createRt95HeadFirmwareUpdater();
    await updater.identify(mock);
    await updater.flash(IMAGE, {});
    const err = await flashError(updater.flash(IMAGE, {}));
    expect(err.message).toMatch(/not been identified/);
  });

  it('checks the interlocks again in flash(), before any frame', async () => {
    const mock = new Rt95BootloaderMock();
    const updater = createRt95HeadFirmwareUpdater();
    await updater.identify(mock);
    const bad = preparedRt95HeadImage(synthRt95HeadPackage(undefined, { sp: 0x200013e8 }));
    const err = await flashError(updater.flash(bad, {}));
    expect(err.radioTouched).toBe(false);
    expect(err.message).toMatch(/main-board image/);
    expect(mock.frames).toBe(0);
  });

  it('aborts between frames', async () => {
    const mock = new Rt95BootloaderMock();
    const ctl = new AbortController();
    const err = await flashError(
      run(mock, {
        signal: ctl.signal,
        onProgress: (p) => {
          if (p.phase === 'transfer' && p.cur === 3) ctl.abort();
        },
      }),
    );
    expect(err.radioTouched).toBe(true);
    expect(mock.frames).toBe(3);
    expect(mock.log).not.toContain('end');
  });
});

describe('summariseRt95FrameTiming', () => {
  it('returns median, p99 and max', () => {
    const s = Float64Array.from({ length: 100 }, (_, i) => i + 1);
    expect(summariseRt95FrameTiming(s, 100)).toEqual({
      medianFrameMs: 50,
      p99FrameMs: 99,
      maxFrameMs: 100,
    });
    expect(summariseRt95FrameTiming(s, 0)).toBeUndefined();
  });
});

describe('one write call site', () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it('has no write call in the RT95 updater sources', () => {
    const files = readdirSync(here)
      .map((name) => join(here, name))
      .filter((p) => statSync(p).isFile() && p.endsWith('.ts') && !p.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(4);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toContain('.write(');
  });
});

describe('firmware registry', () => {
  it('registers the RT95 front panel, prod-gated, with its pre-flight', () => {
    const d = getFirmwareUpdater('retevis-rt95-head');
    expect(d).toMatchObject({
      label: 'Retevis RT95 front panel (LCD)',
      prodFlashDisabled: true,
      capacitorSupported: false,
    });
    expect(d!.preflight?.attestations.map((a) => a.id)).toEqual([
      'serial-2101',
      'test-screen-v111',
    ]);
    expect(d!.preflight?.probe).toBeDefined();
    expect(d!.createUpdater().radioId).toBe('retevis-rt95-head');
  });
});
