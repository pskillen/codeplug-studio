import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import {
  RadioAlreadyInstalledError,
  RadioConfirmRequiredError,
  RadioNothingInstalledError,
} from '../../../kit/errors.ts';
import type {
  FirmwareFlashProgress,
  FirmwareFlashResult,
  FirmwareUpdater,
} from '../../../firmware/types.ts';
import type { BytePipe } from '../../../types.ts';
import { openWebSerialPipe } from '../../../transport/webSerialPipe.ts';
import {
  createMockUv5rMini,
  type MockUv5rMini,
  type Uv5rMiniMockOptions,
} from './__fixtures__/mockUv5rMini.ts';
import { UV5RMINI_FW_CMD, UV5RMINI_FW_LOADER_BAUD } from './frames.ts';
import * as interlocks from './interlocks.ts';
import {
  createCoveredBytes,
  createUv5rMiniFirmwareUpdater,
  describeUv5rMiniResult,
  UV5RMINI_MSG,
} from './updater.ts';

// The mock radio serves a synthetic image, not a real `.ufw`: the image interlocks have their own tests
// (interlocks.test.ts) and a spy here records that the updater runs them.
vi.mock('./interlocks.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./interlocks.ts')>();
  return { ...actual, checkUv5rMiniImage: vi.fn() };
});

const BUILD = 'mm9pdy-test-0.0.1';
const imageFor = (mock: MockUv5rMini): PreparedFirmwareImage =>
  ({
    radioId: 'baofeng-uv5rmini',
    provenance: 'unreviewed',
    stockVersion: 'v0.04 (NRFB)',
    title: 'test firmware',
    versionStamp: BUILD,
    package: { radioId: 'baofeng-uv5rmini', files: { ufw: mock.image } },
    sha256: {},
    verifyHint: 'x',
  }) as unknown as PreparedFirmwareImage;

describe('describeUv5rMiniResult: which refusals mean nothing was installed', () => {
  const image = { versionStamp: BUILD, title: 't' } as unknown as PreparedFirmwareImage;
  type S = Parameters<typeof describeUv5rMiniResult>[0];
  const ended = (o: Partial<S>): S => ({
    result: undefined,
    resultPhase: undefined,
    areaLength: undefined,
    continued: false,
    lengthHeard: o.areaLength !== undefined,
    ...o,
  });

  it("the loader's 0x8F (before cmd 4) is nothing installed", () => {
    const r = describeUv5rMiniResult(ended({ result: 0x8f, resultPhase: 'loader' }), image);
    expect(r).toEqual({ error: UV5RMINI_MSG.loaderOtherLayout, nothingInstalled: true });
  });

  it("the app's 0x83 with no cmd 4 heard is nothing installed", () => {
    const r = describeUv5rMiniResult(ended({ result: 0x83, resultPhase: 'app' }), image);
    expect(r).toEqual({ error: UV5RMINI_MSG.appOtherLayout, nothingInstalled: true });
  });

  it("the app's 0x83 after an (ignored) cmd 4 keeps today's words, not nothing installed", () => {
    const r = describeUv5rMiniResult(
      ended({ result: 0x83, resultPhase: 'app', lengthHeard: true }),
      image,
    );
    expect(r).toEqual({ error: UV5RMINI_MSG.appRefused });
  });

  it("the loader's 0x83 after cmd 4 stays the recover path", () => {
    const r = describeUv5rMiniResult(
      ended({ result: 0x83, resultPhase: 'loader', areaLength: 0x1000 }),
      image,
    );
    expect(r.nothingInstalled).toBeUndefined();
    expect(r.error).toBe(`${UV5RMINI_MSG.recover} (Result 0x83.)`);
  });

  it('any other refusal is not nothing installed', () => {
    for (const [result, resultPhase] of [
      [0x87, 'loader'],
      [0x86, 'loader'],
      [0x83, 'loader'],
      [0x01, 'app'],
      [0x86, 'app'],
      [0x8a, 'app'],
      [0x8f, 'app'],
    ] as const) {
      const r = describeUv5rMiniResult(ended({ result, resultPhase }), image);
      expect(r.error).toBeDefined();
      expect(r.nothingInstalled).toBeUndefined();
    }
  });
});

