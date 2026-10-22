import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import { getFirmwareUpdater, listFirmwareUpdaters } from '../../../firmware/registry.ts';
import type { FirmwareFlashProgress } from '../../../firmware/types.ts';
import { D890BootloaderMock } from './__fixtures__/d890BootloaderMock.ts';
import { preparedD890Image, synthD890Package } from './__fixtures__/syntheticPackage.ts';
import { AT_D890_FW_FRAMES_1_0_0 } from './constants.ts';
import { createD890FirmwareUpdater, summariseD890FrameTiming } from './updater.ts';

const FILES = synthD890Package(0x0800c000, 1000);
const IMAGE = preparedD890Image(FILES);

async function run(
  mock: D890BootloaderMock,
  opts: { onProgress?: (p: FirmwareFlashProgress) => void; signal?: AbortSignal } = {},
  image = IMAGE,
) {
  const updater = createD890FirmwareUpdater();
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

const dataLog = (mock: D890BootloaderMock) => mock.log.filter((l) => l.startsWith('data '));
const unsafe = (mock: D890BootloaderMock) =>
  mock.log.filter((l) => l.startsWith('unknown') || l === 'badframe');

describe('createD890FirmwareUpdater', () => {
  it('runs a session that reproduces the image', async () => {
    const mock = new D890BootloaderMock();
    const progress: FirmwareFlashProgress[] = [];
    const result = await run(mock, { onProgress: (p) => progress.push(p) });
    expect(mock.image(0x0800c000, 1000)).toEqual(FILES.cdd);
    expect(mock.log.slice(0, 2)).toEqual(['UPDATE', 'ident']);
    expect(mock.log.at(-1)).toBe('end');
    expect(dataLog(mock)).toHaveLength(32);
    // The last block is zero-padded.
    expect(mock.mem.get(0x0800c000 + 992)!.subarray(8)).toEqual(new Uint8Array(24));
    expect(Math.min(...mock.mem.keys())).toBe(0x0800c000);
    expect(unsafe(mock)).toEqual([]);
    expect(result).toMatchObject({
      framesSent: 32 + 3,
      dataFrames: 32,
      end: 'acknowledged',
    });
    expect(result.timing).toEqual({
      medianFrameMs: expect.any(Number),
      p99FrameMs: expect.any(Number),
      maxFrameMs: expect.any(Number),
    });
    expect(progress[0]).toMatchObject({ phase: 'transfer', cur: 0, radioTouched: true });
    expect(progress.at(-1)).toMatchObject({ phase: 'finish', cur: 32, max: 32 });
    expect(progress.some((p) => p.msg === 'Transfer 32/32')).toBe(true);
  });

  it('returns the bootloader ident', async () => {
    const ident = await createD890FirmwareUpdater().identify(new D890BootloaderMock());
    expect(ident).toMatchObject({ radioId: 'anytone-at-d890uv', model: 'D890UV', version: 'V100' });
    expect(ident.raw).toHaveLength(16);
    expect(ident.raw[8]).toBe(0);
  });

  it('fails identify when the radio does not answer UPDATE', async () => {
    class Silent extends D890BootloaderMock {
      override async write(): Promise<void> {}
    }
    await expect(createD890FirmwareUpdater().identify(new Silent())).rejects.toThrow(/update mode/);
  });

  it('refuses a model mismatch before any frame', async () => {
    const mock = new D890BootloaderMock({ version: 'V101' });
    const err = await flashError(run(mock));
    expect(err.code).toBe('interlock');
    expect(err.message).toMatch(/Model Error/);
    expect(err.radioTouched).toBe(false);
    expect(mock.frames).toBe(0);
  });

  it('refuses a radio in normal mode (band byte 03) before any frame', async () => {
    const mock = new D890BootloaderMock({ bandByte: 0x03 });
    const err = await flashError(run(mock));
    expect(err.code).toBe('interlock');
    expect(err.radioTouched).toBe(false);
    expect(mock.frames).toBe(0);
    expect(mock.log).toEqual(['UPDATE', 'ident']);
  });

  it.each([
    ['NAK', { nakAt: [3] }],
    ['wrong reply byte', { corruptReplyAt: [3] }],
    ['no reply', { silentAt: [3] }],
  ])('resends once after a %s, then succeeds', async (_name, fault) => {
    const mock = new D890BootloaderMock(fault);
    const result = await run(mock);
    expect(mock.frames).toBe(33);
    expect(mock.image(0x0800c000, 1000)).toEqual(FILES.cdd);
    expect(result.framesSent).toBe(33 + 3);
    expect(mock.log.at(-1)).toBe('end');
  });

  it('aborts after two failures on the same frame and sends nothing more', async () => {
    const mock = new D890BootloaderMock({ nakAt: [3, 4] });
    const err = await flashError(run(mock));
    expect(err.radioTouched).toBe(true);
    expect(err.position).toBe('frame 3/32 @ 0x0800C040');
    expect(mock.log).not.toContain('end');
    expect(mock.frames).toBe(4);
    expect([...mock.mem.keys()]).toEqual([0x0800c000, 0x0800c020]);
    expect(err.timing?.maxFrameMs).toEqual(expect.any(Number));
  });

  it('sends nothing for an unsafe package', async () => {
    const mock = new D890BootloaderMock();
    const bad = preparedD890Image(synthD890Package(0x0800a000, 100));
    const updater = createD890FirmwareUpdater();
    expect(() => updater.checkImage(bad)).toThrow(expect.objectContaining({ code: 'interlock' }));
    expect(mock.log).toEqual([]);
    await updater.identify(mock);
    const err = await flashError(updater.flash(bad, {}));
    expect(err.code).toBe('interlock');
    expect(err.radioTouched).toBe(false);
    expect(mock.frames).toBe(0);
  });

  it('treats the port closing after the end byte as success', async () => {
    const mock = new D890BootloaderMock({ dropAfterEnd: true });
    const result = await run(mock);
    expect(result.end).toBe('port-closed-by-radio');
    expect(mock.image(0x0800c000, 1000)).toEqual(FILES.cdd);
  });

  it('fails with radioTouched when the port closes before the end byte', async () => {
    const mock = new D890BootloaderMock({ closeAtFrame: 5 });
    const err = await flashError(run(mock));
    expect(err.code).toBe('closed');
    expect(err.radioTouched).toBe(true);
    expect(mock.log).not.toContain('end');
  });

  it('reports no-reply, not an error, when the end byte gets no answer', async () => {
    class QuietEnd extends D890BootloaderMock {
      override async write(data: Uint8Array): Promise<void> {
        await super.write(data);
        if (data.length === 1 && data[0] === 0x18) await this.flush();
      }
    }
    const mock = new QuietEnd();
    const result = await run(mock);
    expect(result.end).toBe('no-reply');
    expect(mock.log.at(-1)).toBe('end');
  });

  it('fails when the end byte gets a wrong reply', async () => {
    class BadEnd extends D890BootloaderMock {
      override async readExact(n: number): Promise<Uint8Array> {
        if (this.ended) return Uint8Array.of(0x15);
        return super.readExact(n);
      }
    }
    const err = await flashError(run(new BadEnd()));
    expect(err.position).toBe('end');
    expect(err.radioTouched).toBe(true);
  });

  it('abort before the first frame leaves the radio untouched', async () => {
    const mock = new D890BootloaderMock();
    const ac = new AbortController();
    ac.abort();
    const err = await flashError(run(mock, { signal: ac.signal }));
    expect(err.radioTouched).toBe(false);
    expect(mock.frames).toBe(0);
  });

  it('abort after the first frame reports the radio touched', async () => {
    const mock = new D890BootloaderMock();
    const ac = new AbortController();
    const err = await flashError(
      run(mock, {
        signal: ac.signal,
        onProgress: (p) => {
          if (p.phase === 'transfer') ac.abort();
        },
      }),
    );
    expect(err.radioTouched).toBe(true);
    expect(mock.frames).toBe(1);
    expect(mock.log).not.toContain('end');
  });

  it('refuses flash without identify', async () => {
    const err = await flashError(createD890FirmwareUpdater().flash(IMAGE, {}));
    expect(err.radioTouched).toBe(false);
  });

  it('runs a full-size synthetic 1.0.0 session against the mock', async () => {
    const files = synthD890Package(0x0800c000, AT_D890_FW_FRAMES_1_0_0 * 32);
    const mock = new D890BootloaderMock();
    let updates = 0;
    const t0 = performance.now();
    const result = await run(mock, { onProgress: () => updates++ }, preparedD890Image(files));
    const ms = performance.now() - t0;
    console.info(
      `AT-D890UV synthetic ${AT_D890_FW_FRAMES_1_0_0}-frame session against the mock: ${Math.round(ms)} ms`,
    );
    expect(result.dataFrames).toBe(AT_D890_FW_FRAMES_1_0_0);
    expect(mock.frames).toBe(AT_D890_FW_FRAMES_1_0_0);
    expect(updates).toBeLessThan(AT_D890_FW_FRAMES_1_0_0 / 200);
    expect(ms).toBeLessThan(60_000);
  }, 120_000);
});

describe('summariseD890FrameTiming', () => {
  it('returns median, p99 and max', () => {
    const s = Float64Array.from({ length: 100 }, (_, i) => i + 1);
    expect(summariseD890FrameTiming(s, 100)).toEqual({
      medianFrameMs: 50,
      p99FrameMs: 99,
      maxFrameMs: 100,
    });
    expect(summariseD890FrameTiming(s, 0)).toBeUndefined();
  });
});

describe('one write call site', () => {
  const here = dirname(fileURLToPath(import.meta.url));

  it('has no write call in the AT-D890UV updater sources', () => {
    const files = readdirSync(here)
      .map((name) => join(here, name))
      .filter((p) => statSync(p).isFile() && p.endsWith('.ts') && !p.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThan(4);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toContain('.write(');
  });
});

describe('firmware registry', () => {
  it('lists both radios; the AT-D890UV is prod-hidden and the DM-32UV unchanged', () => {
    expect(listFirmwareUpdaters().map((d) => d.radioId)).toEqual([
      'baofeng-dm32uv',
      'anytone-at-d890uv',
    ]);
    const d890 = getFirmwareUpdater('anytone-at-d890uv');
    expect(d890).toMatchObject({
      label: 'AnyTone AT-D890UV',
      prodFlashDisabled: true,
      capacitorSupported: false,
    });
    expect(d890!.createUpdater().radioId).toBe('anytone-at-d890uv');
    expect(getFirmwareUpdater('baofeng-dm32uv')).toMatchObject({
      prodFlashDisabled: false,
      capacitorSupported: false,
    });
  });
});
