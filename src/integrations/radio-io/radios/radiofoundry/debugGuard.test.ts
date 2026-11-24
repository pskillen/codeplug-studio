import { describe, expect, it, vi } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioAbortedError } from '../../kit/errors.ts';
import { encodeDebugFrame, decodeDebugFrame } from '../../kit/codecs/radioFoundryDebugLink.ts';
import {
  BLOCK_SIZE,
  CODEPLUG_COMMAND,
  OP_ABORT,
  OP_BEGIN,
  OP_BLOCK,
  OP_COMMIT,
  OP_DATA,
  OP_END,
  OP_INFO,
  OP_READ,
  OP_SUMS,
} from './constants.ts';
import { RADIOFOUNDRY_STORAGE_COMMAND } from './storageInfo.ts';
import { SATELLITE_COMMAND } from './satellite.ts';
import { DMR_ID_DATABASE_AREA2_ADDRESS } from './idDatabase.ts';
import { MD9600_RADIOFOUNDRY_CABLE_BOARD, DM32UV_RADIOFOUNDRY_CABLE_BOARD } from './board.ts';
import {
  classifyRadioFoundryDebugFrame,
  createRadioFoundryDebugGuard,
  encodeRefusedCodeplugFrame,
  encodeRefusedDebugCommand,
  RadioFoundryDebugRefusedError,
} from './debugGuard.ts';

const BOARD = MD9600_RADIOFOUNDRY_CABLE_BOARD;
const CEILING = BOARD.limits.IMAGE_END;

function u32le(addr: number): number[] {
  return [addr & 0xff, (addr >>> 8) & 0xff, (addr >>> 16) & 0xff, (addr >>> 24) & 0xff];
}

const INFO = encodeDebugFrame(CODEPLUG_COMMAND, 1, Uint8Array.of(OP_INFO));
const VERSION = encodeDebugFrame(0x02, 2, new Uint8Array(0));
const SUMS0_16 = encodeDebugFrame(CODEPLUG_COMMAND, 3, Uint8Array.from([OP_SUMS, ...u32le(0), 16]));
const SUMS_FLASH = encodeDebugFrame(
  CODEPLUG_COMMAND,
  4,
  Uint8Array.from([OP_SUMS, ...u32le(0x20000), 1]),
);
const READ_AREA2 = encodeDebugFrame(
  CODEPLUG_COMMAND,
  5,
  Uint8Array.from([OP_READ, ...u32le(DMR_ID_DATABASE_AREA2_ADDRESS), 0, 0]),
);
const IDDB0 = encodeDebugFrame(0x1f, 6, new Uint8Array(4));

function spyPipe() {
  const write = vi.fn(async (data: Uint8Array) => void data.length);
  const readExact = vi.fn(async (n: number) => new Uint8Array(n));
  const flush = vi.fn(async () => undefined);
  const drain = vi.fn(async () => new Uint8Array(0));
  const close = vi.fn(async () => undefined);
  const pipe: BytePipe = { write, readExact, flush, drain, close };
  return { pipe, write, readExact, flush, drain, close };
}

async function afterInfo(signal?: AbortSignal) {
  const spy = spyPipe();
  const guard = createRadioFoundryDebugGuard(spy.pipe, BOARD, signal);
  await guard.pipe.write(INFO);
  spy.write.mockClear();
  return { ...spy, guard };
}

