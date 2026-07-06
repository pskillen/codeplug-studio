import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  NavLink,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { newChannel } from '@core/domain/factories.ts';
import { UK_BANDS } from '../lib/bands.ts';
import { BandPill, BandPillForChannel, ModePill } from '../components/pills/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../lib/iconSizes.ts';
import {
  DataTable,
  EmptyState,
  FormPage,
  FormSection,
  ListPage,
  Page,
  PageHeader,
  PageSection,
  PageSectionGrid,
  PercentLevelSlider,
} from '../components/ui/index.ts';

const SAMPLE_ROWS = [
  { id: '1', name: 'GB3DA Stornoway' },
  { id: '2', name: 'GB3IV Inverness' },
];

const STICKY_DEMO_ROWS = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  name: `Channel ${String(i + 1).padStart(2, '0')}`,
  score: (i * 7) % 100,
}));

const COLUMN_PICKER_ROWS = [
  { id: '1', name: 'Alpha', score: 3, note: 'A' },
  { id: '2', name: 'Bravo', score: 9, note: 'B' },
];

const sampleChannel = {
  ...newChannel('styleguide', 'Demo FM'),
  rxFrequency: 145_575_000,
  txFrequency: 145_175_000,
  modeProfiles: [
    {
      mode: 'fm' as const,
      squelch: null,
      rxTone: 'none',
      txTone: 'none',
      bandwidthKHz: null,
    },
  ],
};

function PercentLevelSliderDemo({
  label,
  initial,
  zeroLabel,
}: {
  label: string;
  initial: number | null;
  zeroLabel?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PercentLevelSlider label={label} value={value} onChange={setValue} zeroLabel={zeroLabel} />
  );
}

