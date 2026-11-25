import { Alert, List, Stack, Text, Title } from '@mantine/core';
import {
  identityLabel,
  MemoryCategories,
  MemoryCategoryPanel,
} from '@app/components/debug/index.ts';
import { useMemo, type ReactNode } from 'react';
import type { DataTableColumn } from '@app/components/v2/index.ts';
import type {
  Channel,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  NumericOwnDigitalId,
  Zone,
} from '@core/models/library.ts';
import type { ChannelTone } from '@core/models/libraryTypes.ts';
import { projectRadioFoundryMemory } from '@integrations/radio-io/radios/radiofoundry/debugMemory.ts';
import type { BinaryCpsImportResult } from '@core/import-export/types.ts';
import { archiveKey } from './viewerUtils.ts';
import type { DebugArchive } from './captureArchive.ts';
import { memoByArchive } from './archiveMemo.ts';
import { RadioFoundryIdDatabasePanel } from './RadioFoundryIdDatabasePanel.tsx';
import { radioFoundryIdDatabaseView } from '@integrations/radio-io/radios/radiofoundry/debugIdDatabase.ts';

const INTRO =
  "Decoded by Studio's RadioFoundry import. Slot numbers and empty-but-occupied slots are not shown.";
const DASH = '—';

const mhz = (hz: number | null) => (hz == null ? DASH : (hz / 1e6).toFixed(5));

const projectMemory = memoByArchive((archive: DebugArchive) =>
  projectRadioFoundryMemory({ manifest: archive.manifest, regions: archive.regions }),
);

function dmrProfile(channel: Channel): ChannelModeProfileDMR | undefined {
  return channel.modeProfiles.find((p): p is ChannelModeProfileDMR => p.mode === 'dmr');
}

function fmProfile(channel: Channel): ChannelModeProfileAnalog | undefined {
  return channel.modeProfiles.find((p): p is ChannelModeProfileAnalog => p.mode === 'fm');
}

function modeLabel(channel: Channel): string {
  if (channel.primaryMode === 'dmr') return 'Digital';
  if (channel.primaryMode === 'fm') return 'Analogue';
  return channel.primaryMode ?? DASH;
}

function formatTone(tone: ChannelTone): string {
  if (tone === 'none' || tone.trim() === '') return 'None';
  return tone;
}

interface ChannelRow {
  id: string;
  channel: Channel;
}

const channelColumns: DataTableColumn<ChannelRow>[] = [
  {
    key: 'identity',
    header: 'Callsign · Name',
    width: 'minmax(12rem, 2fr)',
    sortable: true,
    sortValue: (r) => identityLabel(r.channel.callsign, r.channel.name),
    render: (r) => <strong>{identityLabel(r.channel.callsign, r.channel.name)}</strong>,
  },
  {
    key: 'mode',
    header: 'Mode',
    width: '6rem',
    sortable: true,
    sortValue: (r) => modeLabel(r.channel),
    render: (r) => modeLabel(r.channel),
  },
  {
    key: 'rx',
    header: 'RX MHz',
    width: '6.5rem',
    sortable: true,
    sortValue: (r) => r.channel.rxFrequency,
    render: (r) => mhz(r.channel.rxFrequency),
  },
  {
    key: 'tx',
    header: 'TX MHz',
    width: '6.5rem',
    sortable: true,
    sortValue: (r) => r.channel.txFrequency,
    render: (r) => mhz(r.channel.txFrequency),
  },
  {
    key: 'cc',
    header: 'Colour code',
    width: '6rem',
    render: (r) => dmrProfile(r.channel)?.colourCode ?? DASH,
  },
  {
    key: 'ts',
    header: 'Time slot',
    width: '5rem',
    render: (r) => dmrProfile(r.channel)?.timeslot ?? DASH,
  },
  {
    key: 'rxTone',
    header: 'RX tone',
    width: '6rem',
    render: (r) => {
      const fm = fmProfile(r.channel);
      return fm ? formatTone(fm.rxTone) : DASH;
    },
  },
  {
    key: 'txTone',
    header: 'TX tone',
    width: '6rem',
    render: (r) => {
      const fm = fmProfile(r.channel);
      return fm ? formatTone(fm.txTone) : DASH;
    },
  },
];

