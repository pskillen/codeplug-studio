import { Group, Text } from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { StyleguidePageShell, StyleguideSection } from './StyleguidePageShell.tsx';
import { FacetBar, FacetChip } from '../../components/library/FacetBar.tsx';
import {
  Button,
  ConfirmModal,
  FilterPopover,
  ModalShell,
  ProgressModal,
  type ProgressModalStep,
} from '../../components/v2/index.ts';
import RadioIoReplayDemo from './RadioIoReplayDemo.tsx';
import RadioWriteStepperDemo from './RadioWriteStepperDemo.tsx';
import RadioIoStageList, { type StageRow } from '../../components/builds/RadioIoStageList.tsx';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';

const RUNNING_STEPS: ProgressModalStep[] = [
  { id: 'connect', label: 'Connect to radio', status: 'success' },
  { id: 'write', label: 'Write channels', status: 'active', detail: '18 of 42' },
  { id: 'verify', label: 'Verify', status: 'pending' },
];

const FINISHED_SUCCESS_STEPS: ProgressModalStep[] = [
  { id: 'connect', label: 'Connect to radio', status: 'success' },
  { id: 'write', label: 'Write channels', status: 'success' },
  { id: 'verify', label: 'Verify', status: 'success' },
];

const FINISHED_ERROR_STEPS: ProgressModalStep[] = [
  { id: 'connect', label: 'Connect to radio', status: 'success' },
  { id: 'write', label: 'Write channels', status: 'error', detail: 'Channel 12 rejected' },
  { id: 'verify', label: 'Verify', status: 'pending' },
];

const LONG_PLAN_STAGES = 20;

/** A 20-stage Write plan advancing on a timer, to show the fixed-height stage list. */
function LongPlanDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restart the demo each time it opens
    setTick(0);
    const id = window.setInterval(
      () => setTick((t) => (t < LONG_PLAN_STAGES * 5 ? t + 1 : t)),
      250,
    );
    return () => window.clearInterval(id);
  }, [open]);
  const current = Math.min(LONG_PLAN_STAGES - 1, Math.floor(tick / 5));
  const rows = useMemo<StageRow[]>(
    () =>
      Array.from({ length: LONG_PLAN_STAGES }, (_, i) => ({
        id: `s${i}`,
        label: `Stage ${i + 1} of ${LONG_PLAN_STAGES}`,
        status: i < current ? 'success' : i === current ? 'active' : 'pending',
        weight: 1000 + (i % 4) * 500,
      })),
    [current],
  );
  return (
    <ProgressModal
      open={open}
      phase="running"
      steps={[]}
      body={<RadioIoStageList rows={rows} progress={{ cur: tick % 5, max: 5, msg: '' }} />}
      onClose={onClose}
    />
  );
}

