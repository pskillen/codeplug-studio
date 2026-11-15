import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtD890ScriptedPipe } from './__fixtures__/scriptedPipe.ts';
import { D890_MAP } from './constants.ts';
import { captureAtD890DebugPipe } from './debugCapture.ts';
import { downloadAtD890SparseRegions } from './protocol.ts';
import { readAtD890VitalUnits } from './vitalBackup.ts';

vi.mock('./protocol.ts', () => ({ downloadAtD890SparseRegions: vi.fn(async () => {}) }));
vi.mock('./vitalBackup.ts', () => ({
  readAtD890VitalUnits: vi.fn(async () => ({ units: [], bothReadsMatched: true })),
}));
function radio(flags: number[]) {
  const pipe = new AtD890ScriptedPipe();
  const ident = new Uint8Array(16);
  ident.set(new TextEncoder().encode('ID890UV'), 0);
  ident.set(new TextEncoder().encode('V100'), 9);
  pipe.enqueue(new Uint8Array([0x51, 0x58, 6]), ident);
  pipe.readResponder = (address, length) => {
    expect(address).toBe(D890_MAP.LocalInfo);
    const data = new Uint8Array(length);
    data[0] = flags.shift() ?? 0;
    return data;
  };
  vi.spyOn(pipe, 'close');
  return pipe;
}
const ends = (pipe: AtD890ScriptedPipe) =>
  pipe.writes.filter((w) => new TextDecoder().decode(w) === 'END');
beforeEach(() => {
  vi.clearAllMocks();
});
describe('D890 debug session finish', () => {
  it('sends one END immediately after a fresh LocalInfo request', async () => {
    const pipe = radio([0, 0]);
    await captureAtD890DebugPipe(pipe);
    expect(ends(pipe)).toHaveLength(1);
    expect(pipe.writes.at(-2)).toEqual(new Uint8Array([0x52, 4, 0xf8, 0, 0, 16]));
    expect(pipe.close).toHaveBeenCalledOnce();
  });
  it.each([
    [1, 0],
    [0, 1],
  ])('refuses flagged initial or final LocalInfo', async (initial, final) => {
    const pipe = radio([initial, final]);
    await expect(captureAtD890DebugPipe(pipe)).rejects.toThrow(/power-cycle/i);
    expect(ends(pipe)).toHaveLength(0);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
  it.each(['bulk', 'vital'])('refuses END after %s failure', async (stage) => {
    if (stage === 'bulk')
      vi.mocked(downloadAtD890SparseRegions).mockRejectedValueOnce(new Error('bulk failure'));
    else vi.mocked(readAtD890VitalUnits).mockRejectedValueOnce(new Error('vital mismatch'));
    const pipe = radio([0]);
    await expect(captureAtD890DebugPipe(pipe)).rejects.toThrow(/power-cycle/i);
    expect(ends(pipe)).toHaveLength(0);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
  it('refuses END when cancelled after vital reads', async () => {
    const controller = new AbortController();
    vi.mocked(readAtD890VitalUnits).mockImplementationOnce(async () => {
      controller.abort();
      return { units: [], bothReadsMatched: true };
    });
    const pipe = radio([0]);
    await expect(captureAtD890DebugPipe(pipe, { signal: controller.signal })).rejects.toThrow(
      /power-cycle/i,
    );
    expect(ends(pipe)).toHaveLength(0);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
  it('refuses END when cancelled during the final LocalInfo reply', async () => {
    const controller = new AbortController();
    const pipe = radio([0, 0]);
    const original = pipe.readExact.bind(pipe);
    let localReads = 0;
    pipe.readExact = async (n, timeout) => {
      const reply = await original(n, timeout);
      if (n === 24 && ++localReads === 2) controller.abort();
      return reply;
    };
    await expect(captureAtD890DebugPipe(pipe, { signal: controller.signal })).rejects.toThrow(
      /power-cycle/i,
    );
    expect(ends(pipe)).toHaveLength(0);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
  it.each(
    ['timeout', 'short', 'checksum', 'address'].flatMap((fault) =>
      [1, 2].map((phase) => [fault, phase] as const),
    ),
  )('refuses END on %s LocalInfo reply %i', async (fault, phase) => {
    const pipe = radio([0, 0, 0, 0]);
    const original = pipe.readExact.bind(pipe);
    let reads = 0;
    pipe.readExact = async (n, timeout) => {
      if (n !== 24) return original(n, timeout);
      if (++reads < phase) return original(n, timeout);
      if (fault === 'timeout') throw new Error('timeout');
      const reply = await original(n, timeout);
      if (fault === 'short') return reply.subarray(0, 5);
      if (fault === 'checksum') reply[22] = reply[22]! ^ 1;
      if (fault === 'address') reply[4] = reply[4]! ^ 1;
      return reply;
    };
    await expect(captureAtD890DebugPipe(pipe)).rejects.toThrow(/power-cycle/i);
    expect(ends(pipe)).toHaveLength(0);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
  it.each(['sparse', 'vital'])('refuses END on cancellation during %s', async (stage) => {
    const controller = new AbortController();
    const { atD890ReadMemory } = await import('./connection.ts');
    if (stage === 'sparse')
      vi.mocked(downloadAtD890SparseRegions).mockImplementationOnce(async (pipe) => {
        await atD890ReadMemory(pipe, D890_MAP.LocalInfo, 16, controller.signal);
      });
    else
      vi.mocked(readAtD890VitalUnits).mockImplementationOnce(async (session) => {
        await atD890ReadMemory(session.pipe, D890_MAP.LocalInfo, 16, controller.signal);
        return { units: [], bothReadsMatched: true };
      });
    const pipe = radio([0, 0]);
    const original = pipe.readExact.bind(pipe);
    let reads = 0;
    pipe.readExact = async (n, timeout) => {
      const reply = await original(n, timeout);
      if (n === 24 && ++reads === 2) controller.abort();
      return reply;
    };
    await expect(captureAtD890DebugPipe(pipe, { signal: controller.signal })).rejects.toThrow(
      /power-cycle/i,
    );
    expect(ends(pipe)).toHaveLength(0);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
  it('refuses END when cancellation arrives immediately before its write', async () => {
    const controller = new AbortController();
    const pipe = radio([0, 0]);
    const read = pipe.readExact.bind(pipe);
    let reads = 0,
      finalReturned = false,
      checks = 0;
    pipe.readExact = async (n, timeout) => {
      const value = await read(n, timeout);
      if (n === 24 && ++reads === 2) finalReturned = true;
      return value;
    };
    const getAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')!.get!;
    vi.spyOn(controller.signal, 'aborted', 'get').mockImplementation(() => {
      if (finalReturned && ++checks === 2) controller.abort();
      return getAborted.call(controller.signal);
    });
    await expect(captureAtD890DebugPipe(pipe, { signal: controller.signal })).rejects.toThrow(
      /power-cycle/i,
    );
    expect(checks).toBeGreaterThanOrEqual(2);
    expect(ends(pipe)).toHaveLength(0);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
});
