import { Alert, Stack, Text, Title } from '@mantine/core';
import { MemoryCategories, MemoryCategoryPanel } from '@app/components/debug/index.ts';
import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '@app/components/v2/index.ts';
import {
  OPENGD77_CHANNEL_CAVEAT,
  OPENGD77_CHANNELS_EMPTY,
  OPENGD77_MEMORY_INTRO,
  OPENGD77_ZONE_CAVEAT,
  OPENGD77_ZONES_EMPTY,
  OPENGD77_ZONES_UNAVAILABLE,
  opengd77BankMissingText,
  opengd77ChannelSummary,
  opengd77RefusedTitle,
  opengd77ZoneSummary,
} from '@integrations/radio-io/radios/opengd77/debugMemoryText.ts';
import type { RadioChannelDto, RadioTone } from '@integrations/radio-io/radioChannelDto.ts';
import {
  projectOpenGd77Memory,
  type OpenGd77ChannelEntry,
  type OpenGd77MemberStatus,
  type OpenGd77MemoryInventory,
  type OpenGd77ZoneEntry,
  type OpenGd77ZoneMember,
} from '@integrations/radio-io/radios/opengd77/debugMemory.ts';
import { ContactsPanel, RxGroupsPanel, UserDatabasePanel } from './OpenGd77Directories.tsx';
import { archiveKey } from './viewerUtils.ts';
import type { DebugArchive } from './captureArchive.ts';

const NOT_CAPTURED = 'Not captured';
const DASH = '—';

const mhz = (hz: number) => (hz / 1e6).toFixed(5);

function formatTone(tone: RadioTone): string {
  if (tone.kind === 'ctcss') return `${tone.hz} Hz`;
  if (tone.kind === 'dcs') return `D${String(tone.code).padStart(3, '0')}${tone.polarity ?? 'N'}`;
  return 'None';
}

const MODE_LABEL: Record<NonNullable<RadioChannelDto['mode']>, string> = {
  analog: 'Analogue',
  digital: 'Digital',
  'fixed-analog': 'Analogue (fixed)',
  'fixed-digital': 'Digital (fixed)',
};

const MEMBER_EXPLANATION: Record<OpenGd77MemberStatus, string> = {
  resolved: 'Resolved',
  absent: 'Absent: the channel bitmap does not mark this slot occupied',
  'empty-record': 'Unreadable: the slot is marked occupied but its record is empty',
  'not-captured': 'Not captured: the bank holding this channel was not captured',
  'out-of-range': 'Out of range: beyond the 1024 channel slots',
};

interface ChannelRow {
  id: string;
  slot: number;
  entry: OpenGd77ChannelEntry;
  label: string;
  channel?: RadioChannelDto;
}

function channelRow(entry: OpenGd77ChannelEntry): ChannelRow {
  const base = { id: `channel-${entry.slot}`, slot: entry.slot, entry };
  if (entry.state === 'occupied-empty-record') return { ...base, label: 'Occupied, empty record' };
  return { ...base, channel: entry.channel, label: entry.channel.wireName || '(unnamed)' };
}

const cell = (row: ChannelRow, value: (c: RadioChannelDto) => string | number | undefined) =>
  row.channel ? (value(row.channel) ?? DASH) : DASH;

const isDigital = (c: RadioChannelDto) => c.mode === 'digital' || c.mode === 'fixed-digital';

