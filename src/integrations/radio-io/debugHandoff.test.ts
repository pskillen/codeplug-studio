import { describe, expect, it, vi } from 'vitest';
import { debugOpenPort, DebugWrongFirmwareError } from './debugHandoff.ts';

describe('debugOpenPort', () => {
  it('closes the transport once and is safe to call twice', async () => {
    const close = vi.fn(async () => {});
    const port = debugOpenPort({ close } as never, 'web-serial', 115_200);
    await port.close();
    await port.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('DebugWrongFirmwareError', () => {
  it('carries found, port and received', () => {
    const received = new Uint8Array([0x2d]);
    const err = new DebugWrongFirmwareError('opengd77', 'msg', undefined, received);
    expect(err.found).toBe('opengd77');
    expect(err.message).toBe('msg');
    expect(err.received).toEqual(received);
    expect(err.name).toBe('DebugWrongFirmwareError');
  });
});