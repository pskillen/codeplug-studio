/**
 * Styleguide demo: the real progress window driven by a recorded-shape Write event stream per
 * radio, using each adapter's own plan (#1393). Nothing is sent to a radio and no codeplug data
 * is involved. `?replay=<radio>&at=<0..1>` opens it paused at that point, for screenshots.
 */

import { useEffect, useMemo, useState } from 'react';
import { Group } from '@mantine/core';
import type {
  PlannedStage,
  ProgressUpdate,
  RadioDescriptor,
} from '@integrations/radio-io/types.ts';
import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { DM32UV_DESCRIPTOR } from '@integrations/radio-io/radios/dm32uv/descriptor.ts';
import { OPENGD77_DM1701_DESCRIPTOR } from '@integrations/radio-io/radios/opengd77/dm1701/descriptor.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import RadioIoProgressModal from '../../components/builds/RadioIoProgressModal.tsx';
import { Button } from '../../components/v2/index.ts';
import { REPLAY_RADIOS, replayEventsFor, type ReplayRadioId } from './radioIoReplayEvents.ts';

const DESCRIPTORS: Record<ReplayRadioId, RadioDescriptor> = {
  'at-d890uv': AT_D890UV_DESCRIPTOR,
  dm32uv: DM32UV_DESCRIPTOR,
  opengd77: OPENGD77_DM1701_DESCRIPTOR,
  rt95: RT95_DESCRIPTOR,
};

/** Milliseconds between replayed events when playing normally, and when seeking to `at`. */
const PLAY_MS = 120;
const SEEK_MS = 4;

function isReplayRadio(v: string | null): v is ReplayRadioId {
  return REPLAY_RADIOS.some((r) => r.id === v);
}

/** Read `?replay=` and `?at=` once, so a screenshot link opens the window straight away. */
function initialFromUrl(): { radio: ReplayRadioId; at: number } | null {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  const radio = q.get('replay');
  if (!isReplayRadio(radio)) return null;
  const at = Number(q.get('at'));
  return { radio, at: Number.isFinite(at) ? Math.min(1, Math.max(0, at)) : 1 };
}

export default function RadioIoReplayDemo() {
  const [start] = useState(initialFromUrl);
  const [radio, setRadio] = useState<ReplayRadioId | null>(start?.radio ?? null);
  /** Events delivered so far. */
  const [index, setIndex] = useState(0);
  /** Stop at this many events (a screenshot) instead of running to the end. */
  const [stopAt, setStopAt] = useState<number | null>(null);

  const events = useMemo<ProgressUpdate[]>(() => (radio ? replayEventsFor(radio) : []), [radio]);
  const plan = useMemo<PlannedStage[] | undefined>(
    () =>
      radio
        ? planForOperation(DESCRIPTORS[radio], 'write', {
            parts: { codeplug: true, contacts: false, settings: false, keps: false },
          })
        : undefined,
    [radio],
  );

  // Seek to `?at=` once the events exist.
  useEffect(() => {
    if (start && radio === start.radio) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seek from the URL
      setStopAt(Math.round(start.at * events.length));
    }
  }, [start, radio, events.length]);

  const seeking = stopAt != null;
  useEffect(() => {
    if (!radio) return;
    const target = stopAt ?? events.length;
    if (index >= target) return;
    const id = window.setTimeout(() => setIndex((i) => i + 1), seeking ? SEEK_MS : PLAY_MS);
    return () => window.clearTimeout(id);
  }, [radio, index, stopAt, seeking, events.length]);

  const done = radio != null && index >= events.length;
  const progress = radio && index > 0 ? (events[index - 1] ?? null) : null;
  const transferStages = useMemo(() => {
    const seen: string[] = [];
    for (const e of events.slice(0, index)) {
      if (e.stage && !seen.includes(e.stage)) seen.push(e.stage);
    }
    return seen;
  }, [events, index]);

  function open(next: ReplayRadioId) {
    setStopAt(null);
    setIndex(0);
    setRadio(next);
  }

  return (
    <>
      <Group gap="sm">
        {REPLAY_RADIOS.map((r) => (
          <Button key={r.id} variant="secondary" onClick={() => open(r.id)}>
            {`Replay ${r.label} Write`}
          </Button>
        ))}
      </Group>
      <RadioIoProgressModal
        opened={radio != null}
        operation="write"
        phase={done ? 'done' : index === 0 ? 'preparing' : 'transfer'}
        progress={progress}
        transferStages={transferStages}
        plan={plan}
        onCancel={() => setRadio(null)}
        onClose={() => setRadio(null)}
      />
    </>
  );
}
