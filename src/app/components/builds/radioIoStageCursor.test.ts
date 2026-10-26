import { describe, expect, it } from 'vitest';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import {
  START_CURSOR,
  foldStageEvent,
  type CursorRow,
  type StageCursor,
} from './radioIoStageCursor.ts';

function ev(stage: string, cur: number, max: number): ProgressUpdate {
  return { stage, cur, max, msg: '' };
}

function replay(rows: readonly CursorRow[], events: readonly ProgressUpdate[]): StageCursor[] {
  const out: StageCursor[] = [];
  let c = START_CURSOR;
  for (const e of events) {
    c = foldStageEvent(c, rows, e);
    out.push(c);
  }
  return out;
}

describe('foldStageEvent', () => {
  it('moves forward through the plan and holds a per-row fraction', () => {
    const rows: CursorRow[] = [{ label: 'A' }, { label: 'B' }];
    const [a0, a1, b1] = replay(rows, [ev('A', 0, 4), ev('A', 2, 4), ev('B', 1, 2)]);
    expect(a0!.index).toBe(0);
    expect(a1!.frac[0]).toBeCloseTo(0.5);
    expect(b1!.index).toBe(1);
    expect(b1!.frac[0]).toBeCloseTo(0.5);
    expect(b1!.frac[1]).toBeCloseTo(0.5);
  });

  it('ignores a label that only occurs before the cursor (stale, not a step back)', () => {
    const rows: CursorRow[] = [{ label: 'A' }, { label: 'B' }];
    const cs = replay(rows, [ev('A', 1, 2), ev('B', 1, 2), ev('A', 1, 2)]);
    expect(cs[2]!.index).toBe(1);
    expect(cs[2]!.frac[0]).toBeCloseTo(0.5);
  });

  it('matches a label the plan names twice occurrence by occurrence', () => {
    const rows: CursorRow[] = [{ label: 'Discover' }, { label: 'Read' }, { label: 'Discover' }];
    const cs = replay(rows, [
      ev('Discover', 0, 100),
      ev('Discover', 100, 100),
      ev('Read', 5, 5),
      ev('Discover', 0, 100),
      ev('Discover', 100, 100),
    ]);
    expect(cs.map((c) => c.index)).toEqual([0, 0, 1, 2, 2]);
  });

  it('counts a cur restart on the same row as the next pass', () => {
    const rows: CursorRow[] = [{ label: 'Read', passes: 2 }, { label: 'W' }];
    const cs = replay(rows, [
      ev('Read', 1, 4),
      ev('Read', 4, 4),
      ev('Read', 0, 4),
      ev('Read', 2, 4),
      ev('Read', 4, 4),
    ]);
    const fracs = cs.map((c) => c.frac[0]!);
    // First pass fills half the row, the restart does not undo it, the second pass fills the rest.
    expect(fracs[1]).toBeCloseTo(0.5);
    expect(fracs[2]).toBeCloseTo(0.5);
    expect(fracs[3]).toBeCloseTo(0.75);
    expect(fracs[4]).toBeCloseTo(1);
    for (let i = 1; i < fracs.length; i++) expect(fracs[i]).toBeGreaterThanOrEqual(fracs[i - 1]!);
  });

  it('ignores a burst of cur 0 seed events, then follows the real writes', () => {
    const rows: CursorRow[] = [
      { label: 'Read' },
      { label: 'Channels' },
      { label: 'Zones', optional: true },
      { label: 'Settings', optional: true },
    ];
    const cs = replay(rows, [
      ev('Read', 3, 3),
      ev('Channels', 0, 2), // seed
      ev('Zones', 0, 1), // seed
      ev('Settings', 0, 1), // seed
      ev('Channels', 0, 2), // real start
      ev('Channels', 1, 2),
      ev('Zones', 0, 1),
      ev('Zones', 1, 1),
    ]);
    // The seed burst opens nothing beyond the first row that is next in line.
    expect(cs[2]!.index).toBe(1);
    expect(cs[3]!.index).toBe(1);
    expect(cs[5]!.index).toBe(1);
    expect(cs[5]!.frac[1]).toBeCloseTo(0.5);
    expect(cs[7]!.index).toBe(2);
  });

  it('holds coarse rows at 0 until the next row starts', () => {
    const rows: CursorRow[] = [
      { label: 'A', coarse: true },
      { label: 'B', coarse: true },
      { label: 'Upload' },
    ];
    const cs = replay(rows, [ev('A', 0, 2), ev('B', 1, 2), ev('Upload', 0, 5), ev('Upload', 2, 5)]);
    expect(cs[1]!.index).toBe(1);
    expect(cs[1]!.frac[1]).toBe(0);
    expect(cs[2]!.index).toBe(2);
    expect(cs[3]!.frac[2]).toBeCloseTo(0.4);
  });

  it('always advances for a stage the plan did not name', () => {
    const rows: CursorRow[] = [{ label: 'A' }, { label: 'Surprise', unplanned: true }];
    const cs = replay(rows, [ev('A', 1, 1), ev('Surprise', 0, 3)]);
    expect(cs[1]!.index).toBe(1);
  });

  it('ignores events without a stage and labels it cannot place', () => {
    const rows: CursorRow[] = [{ label: 'A' }];
    expect(foldStageEvent(START_CURSOR, rows, { cur: 1, max: 2, msg: '' })).toBe(START_CURSOR);
    expect(foldStageEvent(START_CURSOR, rows, ev('Nope', 1, 2))).toBe(START_CURSOR);
  });
});