export default function StyleguideOverlaysPage() {
  const [longPlanOpen, setLongPlanOpen] = useState(false);
  const [shellOpen, setShellOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [busyOpen, setBusyOpen] = useState(false);
  const [runningOpen, setRunningOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'bands' | 'zones' | 'modes'>('bands');
  const [demoBands, setDemoBands] = useState<string[]>(['2m']);

  return (
    <StyleguidePageShell
      title="Overlays"
      description="ModalShell, ConfirmModal, and ProgressModal. The product Write stepper is a ModalShell composition (`RadioWriteStepper`), not a new overlay primitive."
    >
      <StyleguideSection
        title="ModalShell"
        description="Base overlay shell: icon, title, body, footer."
      >
        <Group gap="sm">
          <Button variant="secondary" onClick={() => setShellOpen(true)}>
            Open ModalShell
          </Button>
        </Group>
        <ModalShell
          open={shellOpen}
          onClose={() => setShellOpen(false)}
          title="Example modal"
          icon={<IconHelpCircle size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
          footer={
            <Button variant="secondary" onClick={() => setShellOpen(false)}>
              Close
            </Button>
          }
        >
          <Text size="sm">Body content scrolls independently of the header/footer.</Text>
        </ModalShell>
      </StyleguideSection>

      <StyleguideSection
        title="ConfirmModal"
        description="Standard and destructive confirmation on top of ModalShell."
      >
        <Group gap="sm">
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Standard confirm
          </Button>
          <Button variant="secondary" onClick={() => setDestructiveOpen(true)}>
            Destructive confirm
          </Button>
          <Button variant="secondary" onClick={() => setBusyOpen(true)}>
            Busy confirm
          </Button>
        </Group>
        <ConfirmModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
          title="Discard changes?"
        >
          <Text size="sm">Unsaved edits will be lost.</Text>
        </ConfirmModal>
        <ConfirmModal
          open={destructiveOpen}
          onClose={() => setDestructiveOpen(false)}
          onConfirm={() => setDestructiveOpen(false)}
          title="Delete zone?"
          tone="destructive"
        >
          <Text size="sm">This cannot be undone.</Text>
        </ConfirmModal>
        <ConfirmModal
          open={busyOpen}
          onClose={() => setBusyOpen(false)}
          onConfirm={() => undefined}
          title="Writing to radio…"
          busy
        >
          <Text size="sm">Dismiss and confirm are disabled while busy.</Text>
        </ConfirmModal>
      </StyleguideSection>

      <StyleguideSection
        title="ProgressModal"
        description="Blocking progress with per-step status — the shape for radio write/verify."
      >
        <Group gap="sm">
          <Button variant="secondary" onClick={() => setRunningOpen(true)}>
            Running
          </Button>
          <Button variant="secondary" onClick={() => setSuccessOpen(true)}>
            Finished (success)
          </Button>
          <Button variant="secondary" onClick={() => setErrorOpen(true)}>
            Finished (error)
          </Button>
          <Button variant="secondary" onClick={() => setLongPlanOpen(true)}>
            Running (20 planned stages)
          </Button>
        </Group>
        <ProgressModal
          open={runningOpen}
          phase="running"
          steps={RUNNING_STEPS}
          progress={45}
          onClose={() => setRunningOpen(false)}
        />
        <LongPlanDemo open={longPlanOpen} onClose={() => setLongPlanOpen(false)} />
        <Text size="sm" mt="md">
          The real progress window fed with a Write&apos;s event stream per radio (re-entered
          stages, restarting counts, seed events), using each adapter&apos;s own plan. Add{' '}
          <code>?replay=dm32uv&amp;at=0.55</code> to open it paused part-way.
        </Text>
        <RadioIoReplayDemo />
        <ProgressModal
          open={successOpen}
          phase="finished"
          steps={FINISHED_SUCCESS_STEPS}
          onClose={() => setSuccessOpen(false)}
          summary={<Text size="sm">42 of 42 channels written and verified.</Text>}
        />
        <ProgressModal
          open={errorOpen}
          phase="finished"
          steps={FINISHED_ERROR_STEPS}
          onClose={() => setErrorOpen(false)}
          onRetry={() => setErrorOpen(false)}
          summary={<Text size="sm">1 of 42 channels failed to write.</Text>}
        />
      </StyleguideSection>

      <StyleguideSection
        title="FilterPopover"
        description="Tabbed flyout filter panel — Channels list filters (bands/zones/modes) on desktop and mobile."
      >
        <Group gap="sm">
          <FilterPopover
            triggerLabel="Filters"
            opened={filterPopoverOpen}
            onOpenChange={setFilterPopoverOpen}
            activeCount={demoBands.length}
            tabs={[
              { value: 'bands', label: 'Bands' },
              { value: 'zones', label: 'Zones' },
              { value: 'modes', label: 'Modes' },
            ]}
            activeTab={filterTab}
            onTabChange={setFilterTab}
            footer={<Text size="sm">Simplex/Split + Within-Xkm live here, any tab.</Text>}
          >
            {filterTab === 'bands' ? (
              <FacetBar>
                {['2m', '70cm', '6m'].map((band) => (
                  <FacetChip
                    key={band}
                    label={band}
                    active={demoBands.includes(band)}
                    onClick={() =>
                      setDemoBands((prev) =>
                        prev.includes(band) ? prev.filter((b) => b !== band) : [...prev, band],
                      )
                    }
                  />
                ))}
              </FacetBar>
            ) : (
              <Text size="sm" c="dimmed">
                {filterTab === 'zones' ? 'Zone chips here.' : 'Mode chips here.'}
              </Text>
            )}
          </FilterPopover>
        </Group>
      </StyleguideSection>

      <StyleguideSection
        title="Write stepper (product composition)"
        description="Build → Export → Write radio is one ModalShell dialog with six steps. Pick a step to preview it with dummy data; nothing talks to a radio."
      >
        <RadioWriteStepperDemo />
      </StyleguideSection>
    </StyleguidePageShell>
  );
}
