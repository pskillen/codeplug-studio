import { describe, expect, it, vi } from 'vitest';

import { RadioTimeoutError, RadioWrongIdentError, type BytePipe } from '@integrations/radio-io';

import { isHandshakeConnectFailure, openWithBaudFallback } from './serialBaudFallback.ts';

function fakePipe(baud: number) {
  return {
    baud,
    write: async () => {},
    readExact: async () => new Uint8Array(0),
    close: vi.fn(async () => {}),
  };
}

describe('openWithBaudFallback', () => {
  it('returns the first rate that answers, closing the ones that did not', async () => {
    const pipes: ReturnType<typeof fakePipe>[] = [];
    const open = vi.fn(async (baud: number) => {
      const p = fakePipe(baud);
      pipes.push(p);
      return p as unknown as BytePipe;
    });
    const handshake = vi
      .fn()
      .mockRejectedValueOnce(new RadioTimeoutError('No answer.'))
      .mockResolvedValueOnce('ok');
    const out = await openWithBaudFallback({ bauds: [115200, 38400], open, handshake });
    expect(open.mock.calls.map((c) => c[0])).toEqual([115200, 38400]);
    expect(out.result).toBe('ok');
    expect(out.pipe).toBe(pipes[1]);
    expect(pipes[0]!.close).toHaveBeenCalledTimes(1);
    expect(pipes[1]!.close).not.toHaveBeenCalled();
  });

  it('stops at a failure that is not a handshake one, and closes', async () => {
    const pipe = fakePipe(115200);
    const open = vi.fn(async () => pipe as unknown as BytePipe);
    const err = new Error('Port lost.');
    await expect(
      openWithBaudFallback({
        bauds: [115200, 38400],
        open,
        handshake: async () => {
          throw err;
        },
      }),
    ).rejects.toBe(err);
    expect(open).toHaveBeenCalledTimes(1);
    expect(pipe.close).toHaveBeenCalledTimes(1);
  });

  it('throws the last failure, shaped by mapError with the rates tried', async () => {
    const open = vi.fn(async (baud: number) => fakePipe(baud) as unknown as BytePipe);
    const mapError = vi.fn((e: unknown, tried: readonly number[]) => new Error(`${e} ${tried}`));
    await expect(
      openWithBaudFallback({
        bauds: [115200, 38400],
        open,
        handshake: async () => {
          throw new RadioWrongIdentError('Wrong.');
        },
        mapError,
      }),
    ).rejects.toThrow('115200,38400');
    expect(open).toHaveBeenCalledTimes(2);
    expect(mapError).toHaveBeenCalledTimes(1);
  });

  it('treats no answer and a wrong ident as handshake failures only', () => {
    expect(isHandshakeConnectFailure(new RadioTimeoutError('x'))).toBe(true);
    expect(isHandshakeConnectFailure(new RadioWrongIdentError())).toBe(true);
    expect(isHandshakeConnectFailure(new Error('x'))).toBe(false);
  });
});
