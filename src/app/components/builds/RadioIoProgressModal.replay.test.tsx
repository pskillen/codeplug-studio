/**
 * Replays the event shapes real Writes emit (re-entered stage labels, restarting counts, cur 0
 * seed events, sparse per-stage events) through the real progress window with each adapter's own
 * plan, and checks progress never goes backwards (#1393, verifier F1 and F2).
 */

import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DesignSystemV2Provider } from '../v2/index.ts';
import type {
  PlannedStage,
  ProgressUpdate,
  RadioPlanContext,
} from '@integrations/radio-io/types.ts';
import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { DM32UV_DESCRIPTOR } from '@integrations/radio-io/radios/dm32uv/descriptor.ts';
import { OPENGD77_DM1701_DESCRIPTOR } from '@integrations/radio-io/radios/opengd77/dm1701/descriptor.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import {
  d890WriteEvents,
  dm32WriteEvents,
  openGd77WriteEvents,
  rt95WriteEvents,
} from '../../routes/styleguide/radioIoReplayEvents.ts';
import RadioIoProgressModal from './RadioIoProgressModal.tsx';
import {
  EMPTY_TRACKER,
  advanceTracker,
  etaSeconds,
  overallProgress,
  type StageRow,
} from './radioIoStageProgress.ts';
import { START_CURSOR, foldStageEvent, type CursorRow } from './radioIoStageCursor.ts';

type ModalProps = ComponentProps<typeof RadioIoProgressModal>;

function modal(props: ModalProps) {
  return (
    <MantineProvider>
      <DesignSystemV2Provider>
        <RadioIoProgressModal {...props} />
      </DesignSystemV2Provider>
    </MantineProvider>
  );
}

interface Scenario {
  name: string;
  events: ProgressUpdate[];
  plan: PlannedStage[];
}

const WRITE_CTX: RadioPlanContext = {
  parts: { codeplug: true, contacts: false, settings: false, keps: false },
};

function scenarios(): Scenario[] {
  const keps: RadioPlanContext = {
    parts: { codeplug: true, contacts: false, settings: false, keps: true },
  };
  const d = (desc: typeof AT_D890UV_DESCRIPTOR, ctx: RadioPlanContext) =>
    planForOperation(desc, 'write', ctx)!;
  return [
    {
      name: 'D890 Write (download list, preserve, upload)',
      events: d890WriteEvents(),
      plan: d(AT_D890UV_DESCRIPTOR, WRITE_CTX),
    },
    {
      name: 'D890 Write with keps (second Upload)',
      events: d890WriteEvents({ keps: true }),
      plan: d(AT_D890UV_DESCRIPTOR, keps),
    },
    {
      name: 'DM-32UV Write (second discover, restarting reads, queued seeds)',
      events: dm32WriteEvents(),
      plan: d(DM32UV_DESCRIPTOR, WRITE_CTX),
    },
    {
      name: 'OpenGD77 Write (two Pre-write read passes, User Database)',
      events: openGd77WriteEvents({ userDb: 3 }),
      plan: d(OPENGD77_DM1701_DESCRIPTOR, {
        parts: { codeplug: true, contacts: true, settings: false, keps: false },
      }),
    },
    {
      name: 'RT95 Write',
      events: rt95WriteEvents(),
      plan: d(RT95_DESCRIPTOR, WRITE_CTX),
    },
  ];
}

const STATUS_RANK: Record<string, number> = { pending: 0, active: 1, success: 2 };

describe('RadioIoProgressModal replays real Write event shapes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  for (const sc of scenarios()) {
    it(`${sc.name}: overall bar and rows never go backwards, list keeps its rows at the end`, () => {
      const grown: string[] = [];
      const base = {
        opened: true,
        operation: 'write' as const,
        plan: sc.plan,
        onCancel: vi.fn(),
        onClose: vi.fn(),
      };
      const { rerender } = render(modal({ ...base, phase: 'preparing', progress: null }));
      const rowCount = screen.getAllByRole('listitem').length;
      let lastPct = 0;
      const lastRank = new Map<number, number>();
      for (const event of sc.events) {
        if (event.stage && !grown.includes(event.stage)) grown.push(event.stage);
        act(() => {
          vi.advanceTimersByTime(200);
        });
        rerender(
          modal({ ...base, phase: 'transfer', progress: event, transferStages: [...grown] }),
        );
        const pct = Number(screen.getByText(/^\d+%$/).textContent!.replace('%', ''));
        expect(pct, `${event.stage} ${event.cur}/${event.max}`).toBeGreaterThanOrEqual(lastPct);
        lastPct = pct;
        screen
          .getByTestId('stage-list')
          .querySelectorAll('li')
          .forEach((li, i) => {
            const rank = STATUS_RANK[li.getAttribute('data-status') ?? 'pending']!;
            expect(rank, `row ${i} after ${event.stage} ${event.cur}`).toBeGreaterThanOrEqual(
              lastRank.get(i) ?? 0,
            );
            lastRank.set(i, rank);
          });
        const eta = screen.getByTestId('stage-list-eta').textContent ?? '';
        expect(eta).not.toMatch(/NaN|-\d/);
      }
      expect(lastPct).toBeGreaterThan(40);

      rerender(
        modal({
          ...base,
          phase: 'done',
          progress: sc.events[sc.events.length - 1]!,
          transferStages: [...grown],
        }),
      );
      // The list does not shrink at the finish: the plan rows stay, all done, bar at 100%.
      const rows = screen.getByTestId('stage-list').querySelectorAll('li');
      expect(rows.length).toBeGreaterThanOrEqual(rowCount);
      expect(screen.getByText('100%')).toBeInTheDocument();
      for (const li of Array.from(rows).slice(0, sc.plan.length + 2)) {
        expect(li.getAttribute('data-status')).toBe('success');
      }
    }, 15_000);
  }
});

