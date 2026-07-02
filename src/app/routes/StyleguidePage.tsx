import { Alert, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { UK_BANDS } from '../lib/bands.ts';
import { BandPill, ModePill } from '../components/pills/index.ts';
import { EmptyState, FormSection, Page, PageHeader, PageSection } from '../components/ui/index.ts';

const SAMPLE_ROWS = [
  { id: '1', name: 'GB3DA Stornoway' },
  { id: '2', name: 'GB3IV Inverness' },
];

export default function StyleguidePage() {
  const [search, setSearch] = useState('');

  return (
    <Page width="default">
      <PageHeader
        title="UI styleguide"
        description="Hidden dev page — demos shared kit primitives. Not linked from navigation."
      />

      <PageSection title="Page layout" description="PageHeader, PageSection">
        <Text size="sm">Section body content — mirrors the codeplug-tool kit.</Text>
      </PageSection>

      <PageSection title="Form fields & buttons">
        <Stack gap="lg">
          <Group>
            <Button>Primary</Button>
            <Button variant="light">Light</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="outline">Outline</Button>
          </Group>
          <FormSection title="Sample fields">
            <TextInput label="Name" placeholder="Channel name" />
            <Select label="Mode" data={['FM', 'DMR', 'P25']} defaultValue="FM" />
          </FormSection>
        </Stack>
      </PageSection>

      <PageSection title="Pills & badges">
        <Group>
          <ModePill mode="dmr" />
          <ModePill mode="fm" />
          <ModePill mode="dstar" />
          <ModePill mode="ysf" />
          <ModePill mode="m17" />
          <ModePill mode="tetra" />
          <BandPill band={UK_BANDS.find((b) => b.id === '2m') ?? null} />
          <BandPill band={UK_BANDS.find((b) => b.id === '70cm') ?? null} />
        </Group>
      </PageSection>

      <PageSection title="Alerts" description="Mantine Alert colour conventions — see docs/features/app-shell/alerts.md">
        <Stack gap="sm">
          <Alert color="blue">Informational alert.</Alert>
          <Alert color="yellow">Warning alert — map token missing pattern.</Alert>
          <Alert color="red">Error alert — validation failure pattern.</Alert>
        </Stack>
      </PageSection>

      <PageSection title="EmptyState">
        <EmptyState
          message="No projects yet"
          action={
            <Button variant="light" component={Link} to="/">
              Go home
            </Button>
          }
        />
      </PageSection>

      <PageSection title="List sample" description={`Filter demo: “${search || 'none'}”`}>
        <TextInput
          placeholder="Filter demo channels…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          mb="sm"
        />
        <Stack gap="xs">
          {SAMPLE_ROWS.filter((r) => r.name.toLowerCase().includes(search.toLowerCase())).map(
            (r) => (
              <Text key={r.id} size="sm">
                {r.name}
              </Text>
            ),
          )}
        </Stack>
      </PageSection>
    </Page>
  );
}