describe('classifyRadioFoundryDebugFrame', () => {
  it.each([
    ['info', INFO, 'info'],
    ['version', VERSION, 'version'],
    ['sums', SUMS0_16, 'sums'],
    ['sums flash', SUMS_FLASH, 'sums'],
    ['read area2', READ_AREA2, 'read'],
    ['iddb', IDDB0, 'iddb'],
  ] as const)('allows %s', (_name, frame, kind) => {
    expect(classifyRadioFoundryDebugFrame(frame, CEILING)).toEqual({ allowed: true, kind });
  });

  it.each([
    ['CODEPLUG op 3 BEGIN', encodeRefusedCodeplugFrame(OP_BEGIN)],
    ['CODEPLUG op 4 BLOCK', encodeRefusedCodeplugFrame(OP_BLOCK)],
    ['CODEPLUG op 5 DATA', encodeRefusedCodeplugFrame(OP_DATA)],
    ['CODEPLUG op 6 END', encodeRefusedCodeplugFrame(OP_END)],
    ['CODEPLUG op 7 COMMIT', encodeRefusedCodeplugFrame(OP_COMMIT)],
    ['CODEPLUG op 8 STATUS', encodeRefusedCodeplugFrame(8)],
    ['CODEPLUG op 9 ABORT', encodeRefusedCodeplugFrame(OP_ABORT)],
    ['CODEPLUG op 10', encodeRefusedCodeplugFrame(10)],
    ['STORAGE op 0', encodeRefusedDebugCommand(RADIOFOUNDRY_STORAGE_COMMAND, [0])],
    ['STORAGE op 2', encodeRefusedDebugCommand(RADIOFOUNDRY_STORAGE_COMMAND, [2])],
    ['SATELLITE', encodeRefusedDebugCommand(SATELLITE_COMMAND)],
    ['REBOOT', encodeRefusedDebugCommand(0x0d)],
    ['KEY', encodeRefusedDebugCommand(0x06)],
    ['PTT', encodeRefusedDebugCommand(0x07)],
    ['RADIO', encodeRefusedDebugCommand(0x0a)],
    ['READ_MEM', encodeRefusedDebugCommand(0x0c)],
    ['PING', encodeRefusedDebugCommand(0x01)],
    ['CPKV', encodeRefusedDebugCommand(0x23)],
    ['IDDB id 1', encodeDebugFrame(0x1f, 1, Uint8Array.of(1, 0, 0, 0))],
    ['INFO 2-byte payload', encodeDebugFrame(CODEPLUG_COMMAND, 1, Uint8Array.of(OP_INFO, 0))],
    ['VERSION with payload', encodeDebugFrame(0x02, 1, Uint8Array.of(0x61))],
  ])('refuses %s', (_name, frame) => {
    expect(classifyRadioFoundryDebugFrame(frame, CEILING).allowed).toBe(false);
  });

  it.each([
    ['OpenGD77 R', new Uint8Array([0x52, 0x01, 0, 0, 0, 0, 0, 8])],
    ['OpenGD77 W', new Uint8Array([0x57, 0x01, 0, 0, 0, 0, 0, 1, 0])],
    ['OpenGD77 X', new Uint8Array([0x58, 0x01, 0, 0, 0])],
    ['OpenGD77 C', new Uint8Array([0x43, 0xfe])],
    ['MMDVM E0', new Uint8Array([0xe0])],
  ])('refuses %s', (_name, frame) => {
    expect(classifyRadioFoundryDebugFrame(frame, CEILING).allowed).toBe(false);
  });

  it('refuses two frames in one write', () => {
    const both = new Uint8Array(INFO.length + VERSION.length);
    both.set(INFO, 0);
    both.set(VERSION, INFO.length);
    expect(classifyRadioFoundryDebugFrame(both, CEILING).allowed).toBe(false);
  });

  it('refuses bad CRC', () => {
    const bad = INFO.slice();
    bad[bad.length - 1] ^= 0xff;
    expect(classifyRadioFoundryDebugFrame(bad, CEILING).allowed).toBe(false);
  });

  it('refuses truncated frame', () => {
    expect(classifyRadioFoundryDebugFrame(INFO.subarray(0, INFO.length - 2), CEILING).allowed).toBe(
      false,
    );
  });

  it('refuses SUMS at 0x10000 gap', () => {
    const frame = encodeDebugFrame(
      CODEPLUG_COMMAND,
      1,
      Uint8Array.from([OP_SUMS, ...u32le(0x10000), 1]),
    );
    expect(classifyRadioFoundryDebugFrame(frame, CEILING).allowed).toBe(false);
  });

  it('refuses SUMS from 0xF000 count 2 crossing the gap', () => {
    const frame = encodeDebugFrame(
      CODEPLUG_COMMAND,
      1,
      Uint8Array.from([OP_SUMS, ...u32le(0xf000), 2]),
    );
    expect(classifyRadioFoundryDebugFrame(frame, CEILING).allowed).toBe(false);
  });

  it('refuses READ at board image end', () => {
    const frame = encodeDebugFrame(
      CODEPLUG_COMMAND,
      1,
      Uint8Array.from([OP_READ, ...u32le(CEILING), 0, 0]),
    );
    expect(classifyRadioFoundryDebugFrame(frame, CEILING).allowed).toBe(false);
  });

  it('refuses misaligned READ at 0x20800', () => {
    const frame = encodeDebugFrame(
      CODEPLUG_COMMAND,
      1,
      Uint8Array.from([OP_READ, ...u32le(0x20800), 0, 0]),
    );
    expect(classifyRadioFoundryDebugFrame(frame, CEILING).allowed).toBe(false);
  });

  it('refuses READ past a lowered image end', () => {
    const lowered = 0x90000;
    const frame = encodeDebugFrame(
      CODEPLUG_COMMAND,
      1,
      Uint8Array.from([OP_READ, ...u32le(DMR_ID_DATABASE_AREA2_ADDRESS), 0, 0]),
    );
    expect(classifyRadioFoundryDebugFrame(frame, lowered).allowed).toBe(false);
  });
});

