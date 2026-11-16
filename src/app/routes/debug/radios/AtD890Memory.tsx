import { Alert, Stack, Text, Title } from '@mantine/core';
import { MemoryCategories, MemoryCategoryPanel } from '@app/components/debug/index.ts';
import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '@app/components/v2/index.ts';
import {
  AT_D890UV_BITMAP_BITS_TITLE,
  AT_D890UV_CHANNELS_EMPTY,
  AT_D890UV_CHANNELS_UNAVAILABLE,
  AT_D890UV_MEMORY_INTRO,
  AT_D890UV_ZONE_BITS_TITLE,
  AT_D890UV_ZONE_CAVEAT,
  AT_D890UV_ZONE_MEMBERS_NOT_CAPTURED,
  AT_D890UV_ZONE_OVER_CAPACITY_TITLE,
  AT_D890UV_ZONES_EMPTY,
  AT_D890UV_ZONES_UNAVAILABLE,
  atD890CaptureSummary,
  atD890ChannelBitsText,
  atD890ChannelCaveat,
  atD890ChannelSummary,
  atD890RefusedTitle,
  atD890ZoneBitsText,
  atD890ZoneOverCapacityText,
  atD890ZoneSummary,
} from '@integrations/radio-io/radios/at-d890uv/debugMemoryText.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { RadioChannelDto, RadioTone } from '@integrations/radio-io/radioChannelDto.ts';
import {
  type AtD890ChannelEntry,
  projectAtD890Memory,
  type AtD890ZoneEntry,
  type AtD890ZoneMember,
} from '@integrations/radio-io/radios/at-d890uv/debugMemory.ts';
import {
  indexBank,
  resolveAtD890BankSlot,
  type AtD890BankEntry,
  type AtD890BankInventory,
} from '@integrations/radio-io/radios/at-d890uv/debugMemoryContacts.ts';
import {
  ContactsPanel,
  RxGroupsPanel,
  TalkGroupsPanel,
  describeBankReference,
} from './AtD890MemoryContacts.tsx';
import { ScanListsPanel } from './AtD890ScanLists.tsx';
import { projectAtD890Archive } from './debugProjections.ts';
import { archiveKey, MEMBER_EXPLANATION } from './viewerUtils.ts';
import type { DebugArchive } from './captureArchive.ts';

const NOT_CAPTURED = 'Not captured';
const DASH = '—';

const mhz = (hz: number) => (hz / 1e6).toFixed(5);

function formatAtD890Tone(tone: RadioTone): string {
  if (tone.kind === 'ctcss') return `${tone.hz} Hz`;
  if (tone.kind === 'dcs') return `D${String(tone.code).padStart(3, '0')}${tone.polarity ?? 'N'}`;
  return 'None';
}

const MODE_LABEL: Record<NonNullable<RadioChannelDto['mode']>, string> = {
  analog: 'Analogue',
  digital: 'Digital',
  'fixed-analog': 'A+D (TX A)',
  'fixed-digital': 'D+A (TX D)',
};

function flagsOf(channel: RadioChannelDto): string[] {
  return [
    channel.scanAdd ? 'Auto scan' : '',
    channel.rxOnly ? 'RX only' : '',
    channel.dmrOperatingMode === 'dmo-simplex' ? 'DMO' : '',
    channel.aprsReceive ? 'APRS RX' : '',
    channel.scanListId != null ? `Scan list ${channel.scanListId}` : '',
    channel.rxGroupIndex != null ? `RX group index ${channel.rxGroupIndex}` : '',
  ].filter(Boolean);
}

interface ChannelRow {
  id: string;
  slot: number;
  entry: AtD890ChannelEntry;
  channel?: RadioChannelDto;
  /** The complete identity text: sorted, searched and shown. */
  label: string;
  note?: string;
}

function channelRow(entry: AtD890ChannelEntry): ChannelRow {
  const base = { id: `channel-${entry.slot}`, slot: entry.slot, entry };
  const state = entry.state;
  if (state.kind === 'decoded')
    return { ...base, channel: state.channel, label: state.channel.wireName || '(unnamed)' };
  if (state.kind === 'not-captured') {
    const missing = [!state.primary && 'first half', !state.secondary && 'second half'].filter(
      Boolean,
    );
    return {
      ...base,
      label: NOT_CAPTURED,
      note: `Occupied; ${missing.join(' and ')} not captured`,
    };
  }
  if (state.kind === 'empty-record')
    return {
      ...base,
      label: 'Empty record',
      note: 'Occupied in the bitmap, but the captured record has no RX frequency',
    };
  return { ...base, label: 'Unreadable record', note: state.reason };
}

function cell(row: ChannelRow, value: (c: RadioChannelDto) => string | number | undefined) {
  if (!row.channel) return DASH;
  return value(row.channel) ?? DASH;
}