let mock: MockUv5rMini | undefined;
let pipe: BytePipe | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(interlocks.checkUv5rMiniImage).mockClear();
});
afterEach(async () => {
  await pipe?.close().catch(() => undefined);
  pipe = undefined;
  mock?.dispose();
  mock = undefined;
  vi.useRealTimers();
});

const make = (o: Uv5rMiniMockOptions = {}) =>
  (mock = createMockUv5rMini({ modelWire: true, ...o }));
const open = async (m: MockUv5rMini) =>
  (pipe = await openWebSerialPipe(m.port, 9600, { raiseDtrRts: false }));

/** Advance fake time until the promise settles; returns its value or the error it rejected with. */
async function settle<T>(p: Promise<T>, maxMs: number): Promise<{ value?: T; error?: unknown }> {
  let out: { value?: T; error?: unknown } | undefined;
  void p.then(
    (value) => (out = { value }),
    (error: unknown) => (out = { error }),
  );
  for (let t = 0; t < maxMs && !out; t += 10) await vi.advanceTimersByTimeAsync(10);
  if (!out) {
    const tail = (f?: readonly { cmd: number; rate: number; heard: boolean }[]) =>
      JSON.stringify(f?.slice(-3).map((x) => [x.cmd, x.rate, x.heard]));
    throw new Error(
      `still running after ${maxMs} ms of fake time; mock ${mock?.state}, host ${tail(mock?.hostFrames)}, radio ${tail(mock?.radioFrames)}`,
    );
  }
  return out;
}

async function connect(m: MockUv5rMini, updater: FirmwareUpdater, powerOnAfterMs?: number) {
  const p = await open(m);
  const ident = updater.identify(p);
  if (powerOnAfterMs === undefined) m.powerOn();
  else {
    await vi.advanceTimersByTimeAsync(powerOnAfterMs);
    m.powerOn();
  }
  return settle(ident, 40_000);
}

