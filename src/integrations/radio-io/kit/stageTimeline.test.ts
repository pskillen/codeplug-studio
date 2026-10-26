import { describe, expect, it } from 'vitest';
import { createStageTimeline } from './stageTimeline.ts';

function clock() {
  let t = 1_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('createStageTimeline', () => {
  it('forwards every event and records rows in first-seen order with durations', () => {
    const c = clock();
    const seen: string[] = [];
    const tl = createStageTimeline((p) => seen.push(p.msg), c.now);
    c.advance(10);
    tl.onProgress({ cur: 1, max: 2, msg: 'a1', stage: 'Read' });
    c.advance(30);
    tl.onProgress({ cur: 2, max: 2, msg: 'a2', stage: 'Read' });
    c.advance(20);
    tl.onProgress({ cur: 1, max: 1, msg: 'b1', stage: 'Upload' });
    c.advance(100);
    const r = tl.report();
    expect(seen).toEqual(['a1', 'a2', 'b1']);
    expect(r.rows.map((x) => x.stage)).toEqual(['Read', 'Upload']);
    expect(r.rows[0]).toMatchObject({ events: 2, firstAtMs: 10, lastAtMs: 40, durationMs: 50 });
    expect(r.rows[1]).toMatchObject({ events: 1, firstAtMs: 60, durationMs: 100 });
    expect(r.totalMs).toBe(160);
    expect(r.pauseMs).toBe(0);
  });

  it('excludes the pause from the stage that spans it and from the total', () => {
    const c = clock();
    const tl = createStageTimeline(undefined, c.now);
    tl.onProgress({ cur: 0, max: 1, msg: 'x', stage: 'Read' });
    c.advance(100);
    tl.markPauseStart();
    c.advance(5_000);
    tl.markPauseEnd();
    c.advance(50);
    tl.onProgress({ cur: 0, max: 1, msg: 'y', stage: 'Upload' });
    c.advance(10);
    const r = tl.report();
    expect(r.pauseMs).toBe(5_000);
    expect(r.rows[0]!.durationMs).toBe(150);
    expect(r.rows[1]!.durationMs).toBe(10);
    expect(r.totalMs).toBe(160);
  });

  it('attributes counter deltas to the active stage, frames before the first event included', () => {
    const c = clock();
    const counters = { rFrames: 0, wFrames: 0 };
    const tl = createStageTimeline(undefined, c.now, () => ({ ...counters }));
    counters.rFrames += 4; // sent before the first event
    tl.onProgress({ cur: 0, max: 1, msg: 'x', stage: 'Read' });
    counters.rFrames += 6;
    tl.onProgress({ cur: 0, max: 1, msg: 'y', stage: 'Upload' });
    counters.wFrames += 9;
    tl.onProgress({ cur: 0, max: 1, msg: 'z', stage: 'Read' });
    counters.rFrames += 1;
    const r = tl.report();
    expect(r.rows.find((x) => x.stage === 'Read')!.counters).toEqual({ rFrames: 11, wFrames: 0 });
    expect(r.rows.find((x) => x.stage === 'Upload')!.counters).toEqual({
      rFrames: 0,
      wFrames: 9,
    });
    const total = r.rows.reduce((a, x) => a + (x.counters?.rFrames ?? 0), 0);
    expect(total).toBe(counters.rFrames);
  });

  it('labels events with no stage', () => {
    const tl = createStageTimeline(undefined, clock().now);
    tl.onProgress({ cur: 0, max: 1, msg: 'x' });
    expect(tl.report().rows[0]!.stage).toBe('(no stage)');
  });
});
