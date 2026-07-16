import {
  Alert,
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  NavLink,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconGripVertical, IconTrash, IconX } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import type { ForbidTransmitOverride } from '@core/models/channelBehaviourDefaults.ts';
import { newChannel } from '@core/domain/factories.ts';
import { UK_BANDS } from '../lib/bands.ts';
import { BandPill, BandPillForChannel, ModePill } from '../components/pills/index.ts';
import type { ChannelMode } from '../lib/channelModes.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../lib/iconSizes.ts';
import {
  AvailableItemPicker,
  DataTable,
  EmptyState,
  FormPage,
  FormSection,
  GradientSegmentedControl,
  ListPage,
  Page,
  PageHeader,
  PageSection,
  PageSectionGrid,
  PercentLevelSlider,
  PillTabs,
  ImageCheckboxGroup,
  SelectedItemList,
  SoftWarning,
  SplitButton,
} from '../components/ui/index.ts';
import ForbidTransmitSegment from '../components/channels/ForbidTransmitSegment.tsx';
import ScanInclusionSegment from '../components/channels/ScanInclusionSegment.tsx';

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

const LARGE_VIRTUAL_DEMO_ROWS = Array.from({ length: 250 }, (_, i) => ({
  id: String(i + 1),
  name: `Contact ${String(i + 1).padStart(4, '0')}`,
  score: (i * 13) % 100,
}));

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

function ForbidTransmitSegmentDemo() {
  const [forbidTransmit, setForbidTransmit] = useState<ForbidTransmitOverride>('default');
  return <ForbidTransmitSegment value={forbidTransmit} onChange={setForbidTransmit} />;
}

function ScanInclusionSegmentDemo() {
  const [scanInclusion, setScanInclusion] = useState<'default' | 'skip' | 'alwaysScan'>('default');
  return <ScanInclusionSegment value={scanInclusion} onChange={setScanInclusion} />;
}

function SplitButtonDemo() {
  const [last, setLast] = useState('None');
  return (
    <Stack gap="sm" maw={320}>
      <SplitButton
        label="Add channels"
        onClick={() => setLast('Add channels')}
        menuItems={[{ label: 'Add as zone', onClick: () => setLast('Add as zone') }]}
      />
      <Text size="sm" c="dimmed">
        Last action: {last}
      </Text>
    </Stack>
  );
}

function GradientSegmentedControlDemo({
  label,
  scheme,
  options,
  initial,
}: {
  label: string;
  scheme: 'onOff' | 'allowForbid' | 'three' | 'four' | 'five';
  options: { value: string; label: string }[];
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <GradientSegmentedControl
      label={label}
      value={value}
      onChange={setValue}
      scheme={scheme}
      data={options}
      fullWidth
    />
  );
}