describe('createRadioFoundryDebugGuard', () => {
  it('forwards allowed frames after INFO', async () => {
    const spy = spyPipe();
    const guard = createRadioFoundryDebugGuard(spy.pipe, BOARD);
    for (const frame of [INFO, VERSION, SUMS0_16, READ_AREA2, IDDB0]) {
      await guard.pipe.write(frame);
    }
    expect(spy.write).toHaveBeenCalledTimes(5);
  });

  it('refuses SUMS before any INFO', async () => {
    const spy = spyPipe();
    const guard = createRadioFoundryDebugGuard(spy.pipe, BOARD);
    await expect(guard.pipe.write(SUMS0_16)).rejects.toBeInstanceOf(RadioFoundryDebugRefusedError);
    expect(spy.write).not.toHaveBeenCalled();
  });

  it('latches after refusal', async () => {
    const { guard, write } = await afterInfo();
    await expect(guard.pipe.write(encodeRefusedCodeplugFrame(OP_BEGIN))).rejects.toBeInstanceOf(
      RadioFoundryDebugRefusedError,
    );
    expect(write).not.toHaveBeenCalled();
    await expect(guard.pipe.write(INFO)).rejects.toBeInstanceOf(RadioFoundryDebugRefusedError);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([
    ['CODEPLUG op 3 BEGIN', encodeRefusedCodeplugFrame(OP_BEGIN)],
    ['PING', encodeRefusedDebugCommand(0x01)],
    ['OpenGD77 R', new Uint8Array([0x52, 0x01, 0, 0, 0, 0, 0, 8])],
  ])('refuses %s before transport and latches', async (_name, frame) => {
    const { guard, write } = await afterInfo();
    await expect(guard.pipe.write(frame)).rejects.toBeInstanceOf(RadioFoundryDebugRefusedError);
    expect(write).not.toHaveBeenCalled();
  });

  it('throws RadioAbortedError after signal aborts', async () => {
    const ac = new AbortController();
    const spy = spyPipe();
    const guard = createRadioFoundryDebugGuard(spy.pipe, BOARD, ac.signal);
    ac.abort();
    await expect(guard.pipe.write(INFO)).rejects.toBeInstanceOf(RadioAbortedError);
    expect(spy.write).not.toHaveBeenCalled();
  });

  it('lowers ceiling with limitImageEnd', async () => {
    const spy = spyPipe();
    const guard = createRadioFoundryDebugGuard(spy.pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await guard.pipe.write(INFO);
    guard.limitImageEnd(0x90000);
    const past = encodeDebugFrame(
      CODEPLUG_COMMAND,
      2,
      Uint8Array.from([OP_READ, ...u32le(DMR_ID_DATABASE_AREA2_ADDRESS), 0, 0]),
    );
    await expect(guard.pipe.write(past)).rejects.toBeInstanceOf(RadioFoundryDebugRefusedError);
    expect(spy.write).toHaveBeenCalledTimes(1);
  });

  it('never raises limitImageEnd', () => {
    const spy = spyPipe();
    const guard = createRadioFoundryDebugGuard(spy.pipe, BOARD);
    const before = BOARD.limits.IMAGE_END;
    guard.limitImageEnd(before);
    guard.limitImageEnd(before + 0x10000);
    const frame = encodeDebugFrame(
      CODEPLUG_COMMAND,
      1,
      Uint8Array.from([OP_READ, ...u32le(CEILING - BLOCK_SIZE), 0, 0]),
    );
    expect(classifyRadioFoundryDebugFrame(frame, before).allowed).toBe(true);
  });

  it('records the first 64 bytes from readExact in received()', async () => {
    const spy = spyPipe();
    const payload = new Uint8Array(80);
    payload.fill(0xab);
    spy.readExact.mockImplementation(async (n: number) => payload.slice(0, n));
    const guard = createRadioFoundryDebugGuard(spy.pipe, BOARD);
    await guard.pipe.readExact(80);
    expect(guard.received()).toHaveLength(64);
    expect(guard.received().every((b) => b === 0xab)).toBe(true);
  });

  it('accepts INFO repeat after first INFO', async () => {
    const { guard, write } = await afterInfo();
    await guard.pipe.write(INFO);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
