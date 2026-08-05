import { Group, Text } from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import { Button, ConfirmModal, ModalShell } from '../../../components/v2/index.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';

export default function StyleguideV2OverlaysPage() {
  const [shellOpen, setShellOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [destructiveOpen, setDestructiveOpen] = useState(false);
  const [busyOpen, setBusyOpen] = useState(false);

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
    </Page>
  );
}
