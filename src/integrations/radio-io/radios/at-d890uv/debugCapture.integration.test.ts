import { expect, it, vi } from 'vitest';
import { AtD890ScriptedPipe } from './__fixtures__/scriptedPipe.ts';
import { captureAtD890DebugPipe } from './debugCapture.ts';
import { D890_MAP } from './constants.ts';

vi.mock('./protocol.ts', () => ({ downloadAtD890SparseRegions: vi.fn(async () => {}) }));

it('runs the real two-pass vital reader through the guard and finishes after a fresh check', async () => {
  const pipe = new AtD890ScriptedPipe();
  const ident = new Uint8Array(16);
  ident.set(new TextEncoder().encode('ID890UV'));
  ident.set(new TextEncoder().encode('V100'), 9);
  pipe.enqueue(new Uint8Array([0x51, 0x58, 6]), ident);
  pipe.readResponder = (_address, length) => new Uint8Array(length);
  vi.spyOn(pipe, 'close');
  const result = await captureAtD890DebugPipe(pipe);
  expect(result.vital.units).toHaveLength(4);
  expect(result.vital.bothReadsMatched).toBe(true);
  expect(pipe.writes.at(-2)).toEqual(
    new Uint8Array([
      0x52,
      D890_MAP.LocalInfo >>> 24,
      (D890_MAP.LocalInfo >>> 16) & 255,
      (D890_MAP.LocalInfo >>> 8) & 255,
      D890_MAP.LocalInfo & 255,
      16,
    ]),
  );
  expect(new TextDecoder().decode(pipe.writes.at(-1))).toBe('END');
  expect(pipe.writes.filter((frame) => frame[0] === 0x57)).toHaveLength(0);
  expect(pipe.close).toHaveBeenCalledOnce();
}, 30000);
