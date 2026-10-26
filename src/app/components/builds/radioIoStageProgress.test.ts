import { describe, expect, it } from 'vitest';
import {
  EMPTY_TRACKER,
  advanceTracker,
  etaSeconds,
  formatEta,
  overallProgress,
  type StageRow,
} from './radioIoStageProgress.ts';

function rows(statuses: Array<StageRow['status']>, weights = [100, 100, 100]): StageRow[] {
  return statuses.map((status, i) => ({
    id: `s${i}`,
    label: `Stage ${i}`,
    status,
    weight: weights[i] ?? 100,
  }));
}

describe('overallProgress', () => {
  it('weights done stages in full and the current stage by cur/max', () => {
    const r = rows(['success', 'active', 'pending'], [100, 300, 100]);
    const t = advanceTracker(EMPTY_TRACKER, r, { cur: 1, max: 2, msg: '' }, 0);
    const o = overallProgress(r, t, { cur: 1, max: 2, msg: '' });
    expect(o.total).toBe(500);
    expect(o.done).toBe(250);
    expect(o.fraction).toBeCloseTo(0.5);
  });

  it('drops an optional stage that was passed without ever running', () => {
    const r: StageRow[] = [
      { id: 'a', label: 'A', status: 'success', weight: 100 },
      { id: 'b', label: 'B', status: 'success', weight: 100, optional: true },
      { id: 'c', label: 'C', status: 'active', weight: 100 },
    ];
    const t = advanceTracker(EMPTY_TRACKER, r, { cur: 0, max: 1, msg: '' }, 0);
    expect(overallProgress(r, t, null).total).toBe(200);
  });

  it('is empty when no row has a weight', () => {
    const r: StageRow[] = [{ id: 'a', label: 'A', status: 'active' }];
    expect(overallProgress(r, EMPTY_TRACKER, null)).toEqual({ fraction: 0, done: 0, total: 0 });
  });

  it('never goes backwards when a stage is re-entered with a smaller fraction', () => {
    const r = rows(['active', 'pending']);
    let t = advanceTracker(EMPTY_TRACKER, r, { cur: 3, max: 4, msg: '' }, 0);
    t = advanceTracker(t, r, { cur: 1, max: 4, msg: '' }, 1000);
    expect(overallProgress(r, t, { cur: 1, max: 4, msg: '' }).fraction).toBeCloseTo(0.375);
  });
});

describe('etaSeconds', () => {
  it('waits 2 s, then counts down from the moving-average rate', () => {
    const r = rows(['active', 'pending']);
    let t = advanceTracker(EMPTY_TRACKER, r, { cur: 0, max: 100, msg: '' }, 0);
    t = advanceTracker(t, r, { cur: 25, max: 100, msg: '' }, 1000); // 25 units in 1 s
    expect(etaSeconds(r, t, { cur: 25, max: 100, msg: '' }, 1500)).toBeNull();
    const at3s = etaSeconds(r, t, { cur: 25, max: 100, msg: '' }, 3000)!;
    expect(at3s).toBeCloseTo(7, 5);
    t = advanceTracker(t, r, { cur: 50, max: 100, msg: '' }, 2000);
    const later = etaSeconds(r, t, { cur: 50, max: 100, msg: '' }, 3000)!;
    expect(later).toBeLessThan(at3s);
  });

  it('is null with no rate and never negative or NaN', () => {
    const r = rows(['active']);
    expect(etaSeconds(r, EMPTY_TRACKER, null, 10_000)).toBeNull();
    const done = rows(['success']);
    let t = advanceTracker(EMPTY_TRACKER, rows(['active']), { cur: 0, max: 1, msg: '' }, 0);
    t = advanceTracker(t, done, null, 1000);
    const eta = etaSeconds(done, t, null, 5000);
    expect(eta === null || eta >= 0).toBe(true);
    expect(Number.isNaN(eta ?? 0)).toBe(false);
  });
});

describe('formatEta', () => {
  it('formats seconds and minutes', () => {
    expect(formatEta(2)).toBe('Almost done');
    expect(formatEta(40)).toBe('About 40 s left');
    expect(formatEta(125)).toBe('About 2 min 5 s left');
    expect(formatEta(120)).toBe('About 2 min left');
    expect(formatEta(-3)).toBe('Almost done');
  });
});