export default function StyleguidePage() {
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const filteredStickyRows = useMemo(() => {
    if (!search) return STICKY_DEMO_ROWS;
    const q = search.toLowerCase();
    return STICKY_DEMO_ROWS.filter((r) => r.name.toLowerCase().includes(q));
  }, [search]);

  return (
    <Page width="default">
      <PageHeader
        title="UI styleguide"
        description="Hidden dev page — demos shared kit primitives. Not linked from navigation."
      />

      <PageSection title="Page layout" description="PageHeader, PageSection, PageSectionGrid">
        <PageSectionGrid>
          <PageSection title="Card A" description="Bordered section panel">
            <Text size="sm">Section body content.</Text>
          </PageSection>
          <PageSection title="Card B" description="Second column from md breakpoint">
            <Text size="sm">Mirrors import/export layout.</Text>
          </PageSection>
        </PageSectionGrid>
      </PageSection>

      <PageSection title="ListPage sample">
        <ListPage
          title="Channels (sample)"
          description="Composed list shell inside a section for demo."
        >
          <DataTable
            variant="list"
            rows={SAMPLE_ROWS}
            totalRowCount={SAMPLE_ROWS.length}
            rowKey={(row) => row.id}
            nameColumn={{
              getName: (row) => row.name,
              getPath: (row) => `/library/channels/${row.id}`,
            }}
            columns={[{ key: 'band', header: 'Band', render: () => '2m' }]}
          />
        </ListPage>
      </PageSection>

      <PageSection title="DataTable — empty">
        <DataTable
          variant="list"
          rows={[]}
          rowKey={(row: { id: string }) => row.id}
          nameColumn={{
            getName: (row: { id: string; name: string }) => row.name,
            getPath: () => '#',
          }}
          columns={[]}
          emptyState={<EmptyState message="No channels yet" />}
        />
      </PageSection>

      <PageSection
        title="DataTable — sort, sticky header, search"
        description="Full-width search, result count row, scroll inside the table; click Name or Score to sort."
      >
        <DataTable
          variant="list"
          rows={filteredStickyRows}
          totalRowCount={STICKY_DEMO_ROWS.length}
          rowKey={(row) => row.id}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Filter demo channels…"
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#channel-${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
            },
          ]}
        />
      </PageSection>

      <PageSection title="DataTable — column picker">
        <DataTable
          variant="list"
          rows={COLUMN_PICKER_ROWS}
          totalRowCount={COLUMN_PICKER_ROWS.length}
          rowKey={(row) => row.id}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
              hideable: true,
              defaultVisible: true,
            },
            {
              key: 'note',
              header: 'Note',
              render: (row) => row.note,
              hideable: true,
              defaultVisible: false,
            },
          ]}
          columnVisibilityStorageKey="styleguide-datatable-columns"
        />
      </PageSection>

      <PageSection title="DataTable — selection and footer toolbar">
        <DataTable
          variant="list"
          rows={COLUMN_PICKER_ROWS}
          totalRowCount={COLUMN_PICKER_ROWS.length}
          rowKey={(row) => row.id}
          selectable
          selectedKeys={selectedKeys}
          onSelectedKeysChange={setSelectedKeys}
          nameColumn={{
            getName: (row) => row.name,
            getPath: (row) => `#${row.id}`,
          }}
          columns={[
            {
              key: 'score',
              header: 'Score',
              render: (row) => row.score,
              sortValue: (row) => row.score,
            },
          ]}
          toolbar={
            <Button variant="light" size="compact-sm" disabled={selectedKeys.length === 0}>
              Sample bulk action
            </Button>
          }
        />
        <Text size="sm" c="dimmed" mt="xs">
          Selected: {selectedKeys.length ? selectedKeys.join(', ') : 'none'}
        </Text>
      </PageSection>

      <PageSection title="DataTable — filtered empty">
        <DataTable
          variant="list"
          rows={[]}
          totalRowCount={12}
          rowKey={(row: { id: string }) => row.id}
          nameColumn={{
            getName: (row: { id: string; name: string }) => row.name,
            getPath: () => '#',
          }}
          columns={[]}
          search=""
          onSearchChange={() => {}}
          filteredEmptyMessage="No matches for current filter"
        />
      </PageSection>

      <PageSection title="Form fields & buttons">
        <Stack gap="lg">
          <Group>
            <Button>Primary</Button>
            <Button variant="light">Light</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="outline">Outline</Button>
            <Button
              color="red"
              leftSection={<IconTrash size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
            >
              Delete
            </Button>
          </Group>
          <FormSection
            title="Sample fields"
            description="Native Mantine inputs — canonical variants."
          >
            <TextInput label="Name" placeholder="Channel name" />
            <Select label="Mode" data={['FM', 'DMR', 'P25']} defaultValue="FM" />
          </FormSection>
        </Stack>
      </PageSection>

      <PageSection
        title="PercentLevelSlider"
        description="5% step slider with marks — power and squelch on channel edit."
      >
        <Stack gap="lg" maw={480}>
          <PercentLevelSliderDemo label="Power" initial={10} />
          <PercentLevelSliderDemo label="Squelch" initial={null} zeroLabel="Open (0%)" />
        </Stack>
      </PageSection>

      <PageSection title="FormPage sample">
        <FormPage
          title="Edit channel (sample)"
          description="Sticky footer on mobile viewports."
          footer={
            <>
              <Button variant="light">Cancel</Button>
              <Button>Save</Button>
            </>
          }
        >
          <TextInput label="Name" defaultValue="Demo channel" />
        </FormPage>
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
          <BandPillForChannel channel={sampleChannel} />
          <Badge variant="outline">Outline badge</Badge>
        </Group>
      </PageSection>

      <PageSection
        title="Alerts"
        description="Mantine Alert colour conventions — see docs/features/app-shell/alerts.md"
      >
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

      <PageSection title="Nav samples">
        <Stack gap="xs" maw={280}>
          <Text size="sm" c="dimmed">
            NavLink styling (inactive / active)
          </Text>
          <NavLink label="Channels" active />
          <NavLink label="Settings" />
        </Stack>
      </PageSection>

      <PageSection title="Modal">
        <Button onClick={openModal}>Open sample modal</Button>
        <Modal opened={modalOpened} onClose={closeModal} title="Sample modal" size="sm">
          <Text size="sm">Mantine modal — used for column picker and confirm flows.</Text>
        </Modal>
      </PageSection>
    </Page>
  );
}
