import { describe, expect, it, vi } from 'vitest';

import { RadioInterlockError, RadioTimeoutError } from '../kit/errors.ts';
import type { BytePipe } from '../types.ts';
import { FirmwareFlashError } from './errors.ts';
import { createGuardedSend } from './guardedSend.ts';

function fakePipe(order: string[]) {
  const write = vi.fn<(frame: Uint8Array) => Promise<void>>(async () => {
    order.push('write');
  });
  const pipe: BytePipe = {
    write,
    readExact: async () => new Uint8Array(0),
    close: async () => {},
  };
  return { pipe, write };
}

describe('createGuardedSend', () => {
  it('runs the check before writing', async () => {
    const order: string[] = [];
    const { pipe, write } = fakePipe(order);
    const send = createGuardedSend(pipe, () => {
      order.push('check');
    });
    const frame = new Uint8Array([1, 2, 3]);
    await send(frame);
    expect(order).toEqual(['check', 'write']);
    expect(write).toHaveBeenCalledWith(frame);
  });

  it('never writes when the check refuses, and the interlock error propagates', async () => {
    const { pipe, write } = fakePipe([]);
    const send = createGuardedSend(pipe, () => {
      throw new RadioInterlockError('refused');
    });
    await expect(send(new Uint8Array([1]))).rejects.toBeInstanceOf(RadioInterlockError);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('FirmwareFlashError', () => {
  it('keeps the cause code, radioTouched and position', () => {
    const err = new FirmwareFlashError({
      cause: new RadioTimeoutError('slow'),
      radioTouched: true,
      position: 'block#57',
    });
    expect(err.code).toBe('timeout');
    expect(err.message).toBe('slow');
    expect(err.radioTouched).toBe(true);
    expect(err.position).toBe('block#57');
    expect(err.name).toBe('FirmwareFlashError');
  });

  it('uses the protocol code for causes outside radio I/O', () => {
    const err = new FirmwareFlashError({ cause: 'x', radioTouched: false, position: 'init' });
    expect(err.code).toBe('protocol');
  });
});