function ChannelsPanel({ result }: { result: BinaryCpsImportResult }) {
  const rows = useMemo(
    () => result.channels.map((channel) => ({ id: channel.id, channel })),
    [result.channels],
  );
  return (
    <MemoryCategoryPanel
      summary={`${rows.length} channel${rows.length === 1 ? '' : 's'} decoded.`}
      searchPlaceholder="Search channels"
      caption="RadioFoundry channels"
      columns={channelColumns}
      rows={rows}
      getRowId={(r) => r.id}
      searchText={(r) =>
        `${identityLabel(r.channel.callsign, r.channel.name)} ${mhz(r.channel.rxFrequency)} ${mhz(r.channel.txFrequency)}`
      }
      defaultSort={{ key: 'identity', direction: 'asc' }}
      emptyMessage="No channels were decoded."
    />
  );
}

interface ZoneRow {
  id: string;
  name: string;
  members: string;
  count: number;
}

function zoneMemberLabels(zoneMembers: Zone['members'], channels: readonly Channel[]): string {
  const byId = new Map(channels.map((c) => [c.id, c]));
  return zoneMembers
    .filter((m): m is { kind: 'channel'; channelId: string } => m.kind === 'channel')
    .map((m) => {
      const ch = byId.get(m.channelId);
      return ch ? identityLabel(ch.callsign, ch.name) : 'Unknown channel';
    })
    .join('; ');
}

const zoneColumns: DataTableColumn<ZoneRow>[] = [
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(10rem, 2fr)',
    sortable: true,
    sortValue: (r) => r.name,
    render: (r) => <strong>{r.name}</strong>,
  },
  {
    key: 'count',
    header: 'Members',
    width: '6rem',
    sortable: true,
    sortValue: (r) => r.count,
    render: (r) => r.count,
  },
  {
    key: 'members',
    header: 'Members (identity)',
    width: 'minmax(16rem, 3fr)',
    render: (r) => r.members,
  },
];

function ZonesPanel({ result }: { result: BinaryCpsImportResult }) {
  const rows = useMemo(
    () =>
      result.zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        count: zone.members.filter((m) => m.kind === 'channel').length,
        members: zoneMemberLabels(zone.members, result.channels),
      })),
    [result],
  );
  return (
    <MemoryCategoryPanel
      summary={`${rows.length} zone${rows.length === 1 ? '' : 's'} decoded.`}
      searchPlaceholder="Search zones"
      caption="RadioFoundry zones"
      columns={zoneColumns}
      rows={rows}
      getRowId={(r) => r.id}
      searchText={(r) => `${r.name} ${r.members}`}
      defaultSort={{ key: 'name', direction: 'asc' }}
      emptyMessage="No zones were decoded."
    />
  );
}

interface NamedRow {
  id: string;
  name: string;
  extra?: string;
}

const nameColumns = (extraHeader?: string): DataTableColumn<NamedRow>[] => [
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(12rem, 2fr)',
    sortable: true,
    sortValue: (r) => r.name,
    render: (r) => <strong>{r.name}</strong>,
  },
  ...(extraHeader
    ? [
        {
          key: 'extra',
          header: extraHeader,
          width: '8rem',
          sortable: true,
          sortValue: (r: NamedRow) => r.extra ?? '',
          render: (r: NamedRow) => r.extra ?? DASH,
        } as DataTableColumn<NamedRow>,
      ]
    : []),
];

function SimpleListPanel({
  summary,
  caption,
  searchPlaceholder,
  rows,
  extraHeader,
}: {
  summary: string;
  caption: string;
  searchPlaceholder: string;
  rows: NamedRow[];
  extraHeader?: string;
}) {
  return (
    <MemoryCategoryPanel
      summary={summary}
      searchPlaceholder={searchPlaceholder}
      caption={caption}
      columns={nameColumns(extraHeader)}
      rows={rows}
      getRowId={(r) => r.id}
      searchText={(r) => `${r.name} ${r.extra ?? ''}`}
      defaultSort={{ key: 'name', direction: 'asc' }}
      emptyMessage={`No ${caption.toLowerCase()} were decoded.`}
    />
  );
}

export function RadioFoundryImportNotesPanel({ warnings }: { warnings: readonly string[] }) {
  if (warnings.length === 0) {
    return <Text size="sm">The parser reported no import notes for this capture.</Text>;
  }
  return (
    <List size="sm">
      {warnings.map((line) => (
        <List.Item key={line}>{line}</List.Item>
      ))}
    </List>
  );
}

function idDatabaseCount(archive: DebugArchive): number | undefined {
  const view = radioFoundryIdDatabaseView({
    manifest: archive.manifest,
    regions: archive.regions,
    sidecars: archive.sidecars,
  });
  if (view.status !== 'ok') return undefined;
  return view.area1Records + (typeof view.area2Records === 'number' ? view.area2Records : 0);
}

