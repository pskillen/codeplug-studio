import { Alert, Stack, Tabs, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
} from '@app/components/v2/index.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { RadioChannelDto, RadioTone } from '@integrations/radio-io/radioChannelDto.ts';
import {
  projectAtD890Memory,
  type AtD890ChannelEntry,
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
import { MEMBER_EXPLANATION, ScanListsPanel, SettingsPanel } from './AtD890MemorySettings.tsx';
import type { DebugArchive } from './captureArchive.ts';

const MODEL_ID = 'AT-D890UV';
const NOT_CAPTURED = 'Not captured';
const DASH = '—';

const count = (n: number) => n.toLocaleString('en-GB');
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

const matches = (query: string, ...haystack: string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

function ChannelsPanel({
  channels,
  bank,
}: {
  channels: ReturnType<typeof projectAtD890Memory>['channels'];
  bank: AtD890BankInventory;
}) {
  const columns = useMemo(() => channelColumns(bank, indexBank(bank)), [bank]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const rows = useMemo(() => channels.entries.map(channelRow), [channels]);
  if (channels.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        The channel occupancy bitmap was not completely captured, so no channel list can be shown.
        This does not mean the radio has no channels.
      </Alert>
    );
  const shown = rows.filter((r) =>
    matches(
      query,
      String(r.slot),
      String(r.slot).padStart(3, '0'),
      r.label,
      r.channel ? `${mhz(r.channel.rxHz)} ${mhz(r.channel.txHz)}` : '',
    ),
  );
  return (
    <Stack gap="sm">
      <Text>
        Occupied {count(channels.occupied)} of {count(channels.capacity)} channel slots · decoded{' '}
        {count(channels.decoded)} of {count(channels.occupied)} occupied
      </Text>
      <Text size="sm" c="dimmed">
        Hardware capacity is {count(channels.capacity)} slots. Slots without a record in this
        capture are not listed, and a missing capture does not mean a slot is unused. Each identity
        is the radio&apos;s single name field, shown complete including any callsign; separate
        callsign and name data is unavailable in this capture.
      </Text>
      {channels.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title="Bitmap bits beyond the slot range">
          Bits {channels.outOfRangeBits.join(', ')} are set above the {count(channels.capacity)}{' '}
          hardware slots and are not listed.
        </Alert>
      )}
      <DataTable
        caption="AT-D890UV memory channels"
        columns={columns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search channels' }}
        sort={sort}
        onSortChange={setSort}
        stickyFirstColumn
        mobileIdentity={(r) => (
          <span>
            {r.slot} · <strong>{r.label}</strong>
          </span>
        )}
        mobileIdentityLabel="Slot · identity"
        emptyMessage="The channel bitmap is captured and no channel slot is occupied."
        filteredEmptyMessage={`No channels match “${query.trim()}”.`}
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

function ZonesPanel({ zones }: { zones: ReturnType<typeof projectAtD890Memory>['zones'] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const [selectedSlot, setSelectedSlot] = useState<number>();
  const rows = useMemo(() => zones.entries.map(zoneRow), [zones]);
  if (zones.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        The zone occupancy bitmap was not completely captured, so no zone list can be shown. This
        does not mean the radio has no zones.
      </Alert>
    );
  const selected = zones.entries.find((z) => z.slot === selectedSlot);
  const shown = rows.filter((r) => matches(query, String(r.slot), r.label));
  const namesDecoded = zones.entries.filter((z) => z.name.status === 'captured').length;
  const membersDecoded = zones.entries.filter((z) => z.members.status === 'captured').length;
  return (
    <Stack gap="sm">
      <Text>
        Occupied {count(zones.occupied)} of {count(zones.capacity)} zone slots · names decoded{' '}
        {count(namesDecoded)} · member lists decoded {count(membersDecoded)}
      </Text>
      <Text size="sm" c="dimmed">
        Members are shown in radio order, duplicates included. A member index is zero-based and
        resolves to channel slot index + 1. The zone A and B channel tables select a channel within
        a zone and are not shown as member lists.
      </Text>
      {zones.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title="Bitmap bits beyond the zone range">
          Bits {zones.outOfRangeBits.join(', ')} are set above the {count(zones.capacity)} hardware
          zones and are not listed.
        </Alert>
      )}
      <DataTable
        caption="AT-D890UV zones"
        columns={zoneColumns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search zones' }}
        sort={sort}
        onSortChange={setSort}
        onRowActivate={(r) => setSelectedSlot(r.slot)}
        emptyMessage="The zone bitmap is captured and no zone slot is occupied."
        filteredEmptyMessage={`No zones match “${query.trim()}”.`}
      />
      {selected ? (
        <Stack gap="xs" aria-label={`Zone ${selected.slot} members`} role="region">
          <Title order={4}>
            Zone {selected.slot} ·{' '}
            {selected.name.status === 'captured'
              ? selected.name.text || '(unnamed)'
              : `Name ${NOT_CAPTURED.toLowerCase()}`}
          </Title>
          {selected.members.status === 'not-captured' ? (
            <Alert color="yellow" title={NOT_CAPTURED}>
              This zone&apos;s member list was not completely captured.
            </Alert>
          ) : (
            <>
              {selected.members.overCapacity && (
                <Alert color="yellow" title="More members than the hardware allows">
                  The list holds more than {AT_D890UV_LIMITS.ZONE_MEMBERS_MAX} members.
                </Alert>
              )}
              <DataTable
                caption={`Zone ${selected.slot} members`}
                variant="embedded"
                columns={MEMBER_COLUMNS}
                rows={selected.members.list.map((member) => ({
                  id: `member-${member.position}`,
                  member,
                }))}
                getRowId={(r) => r.id}
                emptyMessage="This zone has no members."
              />
            </>
          )}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Select a zone to see its members.
        </Text>
      )}
    </Stack>
  );
}

const archiveIds = new WeakMap<DebugArchive, number>();
let nextArchiveId = 1;
const archiveKey = (archive: DebugArchive) => {
  let id = archiveIds.get(archive);
  if (id === undefined) archiveIds.set(archive, (id = nextArchiveId++));
  return id;
};

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
  const projection = useMemo(
    () =>
      archive.manifest.radioModelId === MODEL_ID
        ? projectAtD890Memory(archive.manifest.regions, archive.regions)
        : undefined,
    [archive],
  );
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
        Read-only inventory decoded from captured bytes · radio slot order preserved. Nothing is
        imported into a library or build.
      </Text>
      <Text size="sm">
        {capture.accepted.length} sparse configuration entries accepted · {capture.excluded.vital}{' '}
        vital and {capture.excluded.unclassified} unclassified entries excluded
      </Text>
      {capture.refused.length > 0 && (
        <Alert color="yellow" title={`${capture.refused.length} sparse entries refused`}>
          {capture.refused.map((r) => (
            <Text size="sm" key={r.id}>
              {r.id}: {r.reason}
            </Text>
          ))}
        </Alert>
      )}
      <Tabs defaultValue="channels" keepMounted={false}>
        <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          <Tabs.Tab value="channels">Channels</Tabs.Tab>
          <Tabs.Tab value="zones">Zones</Tabs.Tab>
          <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
          <Tabs.Tab value="talk-groups">Talk groups</Tabs.Tab>
          <Tabs.Tab value="rx-groups">RX groups</Tabs.Tab>
          <Tabs.Tab value="scan-lists">Scan lists</Tabs.Tab>
          <Tabs.Tab value="settings">Settings</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="channels" pt="md">
          <ChannelsPanel channels={projection.channels} bank={projection.bank} />
        </Tabs.Panel>
        <Tabs.Panel value="zones" pt="md">
          <ZonesPanel zones={projection.zones} />
        </Tabs.Panel>
        <Tabs.Panel value="contacts" pt="md">
          <ContactsPanel projection={projection} />
        </Tabs.Panel>
        <Tabs.Panel value="talk-groups" pt="md">
          <TalkGroupsPanel projection={projection} />
        </Tabs.Panel>
        <Tabs.Panel value="rx-groups" pt="md">
          <RxGroupsPanel projection={projection} />
        </Tabs.Panel>
        <Tabs.Panel value="scan-lists" pt="md">
          <ScanListsPanel projection={projection} />
        </Tabs.Panel>
        <Tabs.Panel value="settings" pt="md">
          <SettingsPanel projection={projection} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
