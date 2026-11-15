import { describe, expect, it, vi } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { createAtD890DebugGuard, captureAtD890DebugPipe } from './debugCapture.ts';

function fake(): BytePipe & { writes: Uint8Array[] } {
  const writes: Uint8Array[] = [];
  return {
    writes,
    write: async (data) => {
      writes.push(data.slice());
    },
    readExact: async (n) => new Uint8Array(n),
    close: vi.fn(async () => {}),
  };
}

describe('D890 debug send guard', () => {
  it.each([
    [],
    [0x57],
    [0x57, 0, 0, 0, 0, 16],
    [0x52, 0, 0, 0, 0, 0],
    [0x52, 0, 0, 0, 0, 17],
    [0x52, 0, 0, 0, 0, 255],
    [80, 82, 79, 71, 82, 65, 77, 0],
    [80, 82, 79, 71, 82, 65, 78],
    [3],
    [2, 0],
    [69, 78],
    [69, 78, 68, 0],
    [69, 78, 69],
    [80, 82, 79, 71, 82, 65, 77, 2],
    [0x45],
    [0x58],
    [0x43, 6, 0],
    [0x44, 0x57],
    [0xff],
    [69, 78, 68],
    [2, 2],
    [80, 82, 79, 71, 82, 65],
    [0x52, 0, 0, 0, 0],
    [0x52, 0, 0, 0, 0, 15],
    [0x52, 0, 0, 0, 0, 0xf1],
    [0x52, 0, 0, 0, 0, 16, 0],
  ])('refuses %j before transport', async (...frame) => {
    const pipe = fake();
    const guard = createAtD890DebugGuard(pipe);
    await expect(guard.pipe.write(Uint8Array.from(frame))).rejects.toThrow(/refused/);
    expect(pipe.writes).toHaveLength(0);
    await expect(guard.finish()).rejects.toThrow();
  });
  it('accepts only valid read and handshake frames', async () => {
    for (const frame of [
      [80, 82, 79, 71, 82, 65, 77],
      [2],
      [0x52, 0, 0, 0, 0, 16],
      [0x52, 0, 0, 0, 0, 0xf0],
    ]) {
      const pipe = fake();
      await createAtD890DebugGuard(pipe).pipe.write(Uint8Array.from(frame));
      expect(pipe.writes).toHaveLength(1);
    }
  });
  it('closes and never sends END when cancelled before entry', async () => {
    const pipe = fake();
    const controller = new AbortController();
    controller.abort();
    await expect(captureAtD890DebugPipe(pipe, { signal: controller.signal })).rejects.toThrow(
      /power-cycle/i,
    );
    expect(pipe.writes).toHaveLength(0);
    expect(pipe.close).toHaveBeenCalledOnce();
  });
  it('latches cancellation after an awaited read', async () => {
    const pipe = fake();
    const controller = new AbortController();
    pipe.readExact = async (n) => {
      controller.abort();
      return new Uint8Array(n);
    };
    const guard = createAtD890DebugGuard(pipe, controller.signal);
    await expect(guard.pipe.readExact(1, 100)).rejects.toThrow();
    await expect(guard.finish()).rejects.toThrow();
    expect(pipe.writes).toHaveLength(0);
  });
});