function RadioFoundryMemoryLoaded({ archive }: { archive: DebugArchive }) {
  const projection = useMemo(() => projectMemory(archive), [archive]);
  const idDbCount = useMemo(() => idDatabaseCount(archive), [archive]);

  if (projection.status === 'not-captured' || projection.status === 'not-decoded') {
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert
          color="yellow"
          title={projection.status === 'not-captured' ? 'Not captured' : 'Not decoded'}
        >
          {projection.reason}
        </Alert>
      </Stack>
    );
  }

  const result = projection.result;
  const dmrIds = result.ownDigitalIds.filter(
    (row): row is NumericOwnDigitalId => row.protocol === 'dmr',
  );
  const categories: {
    value: string;
    label: string;
    count?: number;
    render: () => ReactNode;
  }[] = [
    {
      value: 'channels',
      label: 'Channels',
      count: result.channels.length,
      render: () => <ChannelsPanel result={result} />,
    },
    {
      value: 'zones',
      label: 'Zones',
      count: result.zones.length,
      render: () => <ZonesPanel result={result} />,
    },
    {
      value: 'talk-groups',
      label: 'Talk groups',
      count: result.talkGroups.length,
      render: () => (
        <SimpleListPanel
          summary={`${result.talkGroups.length} talk group${result.talkGroups.length === 1 ? '' : 's'} decoded.`}
          caption="Talk groups"
          searchPlaceholder="Search talk groups"
          rows={result.talkGroups.map((tg) => ({
            id: tg.id,
            name: tg.name,
            extra: String(tg.digitalId),
          }))}
          extraHeader="DMR ID"
        />
      ),
    },
    {
      value: 'contacts',
      label: 'Contacts',
      count: result.digitalContacts.length,
      render: () => (
        <SimpleListPanel
          summary={`${result.digitalContacts.length} contact${result.digitalContacts.length === 1 ? '' : 's'} decoded.`}
          caption="Contacts"
          searchPlaceholder="Search contacts"
          rows={result.digitalContacts.map((c) => ({
            id: c.id,
            name: identityLabel(c.callsign, c.name),
            extra: String(c.digitalId),
          }))}
          extraHeader="DMR ID"
        />
      ),
    },
    {
      value: 'rx-groups',
      label: 'RX groups',
      count: result.rxGroupLists.length,
      render: () => (
        <SimpleListPanel
          summary={`${result.rxGroupLists.length} RX group${result.rxGroupLists.length === 1 ? '' : 's'} decoded.`}
          caption="RX groups"
          searchPlaceholder="Search RX groups"
          rows={result.rxGroupLists.map((g) => ({
            id: g.id,
            name: g.name,
            extra: String(g.members.length),
          }))}
          extraHeader="Members"
        />
      ),
    },
    {
      value: 'radio-ids',
      label: 'Radio IDs',
      count: dmrIds.length,
      render: () => (
        <SimpleListPanel
          summary={`${dmrIds.length} radio ID${dmrIds.length === 1 ? '' : 's'} decoded.`}
          caption="Radio IDs"
          searchPlaceholder="Search radio IDs"
          rows={dmrIds.map((row) => ({
            id: row.id,
            name: row.name,
            extra: String(row.number),
          }))}
          extraHeader="DMR ID"
        />
      ),
    },
    {
      value: 'import-notes',
      label: 'Import notes',
      count: result.warnings.length || undefined,
      render: () => <RadioFoundryImportNotesPanel warnings={result.warnings} />,
    },
    {
      value: 'id-database',
      label: 'DMR ID database',
      count: idDbCount,
      render: () => <RadioFoundryIdDatabasePanel archive={archive} />,
    },
  ];

  return (
    <Stack>
      <Title order={3}>Memory</Title>
      <Text size="sm" c="dimmed">
        {INTRO}
      </Text>
      <Text size="sm" c="dimmed">
        Profile: {projection.profileLabel}
      </Text>
      <MemoryCategories storageKey="debug-memory-category:radiofoundry" categories={categories} />
    </Stack>
  );
}

export function RadioFoundryMemory({
  archive,
}: {
  archive?: DebugArchive;
  notDecoded?: readonly string[];
}) {
  if (!archive) {
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert title="No capture">Open or read a capture to inspect its memory.</Alert>
      </Stack>
    );
  }
  return <RadioFoundryMemoryLoaded key={archiveKey(archive)} archive={archive} />;
}
