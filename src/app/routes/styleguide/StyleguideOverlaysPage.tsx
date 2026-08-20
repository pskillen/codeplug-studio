import { Group, Text } from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';
import { useState } from 'react';
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
import WriteRadioModal from '../../components/builds/WriteRadioModal.tsx';
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

export default function StyleguideOverlaysPage() {
  const [shellOpen, setShellOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [busyOpen, setBusyOpen] = useState(false);
  const [runningOpen, setRunningOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);
  const [writeRadioOpen, setWriteRadioOpen] = useState(false);
  const [demoContactSource, setDemoContactSource] = useState<
    'none' | 'library' | 'directory' | 'both'
  >('none');
  const [demoKeps, setDemoKeps] = useState(false);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'bands' | 'zones' | 'modes'>('bands');
  const [demoBands, setDemoBands] = useState<string[]>(['2m']);

  return (
    <StyleguidePageShell
      title="Overlays"
      description="ModalShell, ConfirmModal, and ProgressModal. Product Write radio is ModalShell composition (`WriteRadioModal`), not a new overlay primitive."
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
        </Group>
        <ProgressModal
          open={runningOpen}
          phase="running"
          steps={RUNNING_STEPS}
          progress={45}
          onClose={() => setRunningOpen(false)}
        />
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
        title="Write radio (product composition)"
        description="Build → Export uses ModalShell via WriteRadioModal — not a new overlay primitive. Live demo with dummy handlers."
      >
        <Group gap="sm">
          <Button
            variant="secondary"
            onClick={() => {
              setDemoContactSource('none');
              setDemoKeps(false);
              setWriteRadioOpen(true);
            }}
          >
            Open Write radio
          </Button>
        </Group>
        <WriteRadioModal
          open={writeRadioOpen}
          onClose={() => setWriteRadioOpen(false)}
          buildId="demo"
          serialOk
          busy={false}
          writeHidden={false}
          supportsDigitalContacts
          supportsKeps
          contactSource={demoContactSource}
          onContactSourceChange={setDemoContactSource}
          kepsSelected={demoKeps}
          onKepsSelectedChange={setDemoKeps}
          onWriteCodeplug={() => setWriteRadioOpen(false)}
          onWriteContacts={() => setWriteRadioOpen(false)}
          onWriteKeps={() => setWriteRadioOpen(false)}
        />
      </StyleguideSection>
    </StyleguidePageShell>
  );
}