function channelColumns(
  bank: AtD890BankInventory,
  bankBySlot: ReadonlyMap<number, AtD890BankEntry>,
): DataTableColumn<ChannelRow>[] {
  return [
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
      key: 'identity',
      header: 'Identity',
      width: 'minmax(14rem, 2fr)',
      sortable: true,
      sortValue: (r) => r.label,
      render: (r) => (
        <>
          <strong>{r.label}</strong>
          {r.note && <Text size="xs">{r.note}</Text>}
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
      key: 'bw',
      header: 'Bandwidth',
      width: '6rem',
      render: (r) => cell(r, (c) => c.bandwidth),
    },
    {
      key: 'power',
      header: 'Power',
      width: '5rem',
      render: (r) => cell(r, (c) => (c.powerPercent == null ? 'Default' : `${c.powerPercent}%`)),
    },
    {
      key: 'mode',
      header: 'Mode',
      width: '7rem',
      sortable: true,
      sortValue: (r) => r.channel?.mode ?? null,
      render: (r) => cell(r, (c) => (c.mode ? MODE_LABEL[c.mode] : undefined)),
    },
    {
      key: 'cc',
      header: 'CC',
      width: '3.5rem',
      render: (r) => cell(r, (c) => (c.mode?.includes('digital') ? c.colorCode : undefined)),
    },
    {
      key: 'ts',
      header: 'TS',
      width: '3.5rem',
      render: (r) => cell(r, (c) => (c.mode?.includes('digital') ? c.timeslot : undefined)),
    },
    {
      key: 'contact',
      header: 'Contact ref',
      width: 'minmax(10rem, 1.5fr)',
      render: (r) =>
        cell(r, (c) =>
          c.txContactId != null
            ? describeBankReference(resolveAtD890BankSlot(bank, c.txContactId, bankBySlot))
            : undefined,
        ),
    },
    {
      key: 'rxTone',
      header: 'RX tone',
      width: '6rem',
      render: (r) => cell(r, (c) => formatAtD890Tone(c.rxTone)),
    },
    {
      key: 'txTone',
      header: 'TX tone',
      width: '6rem',
      render: (r) => cell(r, (c) => formatAtD890Tone(c.txTone)),
    },
    {
      key: 'flags',
      header: 'Flags',
      width: 'minmax(10rem, 1.5fr)',
      render: (r) => cell(r, (c) => flagsOf(c).join(', ') || undefined),
    },
  ];
}

function ChannelsPanel({
  channels,
  bank,
}: {
  channels: ReturnType<typeof projectAtD890Memory>['channels'];
  bank: AtD890BankInventory;
}) {
  const columns = useMemo(() => channelColumns(bank, indexBank(bank)), [bank]);
  const rows = useMemo(() => channels.entries.map(channelRow), [channels]);
  if (channels.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {AT_D890UV_CHANNELS_UNAVAILABLE}
      </Alert>
    );
  return (
    <Stack gap="sm">
      {channels.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title={AT_D890UV_BITMAP_BITS_TITLE}>
          {atD890ChannelBitsText(channels.outOfRangeBits, channels.capacity)}
        </Alert>
      )}
      <MemoryCategoryPanel
        summary={atD890ChannelSummary(channels.occupied, channels.capacity, channels.decoded)}
        caveat={atD890ChannelCaveat(channels.capacity)}
        searchPlaceholder="Search channels"
        caption="AT-D890UV memory channels"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) =>
          [
            r.slot,
            String(r.slot).padStart(3, '0'),
            r.label,
            r.channel ? `${mhz(r.channel.rxHz)} ${mhz(r.channel.txHz)}` : '',
          ].join(' ')
        }
        defaultSort={{ key: 'slot', direction: 'asc' }}
        stickyFirstColumn
        mobileIdentity={(r) => (
          <span>
            {r.slot} · <strong>{r.label}</strong>
          </span>
        )}
        mobileIdentityLabel="Slot · identity"
        emptyMessage={AT_D890UV_CHANNELS_EMPTY}
      />
    </Stack>
  );
}

interface MemberRow {
  id: string;
  member: AtD890ZoneMember;
}

const MEMBER_COLUMNS: DataTableColumn<MemberRow>[] = [
  { key: 'position', header: 'Order', width: '4.5rem', render: (r) => r.member.position },
  {
    key: 'slot',
    header: 'Channel slot',
    width: '6.5rem',
    render: (r) => r.member.slot ?? `Index ${r.member.rawIndex}`,
  },
  {
    key: 'identity',
    header: 'Identity',
    width: 'minmax(14rem, 2fr)',
    render: (r) =>
      r.member.channel ? <strong>{r.member.channel.wireName || '(unnamed)'}</strong> : DASH,
  },
  {
    key: 'rx',
    header: 'RX MHz',
    width: '6.5rem',
    render: (r) => (r.member.channel ? mhz(r.member.channel.rxHz) : DASH),
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
  entry: AtD890ZoneEntry;
  label: string;
  memberCount: number | null;
}

function zoneRow(entry: AtD890ZoneEntry): ZoneRow {
  const label =
    entry.name.status === 'not-captured' ? NOT_CAPTURED : entry.name.text || '(unnamed)';
  return {
    id: `zone-${entry.slot}`,
    slot: entry.slot,
    entry,
    label,
    memberCount: entry.members.status === 'captured' ? entry.members.list.length : null,
  };
}

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
    render: (r) => (r.memberCount == null ? NOT_CAPTURED : r.memberCount),
  },
];