describe('UV-5R Mini updater: a clean update', () => {
  it('pings, runs the app stage at 9600, reopens once at 38400, serves the area and ends acknowledged', async () => {
    const m = make();
    const updater = createUv5rMiniFirmwareUpdater();
    const image = imageFor(m);
    const reopen = vi.spyOn(await open(m), 'reopen');
    const ident = updater.identify(pipe!);
    m.powerOn();
    const id = await settle(ident, 10_000);
    expect(id.error).toBeUndefined();
    expect(id.value).toMatchObject({ radioId: 'baofeng-uv5rmini', model: 'UV-5R Mini' });
    expect(id.value?.notice).toBeUndefined();

    const progress: FirmwareFlashProgress[] = [];
    const run = await settle(updater.flash(image, { onProgress: (p) => progress.push(p) }), 20_000);
    expect(run.error).toBeUndefined();
    const result = run.value as FirmwareFlashResult;
    expect(result.end).toBe('acknowledged');
    expect(result.dataFrames).toBe(8 + 9 + 8);
    expect(result.note).toBe(
      `The radio restarts by itself. Check the power-on screen shows ${BUILD}.`,
    );
    expect(m.state).toBe('finished');
    expect(m.badReplies).toBe(0);
    expect(m.loaderResets).toBe(0);
    expect(m.areaReads).toBe(8);

    // The link changed once, to the loader's rate, after the reply to the app's hand-over left at 9600.
    expect(reopen).toHaveBeenCalledTimes(1);
    expect(reopen).toHaveBeenCalledWith(UV5RMINI_FW_LOADER_BAUD);
    const firstFast = m.hostFrames.findIndex((f) => f.rate === UV5RMINI_FW_LOADER_BAUD);
    expect(m.hostFrames[firstFast - 1]).toMatchObject({ cmd: UV5RMINI_FW_CMD.BAUD, rate: 9600 });
    expect(m.hostFrames.every((f) => f.heard)).toBe(true);
    expect(m.hostFrames.every((f) => [1, 2, 3, 4, 6].includes(f.cmd))).toBe(true);
    // Pinging stopped at the pong.
    expect(m.hostFrames.filter((f) => f.cmd === UV5RMINI_FW_CMD.PING)).toHaveLength(1);

    // Phases in order; radioTouched flips with the loader's first hello, never before.
    const phases = progress.map((p) => p.phase);
    expect(phases[0]).toBe('handshake');
    const order = ['handshake', 'loader', 'erase', 'transfer', 'finish'];
    const collapsed = phases.filter((p, i) => p !== phases[i - 1]);
    expect(collapsed).toEqual(order);
    const firstTouched = progress.findIndex((p) => p.radioTouched);
    // The loader's hello is "Loader running", not an erase: Erase waits for its cmd 4.
    expect(progress[firstTouched]!.phase).toBe('loader');
    expect(progress[firstTouched]!.msg).toBe("The radio's loader is running");
    const firstErase = progress.findIndex((p) => p.phase === 'erase');
    expect(progress[firstErase]!.msg).toBe('The radio is erasing its firmware area');
    expect(progress.slice(0, firstTouched).every((p) => p.phase === 'handshake')).toBe(true);
    expect(progress.slice(firstTouched).every((p) => p.radioTouched)).toBe(true);
    const last = progress.at(-1)!;
    expect(last).toMatchObject({ phase: 'finish', cur: m.areaLength, max: m.areaLength });
    // The written / total count is in bytes of the area, for the wizard's count and time estimate.
    expect(last.written).toEqual({ done: m.areaLength, total: m.areaLength, unit: 'bytes' });
    expect(progress.filter((p) => p.phase === 'handshake').every((p) => !p.written)).toBe(true);
    // The erase message arrives with cmd 4.
    expect(progress.some((p) => p.msg === 'The radio is erasing its firmware area')).toBe(true);
  });

  it('runs the image checks at Prepare (checkImage) and again at the start of flash, with one argument', async () => {
    const m = make();
    const updater = createUv5rMiniFirmwareUpdater();
    const image = imageFor(m);
    updater.checkImage(image);
    expect(interlocks.checkUv5rMiniImage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(interlocks.checkUv5rMiniImage).mock.calls[0]).toEqual([image]);

    expect((await connect(m, updater)).error).toBeUndefined();
    await settle(updater.flash(image, {}), 20_000);
    expect(interlocks.checkUv5rMiniImage).toHaveBeenCalledTimes(2);
  });

  it('says "back to stock" and gives the stock verify hint for a to-stock image', async () => {
    const m = make();
    const updater = createUv5rMiniFirmwareUpdater();
    const image = {
      ...imageFor(m),
      versionStamp: 'nrfb-v0.04',
      verifyHint: 'The radio boots to its normal screen.',
    } as PreparedFirmwareImage;
    expect((await connect(m, updater)).error).toBeUndefined();
    const run = await settle(updater.flash(image, {}), 20_000);
    expect((run.value as FirmwareFlashResult).note).toBe(
      'The radio restarts by itself, back to stock. The radio boots to its normal screen.',
    );
  });
});

describe('UV-5R Mini updater: rewriting the installed build', () => {
  // The interlock (interlocks.test.ts) asks for a confirm when the radio already runs the image's build; here it is
  // stood in for, so the run can show what the updater does with that answer.
  const askUnlessConfirmed = (img: PreparedFirmwareImage) => {
    if (!img.reinstallConfirmed) throw new RadioConfirmRequiredError('This radio already runs it.');
  };

  it('sends nothing at all until the operator has confirmed', async () => {
    vi.mocked(interlocks.checkUv5rMiniImage).mockImplementation(askUnlessConfirmed);
    try {
      const m = make();
      const updater = createUv5rMiniFirmwareUpdater();
      const image = { ...imageFor(m), radioBuild: BUILD } as PreparedFirmwareImage;
      expect(() => updater.checkImage(image)).toThrow(RadioConfirmRequiredError);

      expect((await connect(m, updater)).error).toBeUndefined();
      const sentBefore = m.hostFrames.length;
      const run = await settle(updater.flash(image, {}), 20_000);
      const err = run.error as FirmwareFlashError;
      expect(err).toBeInstanceOf(FirmwareFlashError);
      expect(err.cause).toBeInstanceOf(RadioConfirmRequiredError);
      expect(err.radioTouched).toBe(false);
      expect(m.hostFrames.length).toBe(sentBefore);
      expect(m.areaReads).toBe(0);
    } finally {
      vi.mocked(interlocks.checkUv5rMiniImage).mockReset();
    }
  });

  it('runs the update once the confirm is on the image', async () => {
    vi.mocked(interlocks.checkUv5rMiniImage).mockImplementation(askUnlessConfirmed);
    try {
      const m = make();
      const updater = createUv5rMiniFirmwareUpdater();
      const image = {
        ...imageFor(m),
        radioBuild: BUILD,
        reinstallConfirmed: true,
      } as PreparedFirmwareImage;
      updater.checkImage(image);
      expect((await connect(m, updater)).error).toBeUndefined();
      const run = await settle(updater.flash(image, {}), 20_000);
      expect(run.error).toBeUndefined();
      expect(run.value?.end).toBe('acknowledged');
      expect(m.state).toBe('finished');
    } finally {
      vi.mocked(interlocks.checkUv5rMiniImage).mockReset();
    }
  });
});