const channelColumns: DataTableColumn<ChannelRow>[] = [
  {
    key: 'slot',
    header: 'Slot',
    width: '4.5rem',
    sortable: true,
    sortValue: (r) => r.slot,
    render: (r) => r.slot,
    hideOnMobile: true,
  },
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(14rem, 2fr)',
    sortable: true,
    sortValue: (r) => r.label,
    render: (r) => (
      <>
        <strong>{r.label}</strong>
        {r.entry.state === 'occupied-empty-record' && (
          <Text size="xs">Occupied in the bitmap, but the captured record is empty</Text>
        )}
      </>
    ),
    hideOnMobile: true,
  },
  {
    key: 'rx',
    header: 'RX MHz',
    width: '6.5rem',
    sortable: true,
    sortValue: (r) => r.channel?.rxHz ?? null,
    render: (r) => cell(r, (c) => mhz(c.rxHz)),
  },
  {
    key: 'tx',
    header: 'TX MHz',
    width: '6.5rem',
    sortable: true,
    sortValue: (r) => r.channel?.txHz ?? null,
    render: (r) => cell(r, (c) => mhz(c.txHz)),
  },
  {
    key: 'mode',
    header: 'Mode',
    width: '7rem',
    sortable: true,
    sortValue: (r) => r.channel?.mode ?? null,
    render: (r) => cell(r, (c) => (c.mode ? MODE_LABEL[c.mode] : undefined)),
  },
  { key: 'bw', header: 'Bandwidth', width: '6rem', render: (r) => cell(r, (c) => c.bandwidth) },
  {
    key: 'power',
    header: 'Power step',
    width: '6rem',
    render: (r) => cell(r, (c) => (c.powerPercent == null ? 'Default' : `${c.powerPercent}%`)),
  },
  {
    key: 'rxTone',
    header: 'RX tone',
    width: '6rem',
    render: (r) => cell(r, (c) => formatTone(c.rxTone)),
  },
  {
    key: 'txTone',
    header: 'TX tone',
    width: '6rem',
    render: (r) => cell(r, (c) => formatTone(c.txTone)),
  },
  {
    key: 'cc',
    header: 'CC',
    width: '3.5rem',
    render: (r) => cell(r, (c) => (isDigital(c) ? c.colorCode : undefined)),
  },
  {
    key: 'ts',
    header: 'TS',
    width: '3.5rem',
    render: (r) => cell(r, (c) => (isDigital(c) ? c.timeslot : undefined)),
  },
  {
    key: 'squelch',
    header: 'Squelch',
    width: '5.5rem',
    render: (r) => cell(r, (c) => (c.squelchPercent == null ? undefined : `${c.squelchPercent}%`)),
  },
  {
    key: 'contact',
    header: 'TX contact',
    width: '6.5rem',
    render: (r) =>
      cell(r, (c) => (c.txContactId != null ? `#${c.txContactId} (unresolved)` : undefined)),
  },
  {
    key: 'rxGroup',
    header: 'RX group',
    width: '6.5rem',
    render: (r) =>
      cell(r, (c) => (c.rxGroupIndex != null ? `#${c.rxGroupIndex + 1} (unresolved)` : undefined)),
  },
  {
    key: 'flags',
    header: 'Flags',
    width: 'minmax(10rem, 1.5fr)',
    render: (r) =>
      cell(
        r,
        (c) =>
          [c.skipScan && 'Skip scan', c.skipZoneScan && 'Skip zone scan', c.rxOnly && 'RX only']
            .filter(Boolean)
            .join(', ') || undefined,
      ),
  },
];

function ChannelsPanel({ channels }: { channels: OpenGd77MemoryInventory['channels'] }) {
  const rows = useMemo(() => channels.entries.map(channelRow), [channels]);
  const missing = channels.banks.filter((b) => b.status === 'not-captured');
  return (
    <Stack gap="sm">
      {missing.map((b) => (
        <Alert key={b.bank} color="yellow" title={NOT_CAPTURED}>
          {opengd77BankMissingText(b.bank, b.firstSlot, b.lastSlot)}
        </Alert>
      ))}
      <MemoryCategoryPanel
        summary={opengd77ChannelSummary({
          occupied: channels.occupied,
          empty: channels.emptySlots,
          notCaptured: channels.notCapturedSlots,
          decoded: channels.decoded,
          capacity: channels.capacity,
        })}
        caveat={OPENGD77_CHANNEL_CAVEAT}
        searchPlaceholder="Search channels"
        caption="OpenGD77 memory channels"
        columns={channelColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) =>
          [
            r.slot,
            r.label,
            r.channel ? `${mhz(r.channel.rxHz)} ${mhz(r.channel.txHz)}` : '',
            r.channel?.mode ? MODE_LABEL[r.channel.mode] : '',
          ].join(' ')
        }
        defaultSort={{ key: 'slot', direction: 'asc' }}
        stickyFirstColumn
        mobileIdentity={(r) => (
          <span>
            {r.slot} · <strong>{r.label}</strong>
          </span>
        )}
        mobileIdentityLabel="Slot · name"
        emptyMessage={OPENGD77_CHANNELS_EMPTY}
      />
    </Stack>
  );
}

interface MemberRow {
  id: string;
  member: OpenGd77ZoneMember;
}

const MEMBER_COLUMNS: DataTableColumn<MemberRow>[] = [
  { key: 'position', header: 'Order', width: '4.5rem', render: (r) => r.member.position },
  { key: 'slot', header: 'Channel', width: '6rem', render: (r) => r.member.channelNumber },
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(14rem, 2fr)',
    render: (r) =>
      r.member.status === 'resolved' ? (
        <strong>{r.member.channelName || '(unnamed)'}</strong>
      ) : (
        DASH
      ),
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(16rem, 2fr)',
    render: (r) => MEMBER_EXPLANATION[r.member.status],
  },
];