function ZoneMembers({ zone }: { zone: AtD890ZoneEntry }) {
  return (
    <Stack gap="xs" aria-label={`Zone ${zone.slot} members`} role="region">
      <Title order={4}>
        Zone {zone.slot} ·{' '}
        {zone.name.status === 'captured'
          ? zone.name.text || '(unnamed)'
          : `Name ${NOT_CAPTURED.toLowerCase()}`}
      </Title>
      {zone.members.status === 'not-captured' ? (
        <Alert color="yellow" title={NOT_CAPTURED}>
          {AT_D890UV_ZONE_MEMBERS_NOT_CAPTURED}
        </Alert>
      ) : (
        <>
          {zone.members.overCapacity && (
            <Alert color="yellow" title={AT_D890UV_ZONE_OVER_CAPACITY_TITLE}>
              {atD890ZoneOverCapacityText(AT_D890UV_LIMITS.ZONE_MEMBERS_MAX)}
            </Alert>
          )}
          <DataTable
            caption={`Zone ${zone.slot} members`}
            variant="embedded"
            columns={MEMBER_COLUMNS}
            rows={zone.members.list.map((member) => ({
              id: `member-${member.position}`,
              member,
            }))}
            getRowId={(r) => r.id}
            emptyMessage="This zone has no members."
          />
        </>
      )}
    </Stack>
  );
}

function ZonesPanel({ zones }: { zones: ReturnType<typeof projectAtD890Memory>['zones'] }) {
  const rows = useMemo(() => zones.entries.map(zoneRow), [zones]);
  if (zones.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {AT_D890UV_ZONES_UNAVAILABLE}
      </Alert>
    );
  const namesDecoded = zones.entries.filter((z) => z.name.status === 'captured').length;
  const membersDecoded = zones.entries.filter((z) => z.members.status === 'captured').length;
  return (
    <Stack gap="sm">
      {zones.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title={AT_D890UV_ZONE_BITS_TITLE}>
          {atD890ZoneBitsText(zones.outOfRangeBits, zones.capacity)}
        </Alert>
      )}
      <MemoryCategoryPanel
        summary={atD890ZoneSummary(zones.occupied, zones.capacity, namesDecoded, membersDecoded)}
        caveat={AT_D890UV_ZONE_CAVEAT}
        searchPlaceholder="Search zones"
        caption="AT-D890UV zones"
        columns={zoneColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.slot} ${r.label}`}
        defaultSort={{ key: 'slot', direction: 'asc' }}
        details={(r) => <ZoneMembers zone={r.entry} />}
        emptyMessage={AT_D890UV_ZONES_EMPTY}
      />
    </Stack>
  );
}

/** Read-only AT-D890UV Memory viewer. Replacing the archive resets rows, references and selection. */
export function AtD890Memory({ archive }: { archive?: DebugArchive }) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert title="No capture">Open or read a capture to inspect its memory.</Alert>
      </Stack>
    );
  return <AtD890MemoryLoaded key={archiveKey(archive)} archive={archive} />;
}

function AtD890MemoryLoaded({ archive }: { archive: DebugArchive }) {
  const projection = projectAtD890Archive(archive);
  if (!projection)
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert color="red" title="Not an AT-D890UV capture">
          This archive is for {archive.manifest.radioModelId}; nothing is decoded.
        </Alert>
      </Stack>
    );
  const { capture } = projection;
  return (
    <Stack>
      <Title order={3}>Memory</Title>
      <Text size="sm" c="dimmed">
        {AT_D890UV_MEMORY_INTRO}
      </Text>
      <Text size="sm">
        {atD890CaptureSummary(
          capture.accepted.length,
          capture.excluded.vital,
          capture.excluded.unclassified,
        )}
      </Text>
      {capture.refused.length > 0 && (
        <Alert color="yellow" title={atD890RefusedTitle(capture.refused.length)}>
          {capture.refused.map((r) => (
            <Text size="sm" key={r.id}>
              {r.id}: {r.reason}
            </Text>
          ))}
        </Alert>
      )}
      <MemoryCategories
        storageKey="debug-memory-category:atd890"
        categories={[
          {
            value: 'channels',
            label: 'Channels',
            count: projection.channels.entries.length,
            render: () => <ChannelsPanel channels={projection.channels} bank={projection.bank} />,
          },
          {
            value: 'zones',
            label: 'Zones',
            render: () => <ZonesPanel zones={projection.zones} />,
          },
          {
            value: 'contacts',
            label: 'Contacts',
            render: () => <ContactsPanel projection={projection} />,
          },
          {
            value: 'talk-groups',
            label: 'Talk groups',
            render: () => <TalkGroupsPanel projection={projection} />,
          },
          {
            value: 'rx-groups',
            label: 'RX groups',
            render: () => <RxGroupsPanel projection={projection} />,
          },
          {
            value: 'scan-lists',
            label: 'Scan lists',
            render: () => <ScanListsPanel projection={projection} />,
          },
        ]}
      />
    </Stack>
  );
}