describe('UV-5R Mini updater: a cut update and its continuation', () => {
  it('a stall after cmd 4 is the recover message with the radio touched; the next run hears the loader and finishes', async () => {
    const m = make({ cutAfterAreaReads: 3 });
    const updater = createUv5rMiniFirmwareUpdater();
    const image = imageFor(m);
    expect((await connect(m, updater)).error).toBeUndefined();

    const first = await settle(updater.flash(image, {}), 90_000);
    const err = first.error as FirmwareFlashError;
    expect(err).toBeInstanceOf(FirmwareFlashError);
    expect(err.radioTouched).toBe(true);
    expect(err.message).toBe(UV5RMINI_MSG.recover);
    expect(err.position).toMatch(/^loader#\d+$/);
    expect(m.state).toBe('cut');
    await pipe!.close();

    // Power back on with no keys: the loader restarts from its record at 9600 and talks first.
    const again = createUv5rMiniFirmwareUpdater();
    const id = await connect(m, again, 100);
    expect(id.error).toBeUndefined();
    expect(id.value?.notice).toBe(UV5RMINI_MSG.continuing);
    expect(id.value?.version).toBe('update in progress');
    const progress: FirmwareFlashProgress[] = [];
    const run = await settle(again.flash(image, { onProgress: (p) => progress.push(p) }), 30_000);
    expect(run.error).toBeUndefined();
    expect(run.value?.end).toBe('acknowledged');
    expect(m.state).toBe('finished');
    // No app stage and no ping in the second run: the first frame heard went straight to the loader's rate.
    expect(progress[0]!.phase).toBe('handshake');
    expect(progress.some((p) => p.radioTouched)).toBe(true);
  });
});

describe('UV-5R Mini updater: refusals and silence', () => {
  it('a loader that refuses with 0x86 before cmd 4 (fresh session) says the firmware is already there, nothing erased', async () => {
    const m = make({ loaderRefuses: 0x86 });
    const updater = createUv5rMiniFirmwareUpdater();
    expect((await connect(m, updater)).error).toBeUndefined();
    const run = await settle(updater.flash(imageFor(m), {}), 20_000);
    const err = run.error as FirmwareFlashError;
    expect(err).toBeInstanceOf(FirmwareFlashError);
    expect(err.message).toBe(UV5RMINI_MSG.loaderAlready);
    expect(err.radioTouched).toBe(true);
    expect(err.position).toBe('result');
    expect(m.areaReads).toBe(0);
  });

  it('a loader that reads past the image before any cmd 4 is "already installed, nothing written", not an interlock', async () => {
    const m = make({ loaderReadsPastImage: true });
    const updater = createUv5rMiniFirmwareUpdater();
    expect((await connect(m, updater)).error).toBeUndefined();
    const progress: FirmwareFlashProgress[] = [];
    const run = await settle(
      updater.flash(imageFor(m), { onProgress: (p) => progress.push(p) }),
      20_000,
    );
    const err = run.error as FirmwareFlashError;
    expect(err).toBeInstanceOf(FirmwareFlashError);
    expect(err.code).toBe('alreadyInstalled');
    expect(err.cause).toBeInstanceOf(RadioAlreadyInstalledError);
    expect(err.message).toBe(UV5RMINI_MSG.alreadyInstalledRun);
    expect(err.message).toMatch(/already installed/);
    // Still refused: no area was announced, nothing was erased, and the progress never said Erase.
    expect(m.areaReads).toBe(0);
    expect(progress.some((p) => p.phase === 'erase')).toBe(false);
    expect(progress.some((p) => p.phase === 'loader')).toBe(true);
    // The out-of-image read got no reply: the radio's last frame is that read, and the host sent nothing after it.
    const asked = m.radioFrames.filter((f) => f.cmd === UV5RMINI_FW_CMD.DATA).length;
    const answered = m.hostFrames.filter((f) => f.cmd === UV5RMINI_FW_CMD.DATA).length;
    expect(m.radioFrames.at(-1)!.cmd).toBe(UV5RMINI_FW_CMD.DATA);
    expect(answered).toBe(asked - 1);
  });

  it('the same refusal in a continued session says the interrupted update had finished', async () => {
    const m = make({ restartFromRecord: true, loaderRefuses: 0x86 });
    const updater = createUv5rMiniFirmwareUpdater();
    const id = await connect(m, updater, 100);
    expect(id.value?.notice).toBe(UV5RMINI_MSG.continuing);
    const run = await settle(updater.flash(imageFor(m), {}), 20_000);
    expect((run.error as FirmwareFlashError).message).toBe(UV5RMINI_MSG.loaderFinished);
  });

  it('0x87 before cmd 4 (fresh session) says nothing was written and the radio boots the installed app', async () => {
    const m = make({ loaderRefuses: 0x87 });
    const updater = createUv5rMiniFirmwareUpdater();
    expect((await connect(m, updater)).error).toBeUndefined();
    const run = await settle(updater.flash(imageFor(m), {}), 20_000);
    const err = run.error as FirmwareFlashError;
    expect(err.message).toBe('Nothing was written; the radio boots the installed app.');
    expect(m.areaReads).toBe(0);
  });

  it('0x87 before cmd 4 in a continued session says the same, and not to send the file again', async () => {
    const m = make({ restartFromRecord: true, loaderRefuses: 0x87 });
    const updater = createUv5rMiniFirmwareUpdater();
    await connect(m, updater, 100);
    const run = await settle(updater.flash(imageFor(m), {}), 20_000);
    const msg = (run.error as FirmwareFlashError).message;
    expect(msg.startsWith(UV5RMINI_MSG.loaderNothingWritten)).toBe(true);
    expect(msg).toContain("Don't send this file again");
  });

  it('0x8F before cmd 4 says the file is not for the radio firmware and the FM presets and volume may be reset', async () => {
    const m = make({ loaderRefuses: 0x8f });
    const updater = createUv5rMiniFirmwareUpdater();
    expect((await connect(m, updater)).error).toBeUndefined();
    const run = await settle(updater.flash(imageFor(m), {}), 20_000);
    const err = run.error as FirmwareFlashError;
    expect(err.message).toBe(
      "The file isn't for this radio's firmware; the radio refused it. Its FM presets and volume may have been reset; nothing else changed.",
    );
    expect(err.radioTouched).toBe(true);
    expect(m.areaReads).toBe(0);
    // Typed, so the wizard says "nothing was installed" and not "recover the radio", although the loader ran.
    expect(err.code).toBe('nothingInstalled');
    expect(err.cause).toBeInstanceOf(RadioNothingInstalledError);
  });

  it('an app result 0x83 with no cmd 4 heard is the other layout: nothing installed, radio untouched', async () => {
    const m = make({ appResult: 0x83 });
    const updater = createUv5rMiniFirmwareUpdater();
    expect((await connect(m, updater)).error).toBeUndefined();
    const run = await settle(updater.flash(imageFor(m), {}), 20_000);
    const err = run.error as FirmwareFlashError;
    expect(err.code).toBe('nothingInstalled');
    expect(err.message).toBe(UV5RMINI_MSG.appOtherLayout);
    expect(err.radioTouched).toBe(false);
    expect(m.loaderResets).toBe(0);
  });

  it('an app result 0x01 writes nothing: radio untouched, the image is not for this radio’s key', async () => {
    const m = make({ appResult: 0x01 });
    const updater = createUv5rMiniFirmwareUpdater();
    expect((await connect(m, updater)).error).toBeUndefined();
    const run = await settle(updater.flash(imageFor(m), {}), 20_000);
    const err = run.error as FirmwareFlashError;
    expect(err.radioTouched).toBe(false);
    expect(err.message).toContain(
      'Nothing was written to the firmware. Switch the radio off and on.',
    );
    expect(err.message).toContain("not for this radio's key");
    expect(err.position).toBe('result');
    expect(m.loaderResets).toBe(0);
  });

  it('an app result 0x8A names another stock version', async () => {
    const m = make({ appResult: 0x8a });
    const updater = createUv5rMiniFirmwareUpdater();
    await connect(m, updater);
    const run = await settle(updater.flash(imageFor(m), {}), 20_000);
    expect((run.error as FirmwareFlashError).message).toContain('another stock version');
  });

  it('no answer: pings for 30 s, nothing else is sent, and the message says so', async () => {
    const m = make({ ignorePing: true });
    const updater = createUv5rMiniFirmwareUpdater();
    const id = await connect(m, updater);
    const err = id.error as FirmwareFlashError;
    expect(err).toBeInstanceOf(FirmwareFlashError);
    expect(err.message).toBe(UV5RMINI_MSG.noAnswer);
    expect(err.radioTouched).toBe(false);
    expect(err.position).toBe('ping');
    expect(m.hostFrames.length).toBeGreaterThanOrEqual(29);
    expect(m.hostFrames.every((f) => f.cmd === UV5RMINI_FW_CMD.PING)).toBe(true);
  });

  it('flash without a prior identify, or on a pipe that cannot reopen, sends nothing', async () => {
    const m = make();
    const updater = createUv5rMiniFirmwareUpdater();
    const bare = await settle(updater.flash(imageFor(m), {}), 1_000);
    expect(bare.error).toBeInstanceOf(FirmwareFlashError);
    expect((bare.error as FirmwareFlashError).radioTouched).toBe(false);

    const real = await open(m);
    const noReopen: BytePipe = {
      write: (d) => real.write(d),
      readExact: (n, t) => real.readExact(n, t),
      drain: () => real.drain!(),
      flush: () => real.flush!(),
      close: () => real.close(),
    };
    const ident = updater.identify(noReopen);
    m.powerOn();
    expect((await settle(ident, 10_000)).error).toBeUndefined();
    const sent = m.hostFrames.length;
    const run = await settle(updater.flash(imageFor(m), {}), 1_000);
    expect((run.error as FirmwareFlashError).message).toContain('cannot change the line rate');
    expect(m.hostFrames.length).toBe(sent);
  });

  it('an abort during the update is honoured between frames and reported with the radio state', async () => {
    const m = make();
    const updater = createUv5rMiniFirmwareUpdater();
    expect((await connect(m, updater)).error).toBeUndefined();
    const abort = new AbortController();
    const run = settle(
      updater.flash(imageFor(m), {
        signal: abort.signal,
        onProgress: (p) => {
          if (p.phase === 'erase') abort.abort();
        },
      }),
      20_000,
    );
    const out = await run;
    const err = out.error as FirmwareFlashError;
    expect(err).toBeInstanceOf(FirmwareFlashError);
    expect(err.code).toBe('aborted');
    expect(err.radioTouched).toBe(true);
  });
});

describe('UV-5R Mini updater: the progress count', () => {
  it('counts distinct bytes read, so a block asked for twice counts once', () => {
    const c = createCoveredBytes();
    c.add(0, 0x1000);
    c.add(0x1000, 0x1000);
    c.add(0x1000, 0x1000); // asked again on a slow host
    expect(c.total()).toBe(0x2000);
    c.add(0x4000, 0x1000); // out of order
    expect(c.total()).toBe(0x3000);
    c.add(0x1800, 0x3000); // bridges the gap
    expect(c.total()).toBe(0x5000);
    c.add(0x9000, 0);
    expect(c.total()).toBe(0x5000);
  });
});
