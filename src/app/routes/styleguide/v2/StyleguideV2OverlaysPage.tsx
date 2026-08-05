import { Group, Text } from '@mantine/core';
import { IconHelpCircle } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import { Button, ModalShell } from '../../../components/v2/index.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';

export default function StyleguideV2OverlaysPage() {
  const [shellOpen, setShellOpen] = useState(false);

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
    </Page>
  );
}
