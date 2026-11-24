import { Group, Stack, Text } from '@mantine/core';
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
import ErrorPanel from '../../components/egress/ErrorPanel/ErrorPanel.tsx';
import StageProgress from '../../components/egress/StageProgress/StageProgress.tsx';
import RadioWriteStepperDemo from './RadioWriteStepperDemo.tsx';
import ExportFileDialogDemo from './ExportFileDialogDemo.tsx';
import RangeChangeDemo from './RangeChangeDemo.tsx';
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

/** Fixed ms timestamps for StageProgress demos (no `Date.now()` during render). */
const STAGE_PROGRESS_DEMO_START = 1_700_000_000_000;

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
        title="Error panel"
        description="Write and export dialogs use ErrorPanel for every failure: what reached the radio, the message, retry only when it helps, Debug details always, and a console line."
      >
        <Group align="flex-start" grow>
          <ErrorPanel
            outcome={{
              kind: 'error',
              retry: 'reconnect',
              sent: 'nothing-sent',
              message: 'Radio I/O timed out waiting for bytes. (tried baud: 9600)',
              debugText: 'error: RadioTimeoutError\ncode: timeout',
              code: 'timeout',
            }}
            retryLabel="Reconnect and try again"
            onRetry={() => undefined}
          />
          <ErrorPanel
            outcome={{
              kind: 'error',
              retry: 'rewrite',
              sent: 'may-hold-part',
              message: 'Serial pipe closed unexpectedly.',
              debugText: 'error: RadioClosedError\ncode: closed',
              code: 'closed',
            }}
            retryLabel="Write again"
            onRetry={() => undefined}
          />
          <ErrorPanel
            outcome={{
              kind: 'error',
              retry: 'none',
              sent: 'nothing-sent',
              message:
                'This radio\'s flash still holds settings from the firmware it ran before, so RadioFoundry will not save anything to it. Claim the storage area with RadioFoundry\'s web programming utility (it backs up first) or with "rfoundry_debug.py storage claim", then write again. Nothing was written.',
              debugText: 'INFO flags: 0x00, storage writable: no',
              code: 'interlock',
            }}
            retryLabel={null}
          />
          <ErrorPanel
            outcome={{
              kind: 'error',
              retry: 'none',
              sent: 'nothing-sent',
              message: 'No active project.',
              debugText:
                'error: Error\ncode: none\nmessage: No active project.\nphase: read\nstage: none\nradio: AT-D890UV\nprofile: radio-io-at-d890uv\nstack:\nnone',
              code: 'unknown',
            }}
            retryLabel={null}
          />
        </Group>
      </StyleguideSection>

      <StyleguideSection
        title="Stage progress"
        description="Read, write, restart wait and check transfers share one progress list inside export and write dialogs."
      >
        <Stack gap="xl">
          <StageProgress
            lead={<Text size="sm">Connecting to AT-D890UV and reading it…</Text>}
            groups={[
              {
                id: 'read',
                rows: [
                  { id: 'a', label: 'Local info', status: 'success', weight: 256 },
                  { id: 'b', label: 'Channels', status: 'active', weight: 20_000 },
                  { id: 'c', label: 'Zones', status: 'pending', weight: 6000 },
                ],
              },
            ]}
            progress={{ cur: 40, max: 100, msg: 'Channels' }}
            startedAt={STAGE_PROGRESS_DEMO_START - 45_000}
            estimateSeconds={90}
            running
          />
          <StageProgress
            groups={[
              {
                id: 'write',
                title: 'Write',
                rows: [{ id: 'w', label: 'Upload', status: 'success', weight: 40_000 }],
              },
              {
                id: 'restart',
                title: 'Restart',
                rows: [{ id: 'r', label: 'Waiting (8 s left)', status: 'active', coarse: true }],
              },
              {
                id: 'check',
                title: 'Check write',
                rows: [{ id: 'c', label: 'Verify channels', status: 'pending', weight: 5000 }],
              },
            ]}
            progress={null}
            startedAt={STAGE_PROGRESS_DEMO_START - 120_000}
            running
          />
          <StageProgress
            groups={[
              {
                id: 'grow',
                rows: [{ id: 'x', label: 'Reading clone', status: 'active' }],
              },
            ]}
            progress={{ cur: 0, max: 0, msg: 'Handshake' }}
            startedAt={STAGE_PROGRESS_DEMO_START - 3000}
            running
          />
        </Stack>
      </StyleguideSection>

      <StyleguideSection
        title="Write stepper (product composition)"
        description="Build → Export → Write radio is one ModalShell dialog with six steps. Pick a step to preview it with dummy data; nothing talks to a radio."
      >
        <RadioWriteStepperDemo />
      </StyleguideSection>

      <StyleguideSection
        title="Export dialog (file mode)"
        description="Build → Export opens the same shell in file mode: Checks with warnings before download, optional What to export for CHIRP or NeonPlug, then a done recap."
      >
        <ExportFileDialogDemo />
      </StyleguideSection>

      <StyleguideSection
        title="Danger zone: Change frequency range"
        description="The AT-D890 range-change wizard, every step and the main failure screens, with demo data. Nothing talks to a radio."
      >
        <RangeChangeDemo />
      </StyleguideSection>
    </StyleguidePageShell>
  );
}
