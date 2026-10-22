import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FirmwareFlashPhase, FirmwareFlashProgress } from '@integrations/radio-io';

import {
  createFlashProgressThrottle,
  FLASH_WAITING_FOR_RADIO,
  transferDetail,
  visibleFlashPhases,
} from './flashProgressThrottle.ts';

const p = (
  phase: FirmwareFlashPhase,
  cur: number,
  radioTouched = true,
  max = 52_515,
): FirmwareFlashProgress => ({ phase, cur, max, msg: `${phase} ${cur}`, radioTouched });

describe('createFlashProgressThrottle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('coalesces a burst of 10,000 events into a handful of updates', () => {
    const deliver = vi.fn();
    const t = createFlashProgressThrottle(deliver);
    t.push(p('transfer', 0));
    for (let i = 1; i <= 10_000; i++) {
      t.push(p('transfer', i));
      if (i % 1000 === 0) vi.advanceTimersByTime(20);
    }
    vi.advanceTimersByTime(200);
    expect(deliver.mock.calls.length).toBeLessThan(100);
    expect(deliver.mock.calls.at(-1)![0].cur).toBe(10_000);
  });

  it('delivers a phase change at once', () => {
    const deliver = vi.fn();
    const t = createFlashProgressThrottle(deliver);
    t.push(p('transfer', 0));
    t.push(p('transfer', 5));
    expect(deliver).toHaveBeenCalledTimes(1);
    t.push(p('finish', 52_515));
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(deliver.mock.calls[1]![0].phase).toBe('finish');
    vi.advanceTimersByTime(500);
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it('delivers the radio becoming touched at once', () => {
    const deliver = vi.fn();
    const t = createFlashProgressThrottle(deliver);
    t.push(p('transfer', 0, false));
    t.push(p('transfer', 0, true));
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it('flush delivers the held update; cancel drops it', () => {
    const deliver = vi.fn();
    const t = createFlashProgressThrottle(deliver);
    t.push(p('transfer', 0));
    t.push(p('transfer', 7));
    t.flush();
    expect(deliver).toHaveBeenLastCalledWith(expect.objectContaining({ cur: 7 }));
    t.push(p('transfer', 9));
    t.cancel();
    vi.advanceTimersByTime(500);
    expect(deliver).toHaveBeenCalledTimes(2);
  });
});

describe('visibleFlashPhases', () => {
  const labels = (seen: FirmwareFlashPhase[], current: FirmwareFlashPhase) =>
    visibleFlashPhases(new Set(seen), current).map((x) => x.label);

  it('shows every phase before the transfer starts', () => {
    expect(labels([], 'handshake')).toEqual(['Handshake', 'Erase', 'Transfer', 'Finish']);
  });

  it('drops a phase the updater never reported', () => {
    expect(labels(['handshake', 'transfer'], 'transfer')).toEqual([
      'Handshake',
      'Transfer',
      'Finish',
    ]);
  });

  it('keeps a phase the updater reported', () => {
    expect(labels(['handshake', 'erase', 'transfer'], 'finish')).toEqual([
      'Handshake',
      'Erase',
      'Transfer',
      'Finish',
    ]);
  });
});

describe('transferDetail', () => {
  it('says the radio may be erasing until the first frame is accepted', () => {
    expect(transferDetail(p('transfer', 0))).toBe(FLASH_WAITING_FOR_RADIO);
    expect(transferDetail(p('transfer', 256))).toBe('transfer 256');
  });
});