/** Drive the same pipeline the modal uses at a constant byte rate, to check the ETA only falls. */
describe('estimate on replayed Write streams (constant byte rate)', () => {
  const RUN_S = 600;
  for (const sc of scenarios()) {
    it(`${sc.name}: fraction never decreases and the estimate never rises`, () => {
      const rows: CursorRow[] = sc.plan.map((p) => ({
        label: p.label,
        ...(p.optional ? { optional: true } : {}),
        ...(p.passes ? { passes: p.passes } : {}),
        ...(p.coarse ? { coarse: true } : {}),
      }));
      let cursor = START_CURSOR;
      let tracker = EMPTY_TRACKER;
      let lastFraction = 0;
      let lastEta: number | null = null;
      const t0 = 1_000_000;
      const allWeight = sc.plan.reduce((sum, p) => sum + p.weight, 0);
      let sawEta = false;
      for (const event of sc.events) {
        cursor = foldStageEvent(cursor, rows, event);
        const idx = Math.max(0, cursor.index);
        const stageRows: StageRow[] = sc.plan.map((p, i) => ({
          id: `stage:${i}`,
          label: p.label,
          status: i < idx ? 'success' : i === idx ? 'active' : 'pending',
          weight: p.weight,
          ...(p.optional ? { optional: true } : {}),
          ...(p.coarse ? { coarse: true } : {}),
          fraction: cursor.frac[i] ?? 0,
        }));
        // Time follows the weight done (not the fraction, which also moves when unused optional
        // stages drop out of the total), so the byte rate is constant by construction.
        const probe = advanceTracker(tracker, stageRows, event, 0);
        const doneNow = overallProgress(stageRows, probe, event).done;
        const now = t0 + (doneNow / allWeight) * RUN_S * 1000;
        tracker = advanceTracker(tracker, stageRows, event, now);
        const { fraction } = overallProgress(stageRows, tracker, event);
        expect(fraction).toBeGreaterThanOrEqual(lastFraction - 1e-9);
        lastFraction = fraction;
        const eta = etaSeconds(stageRows, tracker, event, now);
        if (eta != null) {
          sawEta = true;
          expect(Number.isFinite(eta) && eta >= 0).toBe(true);
          if (lastEta != null) expect(eta).toBeLessThanOrEqual(lastEta + 1);
          lastEta = eta;
        }
      }
      expect(sawEta).toBe(true);
    }, 15_000);
  }

  it('does not let a long read between sparse events decay the estimate (D890 preserve)', () => {
    const plan: PlannedStage[] = [
      { label: 'Preserving untouched settings', weight: 6 * 0x40000 },
      { label: 'Upload', weight: 0x40000 },
    ];
    const cursorRows: CursorRow[] = plan.map((p) => ({ label: p.label }));
    let cursor = START_CURSOR;
    let tracker = EMPTY_TRACKER;
    const t0 = 0;
    let lastEta = Infinity;
    // One event per erase unit, each 20 s apart (a long single read between events).
    for (let u = 0; u < 6; u++) {
      const event: ProgressUpdate = {
        cur: u,
        max: 6,
        msg: '',
        stage: 'Preserving untouched settings',
      };
      cursor = foldStageEvent(cursor, cursorRows, event);
      const rows: StageRow[] = plan.map((p, i) => ({
        id: `s${i}`,
        label: p.label,
        status: i < cursor.index ? 'success' : i === cursor.index ? 'active' : 'pending',
        weight: p.weight,
        fraction: cursor.frac[i] ?? 0,
      }));
      const at = t0 + u * 20_000;
      tracker = advanceTracker(tracker, rows, event, at);
      // Ask 15 s after the event, in the middle of the next long read.
      const eta = etaSeconds(rows, tracker, event, at + 15_000);
      if (u >= 1) {
        expect(eta).not.toBeNull();
        // 20 s per unit, so what remains is about (7 - u) units; it must not blow up.
        expect(eta!).toBeLessThan((7 - u) * 20 * 2 + 20);
        expect(eta!).toBeLessThanOrEqual(lastEta + 1);
        lastEta = eta!;
      }
    }
  });
});