function vacationIcon(emoji: string, fill: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="6" fill="${fill}"/><text x="20" y="27" font-size="20" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function ImageCheckboxDemo() {
  const [vacation, setVacation] = useState<string[]>(['beach']);
  const [modes, setModes] = useState<ChannelMode[]>(['fm', 'dmr']);

  return (
    <Stack gap="xl" maw={640}>
      <ImageCheckboxGroup
        label="With images"
        description="Mantine UI vacation cards — image optional on each option."
        value={vacation}
        onChange={setVacation}
        cols={{ base: 2, sm: 3 }}
        options={[
          {
            value: 'beach',
            title: 'Beach vacation',
            description: 'Sun and sea',
            imageSrc: vacationIcon('🏖', '#fff3bf'),
          },
          {
            value: 'city',
            title: 'City trips',
            description: 'Sightseeing',
            imageSrc: vacationIcon('🏙', '#d0ebff'),
          },
          {
            value: 'hike',
            title: 'Hiking vacation',
            description: 'Mountains',
            imageSrc: vacationIcon('⛰', '#d3f9d8'),
          },
          {
            value: 'winter',
            title: 'Winter vacation',
            description: 'Snow and ice',
            imageSrc: vacationIcon('❄', '#e7f5ff'),
          },
        ]}
      />

      <ImageCheckboxGroup
        label="Media slot (no image)"
        description="Channel mode picker uses `ModePill` in the media slot."
        value={modes}
        onChange={setModes}
        cols={{ base: 2, sm: 3 }}
        options={[
          {
            value: 'fm',
            title: 'FM',
            description: 'Analog',
            media: <ModePill mode="fm" size="xs" />,
          },
          {
            value: 'dmr',
            title: 'DMR',
            description: 'Digital',
            media: <ModePill mode="dmr" size="xs" />,
          },
          {
            value: 'dstar',
            title: 'D-STAR',
            description: 'Digital',
            media: <ModePill mode="dstar" size="xs" />,
          },
          {
            value: 'ysf',
            title: 'YSF',
            description: 'Digital',
            media: <ModePill mode="ysf" size="xs" />,
          },
        ]}
      />
    </Stack>
  );
}

function PillTabsDemo() {
  const [active, setActive] = useState('fm');
  return (
    <PillTabs
      value={active}
      onChange={setActive}
      items={[
        {
          value: 'fm',
          leading: <ModePill mode="fm" size="xs" />,
          label: 'FM',
          panel: (
            <Text size="sm" c="dimmed">
              Analog panel body — bandwidth, tones, squelch.
            </Text>
          ),
        },
        {
          value: 'dmr',
          leading: <ModePill mode="dmr" size="xs" />,
          label: 'DMR',
          panel: (
            <Text size="sm" c="dimmed">
              Digital panel body — colour code, contact, RX group list.
            </Text>
          ),
        },
        {
          value: 'dstar',
          leading: <ModePill mode="dstar" size="xs" />,
          label: 'D-STAR',
          panel: (
            <Text size="sm" c="dimmed">
              Stub panel — swap tab panels for mode-specific form sections.
            </Text>
          ),
        },
      ]}
    />
  );
}

const MEMBERSHIP_DEMO_CATALOG = {
  alpha: {
    key: 'alpha',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'GB3DA Stornoway',
    subtitle: '145.575 / 145.175 MHz',
    modes: ['fm'] as ChannelMode[],
    bandId: '2m' as const,
  },
  bravo: {
    key: 'bravo',
    pool: 'zones' as const,
    kind: 'zone' as const,
    label: 'Highlands',
    subtitle: '8 channels effective',
  },
  charlie: {
    key: 'charlie',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'BM Scotland 1',
    subtitle: '439.275 / 430.875 MHz',
    modes: ['dmr'] as ChannelMode[],
    bandId: '70cm' as const,
  },
  delta: {
    key: 'delta',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'Local FM net',
    subtitle: '145.500 / 145.500 MHz',
    modes: ['fm'] as ChannelMode[],
    bandId: '2m' as const,
    scanInclusion: 'skip',
  },
  echo: {
    key: 'echo',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'GB3IV Inverness',
    subtitle: '430.950 / 438.950 MHz',
    modes: ['dmr', 'ysf'] as ChannelMode[],
    bandId: '70cm' as const,
  },
  foxtrot: {
    key: 'foxtrot',
    pool: 'zones' as const,
    kind: 'zone' as const,
    label: 'City repeaters',
    subtitle: '5 channels effective',
  },
  golf: {
    key: 'golf',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'DSTAR reflector',
    subtitle: '434.612 / 434.612 MHz',
    modes: ['dstar'] as ChannelMode[],
    bandId: '70cm' as const,
  },
} satisfies Record<
  string,
  {
    key: string;
    pool: 'channels' | 'zones';
    kind: 'channel' | 'zone';
    label: string;
    subtitle: string;
    modes?: ChannelMode[];
    bandId?: '2m' | '70cm';
    scanInclusion?: 'default' | 'skip' | 'alwaysScan';
  }
>;

type MembershipDemoKey = keyof typeof MEMBERSHIP_DEMO_CATALOG;

const MEMBERSHIP_DEMO_POOL: Record<'channels' | 'zones', MembershipDemoKey[]> = {
  channels: ['charlie', 'delta', 'echo', 'golf'],
  zones: ['foxtrot'],
};

function membershipDemoMatchesFilter(key: MembershipDemoKey, filterLower: string): boolean {
  if (!filterLower) return true;
  const entry = MEMBERSHIP_DEMO_CATALOG[key];
  const haystack = `${entry.label} ${entry.subtitle}`.toLowerCase();
  return haystack.includes(filterLower);
}

function MembershipListsDemo() {
  const [selectedKeys, setSelectedKeys] = useState<MembershipDemoKey[]>(['alpha', 'bravo']);
  const [listSelection, setListSelection] = useState<MembershipDemoKey[]>([]);
  const [poolChannelPick, setPoolChannelPick] = useState<MembershipDemoKey[]>([]);
  const [poolZonePick, setPoolZonePick] = useState<MembershipDemoKey[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('');
  const [poolFilter, setPoolFilter] = useState('');
  const [hideFilteredFromMap, setHideFilteredFromMap] = useState(false);
  const [scanListByKey, setScanListByKey] = useState<Partial<Record<MembershipDemoKey, boolean>>>({
    alpha: true,
    charlie: true,
  });

  const selectedFilterLower = selectedFilter.trim().toLowerCase();
  const poolFilterLower = poolFilter.trim().toLowerCase();

  const filteredSelected = selectedKeys.filter((key) =>
    membershipDemoMatchesFilter(key, selectedFilterLower),
  );

  const poolChannels = MEMBERSHIP_DEMO_POOL.channels.filter(
    (key) => !selectedKeys.includes(key) && membershipDemoMatchesFilter(key, poolFilterLower),
  );
  const poolZones = MEMBERSHIP_DEMO_POOL.zones.filter(
    (key) => !selectedKeys.includes(key) && membershipDemoMatchesFilter(key, poolFilterLower),
  );

  const toggleListSelect = (key: MembershipDemoKey) => {
    setListSelection((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const removeSelectedBulk = () => {
    if (!listSelection.length) return;
    const remove = new Set(listSelection);
    setSelectedKeys((prev) => prev.filter((key) => !remove.has(key)));
    setListSelection([]);
  };

  const addFromPool = () => {
    const toAdd = [...poolChannelPick, ...poolZonePick];
    if (!toAdd.length) return;
    setSelectedKeys((prev) => [...prev, ...toAdd]);
    setPoolChannelPick([]);
    setPoolZonePick([]);
  };

  const moveSelected = (direction: 'up' | 'down') => {
    if (!listSelection.length) return;
    setSelectedKeys((prev) => {
      const next = [...prev];
      const indices = listSelection
        .map((key) => next.indexOf(key))
        .filter((index) => index >= 0)
        .sort((a, b) => (direction === 'up' ? a - b : b - a));
      for (const index of indices) {
        const swapWith = direction === 'up' ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= next.length) continue;
        if (listSelection.includes(next[swapWith]!)) continue;
        [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
      }
      return next;
    });
  };

  const canMoveUp = listSelection.some((key) => selectedKeys.indexOf(key) > 0);
  const canMoveDown = listSelection.some((key) => {
    const index = selectedKeys.indexOf(key);
    return index >= 0 && index < selectedKeys.length - 1;
  });

  const channelCount = selectedKeys.filter(
    (key) => MEMBERSHIP_DEMO_CATALOG[key].kind === 'channel',
  ).length;

  return (
    <Stack gap="lg" maw={640}>
      <SelectedItemList
        title="In this zone"
        description={`${selectedKeys.length} direct member${selectedKeys.length === 1 ? '' : 's'} · ${channelCount} channels effective — export order`}
        filter={{
          value: selectedFilter,
          onChange: setSelectedFilter,
          placeholder: 'Filter members…',
          'aria-label': 'Filter selected members',
        }}
        itemKeys={filteredSelected}
        selectedKeys={listSelection}
        onToggleSelect={toggleListSelect}
        onRemove={(key) => {
          setSelectedKeys((prev) => prev.filter((x) => x !== key));
          setListSelection((prev) => prev.filter((x) => x !== key));
        }}
        emptyMessage="No members in zone"
        renderItem={({ itemKey, selected, onToggleSelect, onRemove }) => {
          const entry = MEMBERSHIP_DEMO_CATALOG[itemKey];

          if (entry.kind === 'zone') {
            return (
              <Paper key={itemKey} withBorder p="xs" radius="sm">
                <Group gap="sm" wrap="nowrap" justify="space-between">
                  <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <Checkbox
                      checked={selected}
                      onChange={onToggleSelect}
                      aria-label={`Select ${entry.label}`}
                    />
                    <IconGripVertical
                      size={14}
                      stroke={ICON_STROKE}
                      style={{ opacity: 0.35, flexShrink: 0 }}
                    />
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        Zone: {entry.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {entry.subtitle}
                      </Text>
                    </Stack>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="xs" c="brand">
                      Open zone
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={onRemove}
                      aria-label="Remove"
                    >
                      <IconX size={14} stroke={ICON_STROKE} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            );
          }

          const band = entry.bandId ? (UK_BANDS.find((b) => b.id === entry.bandId) ?? null) : null;

          return (
            <Paper key={itemKey} withBorder p="xs" radius="sm">
              <Group gap="sm" wrap="nowrap" justify="space-between" align="flex-start">
                <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  <Checkbox
                    checked={selected}
                    onChange={onToggleSelect}
                    aria-label={`Select ${entry.label}`}
                  />
                  <IconGripVertical
                    size={14}
                    stroke={ICON_STROKE}
                    style={{ opacity: 0.35, flexShrink: 0 }}
                  />
                  <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" wrap="wrap">
                      <Text size="sm" fw={500}>
                        {entry.label}
                      </Text>
                      {band ? <BandPill band={band} size="xs" /> : null}
                      {entry.modes.map((mode) => (
                        <ModePill key={mode} mode={mode} size="xs" />
                      ))}
                      {(() => {
                        const scanInclusion =
                          'scanInclusion' in entry ? entry.scanInclusion : undefined;
                        if (scanInclusion === 'skip') {
                          return (
                            <Badge size="xs" variant="light" color="gray">
                              Skip scan
                            </Badge>
                          );
                        }
                        if (scanInclusion === 'alwaysScan') {
                          return (
                            <Badge size="xs" variant="light" color="teal">
                              Always scan
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {entry.subtitle}
                    </Text>
                  </Stack>
                </Group>
                <Group gap="xs" wrap="nowrap" align="center">
                  <Tooltip label="Include in zone-derived scan lists at export">
                    <Checkbox
                      label="Scan list"
                      size="xs"
                      checked={scanListByKey[itemKey] ?? true}
                      onChange={(e) =>
                        setScanListByKey((prev) => ({
                          ...prev,
                          [itemKey]: e.currentTarget.checked,
                        }))
                      }
                    />
                  </Tooltip>
                  <Text size="xs" c="brand">
                    Open
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={onRemove}
                    aria-label="Remove"
                  >
                    <IconX size={14} stroke={ICON_STROKE} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          );
        }}
        toolbar={
          <Group gap="xs">
            <Button
              type="button"
              variant="default"
              size="compact-sm"
              onClick={() => moveSelected('up')}
              disabled={!canMoveUp}
            >
              Move up
            </Button>
            <Button
              type="button"
              variant="default"
              size="compact-sm"
              onClick={() => moveSelected('down')}
              disabled={!canMoveDown}
            >
              Move down
            </Button>
            <Button
              variant="light"
              size="compact-sm"
              disabled={!listSelection.length}
              onClick={removeSelectedBulk}
            >
              Remove selected
            </Button>
            <Text size="xs" c="dimmed">
              Reorder demo — zone editor also supports Alt+↑/↓
            </Text>
          </Group>
        }
      />

      <AvailableItemPicker
        title="Other channels & zones"
        filter={{
          value: poolFilter,
          onChange: setPoolFilter,
          placeholder: 'Filter…',
          'aria-label': 'Filter available channels and zones',
        }}
        sections={[
          {
            id: 'channels',
            title: 'Channels',
            itemKeys: poolChannels,
            selectedKeys: poolChannelPick,
            onToggleSelect: (key) =>
              setPoolChannelPick((prev) =>
                prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
              ),
            emptyMessage: 'No channels available',
            renderItem: ({ itemKey, checked, onToggle }) => {
              const entry = MEMBERSHIP_DEMO_CATALOG[itemKey];
              if (entry.kind !== 'channel') return null;
              const band = entry.bandId
                ? (UK_BANDS.find((b) => b.id === entry.bandId) ?? null)
                : null;
              return (
                <Group key={itemKey} gap="sm" wrap="nowrap">
                  <Checkbox
                    checked={checked}
                    onChange={onToggle}
                    aria-label={`Select ${entry.label}`}
                  />
                  <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
                    {entry.label}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                    {entry.subtitle}
                  </Text>
                  {band ? <BandPill band={band} size="xs" /> : null}
                  {entry.modes.slice(0, 2).map((mode) => (
                    <ModePill key={mode} mode={mode} size="xs" />
                  ))}
                </Group>
              );
            },
          },
          {
            id: 'zones',
            title: 'Zones',
            itemKeys: poolZones,
            selectedKeys: poolZonePick,
            onToggleSelect: (key) =>
              setPoolZonePick((prev) =>
                prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
              ),
            emptyMessage: 'No zones available',
            renderItem: ({ itemKey, checked, onToggle }) => {
              const entry = MEMBERSHIP_DEMO_CATALOG[itemKey];
              return (
                <Checkbox
                  key={itemKey}
                  label={`Zone: ${entry.label}`}
                  description={entry.subtitle}
                  checked={checked}
                  onChange={onToggle}
                />
              );
            },
          },
        ]}
        onAddSelected={addFromPool}
        addDisabled={!poolChannelPick.length && !poolZonePick.length}
        footer={
          <Checkbox
            label="Hide filtered entries from map (demo)"
            checked={hideFilteredFromMap}
            disabled={!poolFilterLower}
            onChange={(e) => setHideFilteredFromMap(e.currentTarget.checked)}
          />
        }
      />
    </Stack>
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

      <PageSection
        title="DataTable — large virtual list"
        description="250 rows with virtualize auto (threshold 75). Scroll to confirm sticky header and smooth tbody windowing."
      >
        <DataTable
          variant="list"
          rows={LARGE_VIRTUAL_DEMO_ROWS}
          totalRowCount={LARGE_VIRTUAL_DEMO_ROWS.length}
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
            },
          ]}
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
        title="GradientSegmentedControl"
        description="Default track; indicator colour fades to match the active segment."
      >
        <Stack gap="lg" maw={480}>
          <GradientSegmentedControlDemo
            label="On / Off"
            scheme="onOff"
            initial="on"
            options={[
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
          />
          <ForbidTransmitSegmentDemo />
          <ScanInclusionSegmentDemo />
          <GradientSegmentedControlDemo
            label="Three segments"
            scheme="three"
            initial="a"
            options={[
              { value: 'a', label: 'A' },
              { value: 'b', label: 'B' },
              { value: 'c', label: 'C' },
            ]}
          />
          <GradientSegmentedControlDemo
            label="Four segments"
            scheme="four"
            initial="1"
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3' },
              { value: '4', label: '4' },
            ]}
          />
          <GradientSegmentedControlDemo
            label="Five segments"
            scheme="five"
            initial="low"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'med-low', label: 'Med−' },
              { value: 'med', label: 'Med' },
              { value: 'med-high', label: 'Med+' },
              { value: 'high', label: 'High' },
            ]}
          />
        </Stack>
      </PageSection>

      <PageSection
        title="SplitButton"
        description="Primary action with a chevron menu for secondary actions — from Mantine UI buttons gallery."
      >
        <SplitButtonDemo />
      </PageSection>

      <PageSection
        title="ImageCheckbox"
        description="Card checkboxes with optional image or custom media — from Mantine UI inputs gallery."
      >
        <ImageCheckboxDemo />
      </PageSection>

      <PageSection
        title="PillTabs"
        description="Tabs with optional leading pill or badge — channel mode profiles use this pattern."
      >
        <Stack maw={560}>
          <PillTabsDemo />
        </Stack>
      </PageSection>

      <PageSection
        title="SelectedItemList & AvailableItemPicker"
        description="Membership shells with rich row renderers — mirrors zone editor channel/zone rows, pills, and scan-list toggle."
      >
        <MembershipListsDemo />
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
        title="SoftWarning"
        description="Theme-aware compact warning panels for sidebar chrome — see src/app/components/ui/SoftWarning.md"
      >
        <Stack gap="sm" maw={280}>
          <SoftWarning title="Browser-only backup" onDismiss={() => undefined}>
            This project is only stored in this browser — export YAML to back up.
          </SoftWarning>
          <SoftWarning tone="danger">
            Session expired — click Save or Check to reconnect. You can keep working locally.
          </SoftWarning>
        </Stack>
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
