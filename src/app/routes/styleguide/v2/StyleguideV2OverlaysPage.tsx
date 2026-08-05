import { Group, Text } from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import {
  Button,
  ConfirmModal,
  ModalShell,
  ProgressModal,
  type ProgressModalStep,
} from '../../../components/v2/index.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';

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

export default function StyleguideV2OverlaysPage() {
  const [shellOpen, setShellOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [busyOpen, setBusyOpen] = useState(false);
  const [runningOpen, setRunningOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);

  return (
    <Page width="default">
      <PageHeader
        title="Overlays"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link>
          </>
        }
      />

      <PageSection title="ModalShell" description="Base overlay shell: icon, title, body, footer.">
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
      </PageSection>

      <PageSection
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
      </PageSection>

      <PageSection
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
      </PageSection>
    </Page>
  );
}
