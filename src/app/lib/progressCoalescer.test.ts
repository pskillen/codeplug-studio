import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import { createProgressCoalescer } from './progressCoalescer.ts';

const ev = (stage: string, cur: number, max = 1_000_000): ProgressUpdate => ({
  stage,
  cur,
  max,
  msg: '',
});

describe('createProgressCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('turns a burst into about 10 Hz and ends on the exact last event', () => {
    const out: ProgressUpdate[] = [];
    const c = createProgressCoalescer((e) => out.push(e), { now: () => Date.now() });
    // 10,000 events over 1 s of fake time (10 per fake ms).
    for (let i = 1; i <= 10_000; i++) {
      c.push(ev('Upload', i));
      if (i % 10 === 0) vi.advanceTimersByTime(1);
    }
    vi.advanceTimersByTime(200);
    expect(out.length).toBeLessThanOrEqual(15);
    expect(out.length).toBeGreaterThanOrEqual(8);
    expect(out[out.length - 1]!.cur).toBe(10_000);
    const curs = out.map((e) => e.cur);
    expect([...curs].sort((a, b) => a - b)).toEqual(curs);
  });

  it('emits stage changes and stage completions immediately, in order', () => {
    const out: ProgressUpdate[] = [];
    const c = createProgressCoalescer((e) => out.push(e), { now: () => Date.now() });
    c.push(ev('A', 1));
    c.push(ev('A', 2)); // coalesced
    c.push(ev('B', 1)); // stage change: immediate
    c.push(ev('B', 2)); // coalesced
    c.push(ev('B', 5, 5)); // completes: immediate
    expect(out.map((e) => `${e.stage}${e.cur}`)).toEqual(['A1', 'B1', 'B5']);
    c.push(ev('B', 6, 7));
    vi.advanceTimersByTime(100);
    expect(out[out.length - 1]!.cur).toBe(6);
  });

  it('flush emits the pending event and cancel drops it', () => {
    const out: ProgressUpdate[] = [];
    const c = createProgressCoalescer((e) => out.push(e), { now: () => Date.now() });
    c.push(ev('A', 1));
    c.push(ev('A', 2));
    c.flush();
    expect(out.map((e) => e.cur)).toEqual([1, 2]);
    c.push(ev('A', 3));
    c.cancel();
    vi.advanceTimersByTime(500);
    expect(out.map((e) => e.cur)).toEqual([1, 2]);
  });

  it('cancel forgets the last emit time, so the first event of a new run is not delayed', () => {
    const out: ProgressUpdate[] = [];
    const c = createProgressCoalescer((e) => out.push(e), { now: () => Date.now() });
    c.push(ev('A', 1));
    vi.advanceTimersByTime(10);
    c.cancel();
    c.push(ev('A', 1)); // 10 ms after the last emit: would be coalesced if cancel kept it
    expect(out.map((e) => e.cur)).toEqual([1, 1]);
  });
});