interface ZoneRow {
  id: string;
  slot: number;
  label: string;
  memberCount: number;
}

const zoneRow = (entry: OpenGd77ZoneEntry): ZoneRow => ({
  id: `zone-${entry.slot}`,
  slot: entry.slot,
  label: entry.name ?? 'Unnamed zone',
  memberCount: entry.members.length,
});

const zoneColumns: DataTableColumn<ZoneRow>[] = [
  {
    key: 'slot',
    header: 'Zone slot',
    width: '6rem',
    sortable: true,
    sortValue: (r) => r.slot,
    render: (r) => r.slot,
  },
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(12rem, 2fr)',
    sortable: true,
    sortValue: (r) => r.label,
    render: (r) => <strong>{r.label}</strong>,
  },
  {
    key: 'members',
    header: 'Members',
    width: '8rem',
    sortable: true,
    sortValue: (r) => r.memberCount,
    render: (r) => r.memberCount,
  },
];

function ZoneMembers({ zone }: { zone: OpenGd77ZoneEntry }) {
  return (
    <Stack gap="xs" aria-label={`Zone ${zone.slot} members`} role="region">
      <Title order={4}>
        Zone {zone.slot} · {zone.name ?? 'Unnamed zone'}
      </Title>
      <DataTable
        caption={`Zone ${zone.slot} members`}
        variant="embedded"
        columns={MEMBER_COLUMNS}
        rows={zone.members.map((member) => ({ id: `member-${member.position}`, member }))}
        getRowId={(r) => r.id}
        emptyMessage="This zone has no members."
      />
    </Stack>
  );
}

function ZonesPanel({ zones }: { zones: OpenGd77MemoryInventory['zones'] }) {
  const rows = useMemo(() => zones.entries.map(zoneRow), [zones]);
  if (zones.status !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {OPENGD77_ZONES_UNAVAILABLE}
      </Alert>
    );
  const byId = new Map(zones.entries.map((z) => [`zone-${z.slot}`, z]));
  return (
    <MemoryCategoryPanel
      summary={opengd77ZoneSummary(zones.entries.length, zones.capacity)}
      caveat={OPENGD77_ZONE_CAVEAT}
      searchPlaceholder="Search zones"
      caption="OpenGD77 zones"
      columns={zoneColumns}
      rows={rows}
      getRowId={(r) => r.id}
      searchText={(r) => `${r.slot} ${r.label}`}
      defaultSort={{ key: 'slot', direction: 'asc' }}
      details={(r) => <ZoneMembers zone={byId.get(r.id)!} />}
      emptyMessage={OPENGD77_ZONES_EMPTY}
    />
  );
}

/** Read-only OpenGD77 Memory viewer. Replacing the archive remounts it (the page keys it). */
export function OpenGd77Memory({ archive }: { archive?: DebugArchive }) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert title="No capture">Open or read a capture to inspect its memory.</Alert>
      </Stack>
    );
  return <OpenGd77MemoryLoaded key={archiveKey(archive)} archive={archive} />;
}

function OpenGd77MemoryLoaded({ archive }: { archive: DebugArchive }) {
  const projection = useMemo(
    () => projectOpenGd77Memory(archive, archive.manifest.radioModelId),
    [archive],
  );
  if (projection.status !== 'ok')
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert color="red" title="Nothing decoded">
          {projection.reason}
        </Alert>
      </Stack>
    );
  return (
    <Stack>
      <Title order={3}>Memory</Title>
      <Text size="sm" c="dimmed">
        {OPENGD77_MEMORY_INTRO}
      </Text>
      {projection.refused.length > 0 && (
        <Alert color="yellow" title={opengd77RefusedTitle(projection.refused.length)}>
          {projection.refused.map((r) => (
            <Text size="sm" key={r.id}>
              {r.id}: {r.reason}
            </Text>
          ))}
        </Alert>
      )}
      <MemoryCategories
        storageKey="debug-memory-category:opengd77"
        categories={[
          {
            value: 'channels',
            label: 'Channels',
            count: projection.channels.entries.length,
            render: () => <ChannelsPanel channels={projection.channels} />,
          },
          {
            value: 'zones',
            label: 'Zones',
            render: () => <ZonesPanel zones={projection.zones} />,
          },
          {
            value: 'contacts',
            label: 'Contacts',
            render: () => <ContactsPanel archive={archive} />,
          },
          {
            value: 'rx-groups',
            label: 'RX groups',
            render: () => <RxGroupsPanel archive={archive} />,
          },
          {
            value: 'user-database',
            label: 'User Database',
            render: () => <UserDatabasePanel archive={archive} />,
          },
        ]}
      />
    </Stack>
  );
}
