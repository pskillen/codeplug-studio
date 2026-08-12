import { Stack, Text } from '@mantine/core';
import { StyleguidePageShell, StyleguideSection } from './StyleguidePageShell.tsx';
import { Button, Panel } from '../../components/v2/index.ts';

export default function StyleguideContainersPage() {
  return (
    <StyleguidePageShell title="Containers" description="Panel variants for section blocks.">
      <StyleguideSection
        title="Panel"
        description="Default bordered section — editor blocks, build overview sections, audit pages."
      >
        <Panel title="Identity" sub="Optional description below the title.">
          <Text size="sm">Panel body content.</Text>
        </Panel>
      </StyleguideSection>

      <StyleguideSection
        title="Panel (collapsible)"
        description="Disclosure header — e.g. defaulting a long section closed on narrow viewports (satellite detail page's Orbital elements)."
      >
        <Panel title="Orbital elements" collapsible defaultCollapsed>
          <Text size="sm">Starts collapsed; click the title to expand.</Text>
        </Panel>
      </StyleguideSection>

      <StyleguideSection
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
      </StyleguideSection>

      <StyleguideSection
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
      </StyleguideSection>
    </StyleguidePageShell>
  );
}
