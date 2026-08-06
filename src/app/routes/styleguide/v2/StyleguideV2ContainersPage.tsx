import { Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import { Button, Panel } from '../../../components/v2/index.ts';

export default function StyleguideV2ContainersPage() {
  return (
    <Page width="default">
      <PageHeader
        title="Containers"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link>
          </>
        }
      />

      <PageSection
        title="Panel"
        description="Default bordered section — editor blocks, build overview sections, audit pages."
      >
        <Panel title="Identity" sub="Optional description below the title.">
          <Text size="sm">Panel body content.</Text>
        </Panel>
      </PageSection>

      <PageSection
        title="Panel (danger)"
        description="Destructive tint for irreversible actions — delete build, remove project data."
      >
        <Panel
          variant="danger"
          title="Danger zone"
          sub="Deleting a build removes its export history and overrides. Library channels and zones are not affected."
        >
          <Button variant="destructive" size="sm" onClick={() => undefined}>
            Delete build
          </Button>
        </Panel>
      </PageSection>

      <PageSection
        title="Stacked panels"
        description="Typical overview page rhythm — identity, capabilities, danger."
      >
        <Stack gap="md">
          <Panel title="Identity">
            <Text size="sm">Name field and save actions live here on Overview.</Text>
          </Panel>
          <Panel title="Capabilities" sub="Trait pills and egress pathway list.">
            <Text size="sm" c="dimmed">
              Capability pills appear in this body region.
            </Text>
          </Panel>
          <Panel variant="danger" title="Danger zone" sub="Confirmed delete only.">
            <Button variant="destructive" size="sm">
              Delete build
            </Button>
          </Panel>
        </Stack>
      </PageSection>
    </Page>
  );
}
