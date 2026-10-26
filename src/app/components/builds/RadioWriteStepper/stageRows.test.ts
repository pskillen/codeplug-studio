import { describe, expect, it } from 'vitest';
import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { DM32UV_DESCRIPTOR } from '@integrations/radio-io/radios/dm32uv/descriptor.ts';
import type { PlannedStage, ProgressUpdate } from '@integrations/radio-io/types.ts';
import { newTrack, stageRows, trackWithEvent, trackWithPlan } from './stageRows.ts';

function ev(stage: string, cur = 1, max = 2): ProgressUpdate {
  return { cur, max, msg: '', stage };
}

function summary(rows: ReturnType<typeof stageRows>): string {
  return rows.map((r) => `${r.label}=${r.status}`).join(' | ');
}

describe('stageRows (4a stage cursor)', () => {
  it('D890 codeplug + keps: the second Upload row activates, ids are unique', () => {
    const parts = { codeplug: true, contacts: false, settings: false, keps: true };
    const plan = planForOperation(AT_D890UV_DESCRIPTOR, 'write', { parts })!;
    const labels = plan.map((p) => p.label);
    // The keps writer re-emits 'Upload' after its own preserve stage.
    expect(labels.filter((l) => l === 'Upload')).toHaveLength(2);
    let track = trackWithPlan(newTrack(), plan);
    const emitted = [
      'Preserving untouched settings',
      'Upload',
      'Preserving untouched satellite data',
      'Upload',
    ];
    const states: string[] = [];
    for (const stage of emitted) {
      track = trackWithEvent(track, ev(stage));
      states.push(summary(stageRows(track)));
    }
    const rows = stageRows(track);
    const active = rows.filter((r) => r.status === 'active');
    expect(active).toHaveLength(1);
    expect(rows.indexOf(active[0]!)).toBe(labels.lastIndexOf('Upload'));
    // After the third event the satellite-data row is the active one, not a step back.
    expect(states[2]).toContain('Preserving untouched satellite data=active');
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    // Everything before the active row is done.
    expect(rows.slice(0, labels.lastIndexOf('Upload')).every((r) => r.status === 'success')).toBe(
      true,
    );
  });

  it('carries coarse and passes from the plan (D890 read, DM-32 pre-write read)', () => {
    const noKeps = { codeplug: true, contacts: false, settings: false, keps: false };
    const d890Read = planForOperation(AT_D890UV_DESCRIPTOR, 'read', { parts: noKeps }) as
      PlannedStage[] | undefined;
    const d890 = trackWithPlan(
      newTrack(),
      d890Read ?? planForOperation(AT_D890UV_DESCRIPTOR, 'write', { parts: noKeps })!,
    );
    const coarseRows = stageRows(d890, { startActive: true }).filter((r) => r.coarse);
    expect(coarseRows.length).toBeGreaterThan(0);

    const dmPlan = planForOperation(DM32UV_DESCRIPTOR, 'write', { parts: noKeps })!;
    const pre = dmPlan.find((p) => p.label === 'Pre-write read')!;
    expect(pre.passes).toBeGreaterThan(1);
    let track = trackWithPlan(newTrack(), dmPlan);
    // One pass of the read's block groups: the row holds 1/passes, not the pass's own 100%.
    track = trackWithEvent(track, ev('Pre-write read', 0, 4));
    track = trackWithEvent(track, ev('Pre-write read', 4, 4));
    const row = stageRows(track).find((r) => r.label === 'Pre-write read')!;
    expect(row.fraction).toBeCloseTo(1 / pre.passes!, 5);
  });

  it('a re-emitted label cannot move the cursor back (DM-32 memory map)', () => {
    const noKeps = { codeplug: true, contacts: false, settings: false, keps: false };
    const dmPlan = planForOperation(DM32UV_DESCRIPTOR, 'write', { parts: noKeps })!;
    let track = trackWithPlan(newTrack(), dmPlan);
    const labels = dmPlan.map((p) => p.label);
    const second = labels.lastIndexOf('Discover memory map');
    expect(second).toBeGreaterThan(labels.indexOf('Pre-write read'));
    for (const l of ['Discover memory map', 'Pre-write read', 'Discover memory map']) {
      track = trackWithEvent(track, ev(l));
    }
    expect(stageRows(track)[second]!.status).toBe('active');
    // A stale re-emit of an earlier label is ignored, not a step back.
    track = trackWithEvent(track, ev('Pre-write read'));
    const rows = stageRows(track);
    expect(rows[second]!.status).toBe('active');
    expect(rows[labels.indexOf('Pre-write read')]!.status).toBe('success');
  });

  it('replays events that arrived before the plan', () => {
    let track = trackWithEvent(newTrack(), ev('Pre-write read', 1, 4));
    expect(stageRows(track).map((r) => r.label)).toEqual(['Pre-write read']);
    const noKeps = { codeplug: true, contacts: false, settings: false, keps: false };
    const plan = planForOperation(DM32UV_DESCRIPTOR, 'write', { parts: noKeps })!;
    track = trackWithPlan(track, plan);
    const rows = stageRows(track);
    expect(rows.map((r) => r.label)).toEqual(plan.map((p) => p.label));
    expect(rows.find((r) => r.status === 'active')?.label).toBe('Pre-write read');
  });
});
