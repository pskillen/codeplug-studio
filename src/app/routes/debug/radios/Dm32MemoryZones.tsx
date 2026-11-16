import { Alert, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
} from '@app/components/v2/index.ts';
import type { Dm32MemberStatus } from '@integrations/radio-io/radios/dm32uv/debugMemory.ts';
import type {
  Dm32ResolvedMember,
  Dm32ScanListEntry,
  Dm32ScanListInventory,
  Dm32ZoneEntry,
  Dm32ZoneInventory,
} from '@integrations/radio-io/radios/dm32uv/debugMemoryZones.ts';

const NOT_CAPTURED = 'Not captured';
const DASH = '—';

const count = (n: number) => n.toLocaleString('en-GB');
const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const matches = (query: string, ...haystack: string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

/** DM-32 member states. Texts are about the DM-32 channel slots, which have no occupancy bitmap. */
const DM32_MEMBER_EXPLANATION: Record<Dm32MemberStatus, string> = {
  resolved: 'Resolved',
  'out-of-range': 'Out of range: not a channel slot (slots are 1 to 4,000)',
  empty: 'Empty: that channel slot is erased or blank',
  'not-captured': 'Not captured: that channel record was not read',
  'inventory-not-captured': 'Cannot resolve: the channel inventory was not captured',
  unreadable: 'Unreadable: the channel record has an invalid frequency',
};

interface MemberRow {
  id: string;
  position: number;
  member: Dm32ResolvedMember;
}

const MEMBER_COLUMNS: DataTableColumn<MemberRow>[] = [
  { key: 'position', header: 'Order', width: '4.5rem', render: (r) => r.position },
  { key: 'slot', header: 'Channel slot', width: '6.5rem', render: (r) => r.member.slot },
  {
    key: 'identity',
    header: 'Identity',
    width: 'minmax(14rem, 2fr)',
    render: (r) => (r.member.label ? <strong>{r.member.label}</strong> : DASH),
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(16rem, 2fr)',
    render: (r) => DM32_MEMBER_EXPLANATION[r.member.status],
  },
];

function MemberTable({ caption, members }: { caption: string; members: Dm32ResolvedMember[] }) {
  return (
    <DataTable
      caption={caption}
      variant="embedded"
      columns={MEMBER_COLUMNS}
      rows={members.map((member, i) => ({ id: `member-${i}`, position: i + 1, member }))}
      getRowId={(r) => r.id}
      emptyMessage="This list has no named members."
    />
  );
}

const memberLabels = (members: Dm32ResolvedMember[]) =>
  members.map((m) => `${m.slot} ${m.label ?? ''}`);

interface ZoneRow {
  id: string;
  slot: number;
  entry: Dm32ZoneEntry;
  /** The complete name text: sorted, searched and shown. */
  label: string;
  memberCount: number | null;
}

function zoneRow(entry: Dm32ZoneEntry): ZoneRow {
  const s = entry.state;
  const base = { id: `zone-${entry.slot}`, slot: entry.slot, entry };
  if (s.kind === 'decoded')
    return {
      ...base,
      label: s.name || '(unnamed)',
      memberCount: s.memberCountValid ? s.members.length : null,
    };
  if (s.kind === 'vacant') return { ...base, label: 'Vacant record', memberCount: null };
  return { ...base, label: NOT_CAPTURED, memberCount: null };
}

const zoneColumns: DataTableColumn<ZoneRow>[] = [
  {
    key: 'slot',
    header: 'Zone',
    width: '5rem',
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
    render: (r) => (
      <>
        <strong>{r.label}</strong>
        {r.entry.state.kind === 'not-captured' && <Text size="xs">{r.entry.state.reason}</Text>}
      </>
    ),
  },
  {
    key: 'members',
    header: 'Members',
    width: '9rem',
    sortable: true,
    sortValue: (r) => r.memberCount,
    render: (r) => {
      const s = r.entry.state;
      if (s.kind !== 'decoded') return DASH;
      return s.memberCountValid
        ? s.members.length
        : `Invalid count (raw ${s.memberCountRaw} = 0x${hex(s.memberCountRaw)})`;
    },
  },
];

export function ZonesPanel({ zones }: { zones: Dm32ZoneInventory }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const [selected, setSelected] = useState<number>();
  const rows = useMemo(() => zones.entries.map(zoneRow), [zones]);
  if (zones.status !== 'captured')
    return (
      <Alert
        title={zones.status === 'not-captured' ? NOT_CAPTURED : 'Page order not established'}
        color="yellow"
      >
        {zones.reason} This does not mean the radio has no zones.
      </Alert>
    );
  const shown = rows.filter((r) =>
    matches(
      query,
      String(r.slot),
      r.label,
      ...(r.entry.state.kind === 'decoded' ? memberLabels(r.entry.state.members) : []),
    ),
  );
  const zone = zones.entries.find((z) => z.slot === selected);
  const header = zones.header!;
  return (
    <Stack gap="sm">
      <Text>
        The radio states {count(header.count)} zones · {count(zones.entries.length)} listed of{' '}
        {count(zones.capacity)} hardware zones · decoded {count(zones.decoded)} · vacant{' '}
        {count(zones.vacant)} · not captured {count(zones.notCaptured)}
      </Text>
      <Text size="sm" c="dimmed">
        Zones are in radio order and each name is the radio&apos;s single name field, shown
        complete; separate callsign and name data is unavailable. Members are channel slot numbers
        shown in radio order, duplicates included, resolved against the channels of this capture. A
        record missing from the capture is not captured, never an unused zone. The meaning of the
        stored zone count is unverified. Header bytes (raw): count {header.count}, channel A{' '}
        {header.channelA}, channel B {header.channelB}, zone A {header.zoneA}, zone B {header.zoneB}
        .
      </Text>
      {zones.excess > 0 && (
        <Alert color="yellow" title="Count above hardware capacity">
          The stored count claims {count(zones.excess)} zones above the {count(zones.capacity)}{' '}
          hardware zones; they are not listed.
        </Alert>
      )}
      <DataTable
        caption="DM-32UV memory zones"
        columns={zoneColumns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search zones' }}
        sort={sort}
        onSortChange={setSort}
        onRowActivate={(r) => setSelected(r.slot)}
        emptyMessage="The zone count was captured and the radio states no zones."
        filteredEmptyMessage={`No zones match “${query.trim()}”.`}
      />
      {zone ? (
        <Stack gap="xs" aria-label={`Zone ${zone.slot} members`} role="region">
          <Title order={4}>
            Zone {zone.slot} ·{' '}
            {zone.state.kind === 'decoded' ? zone.state.name || '(unnamed)' : zoneRow(zone).label}
          </Title>
          {zone.state.kind !== 'decoded' ? (
            <Alert
              color="yellow"
              title={zone.state.kind === 'vacant' ? 'Vacant record' : NOT_CAPTURED}
            >
              {zone.state.kind === 'vacant'
                ? 'This record has no name, so it holds no zone.'
                : zone.state.reason}
            </Alert>
          ) : !zone.state.memberCountValid ? (
            <Alert color="yellow" title="Invalid member count">
              The member count byte is {zone.state.memberCountRaw} (0x
              {hex(zone.state.memberCountRaw)}
              ), above the 64-member maximum, so no members are read.
            </Alert>
          ) : (
            <MemberTable caption={`Zone ${zone.slot} members`} members={zone.state.members} />
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

interface ScanRow {
  id: string;
  slot: number;
  entry: Dm32ScanListEntry;
  label: string;
  memberCount: number | null;
}

function scanRow(entry: Dm32ScanListEntry): ScanRow {
  const s = entry.state;
  const base = { id: `scan-${entry.slot}`, slot: entry.slot, entry };
  if (s.kind === 'decoded')
    return { ...base, label: s.name || '(unnamed)', memberCount: s.namedCount ?? null };
  return { ...base, label: 'Vacant record', memberCount: null };
}

const scanColumns: DataTableColumn<ScanRow>[] = [
  {
    key: 'slot',
    header: 'List',
    width: '5rem',
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
    header: 'Named members',
    width: '10rem',
    sortable: true,
    sortValue: (r) => r.memberCount,
    render: (r) => {
      const s = r.entry.state;
      if (s.kind !== 'decoded') return DASH;
      return s.namedCount === undefined
        ? `Invalid count byte 0x${hex(s.memberCountRaw)}`
        : `${s.namedCount} (raw 0x${hex(s.memberCountRaw)})`;
    },
  },
];

export function ScanListsPanel({ scanLists }: { scanLists: Dm32ScanListInventory }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const [selected, setSelected] = useState<number>();
  const rows = useMemo(() => scanLists.entries.map(scanRow), [scanLists]);
  if (scanLists.status !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {scanLists.reason} This does not mean the radio has no scan lists.
      </Alert>
    );
  const shown = rows.filter((r) =>
    matches(
      query,
      String(r.slot),
      r.label,
      ...(r.entry.state.kind === 'decoded' ? memberLabels(r.entry.state.members) : []),
    ),
  );
  const list = scanLists.entries.find((l) => l.slot === selected);
  return (
    <Stack gap="sm">
      <Text>
        The radio states {count(scanLists.declaredCount ?? 0)} scan lists ·{' '}
        {count(scanLists.entries.length)} listed of {count(scanLists.capacity)} hardware lists ·
        decoded {count(scanLists.decoded)} · vacant {count(scanLists.vacant)}
      </Text>
      <Text size="sm" c="dimmed">
        Each name is the radio&apos;s single name field, shown complete; separate callsign and name
        data is unavailable. A non-empty list stores its named members plus one for the implicit
        current channel, so the raw byte is shown beside the named count. Members are channel slot
        numbers in radio order, resolved against the channels of this capture. Hang time, priority
        and designated TX are shown as raw hex only: their encodings are not established.
      </Text>
      {scanLists.excess > 0 && (
        <Alert color="yellow" title="Count above hardware capacity">
          The stored count claims {count(scanLists.excess)} lists above the{' '}
          {count(scanLists.capacity)} hardware lists; they are not listed.
        </Alert>
      )}
      <DataTable
        caption="DM-32UV memory scan lists"
        columns={scanColumns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search scan lists' }}
        sort={sort}
        onSortChange={setSort}
        onRowActivate={(r) => setSelected(r.slot)}
        emptyMessage="The scan-list page was captured and the radio states no scan lists."
        filteredEmptyMessage={`No scan lists match “${query.trim()}”.`}
      />
      {list ? (
        <Stack gap="xs" aria-label={`Scan list ${list.slot} members`} role="region">
          <Title order={4}>
            Scan list {list.slot} ·{' '}
            {list.state.kind === 'decoded' ? list.state.name || '(unnamed)' : 'Vacant record'}
          </Title>
          {list.state.kind !== 'decoded' ? (
            <Alert color="yellow" title="Vacant record">
              This record has no name, so it holds no scan list.
            </Alert>
          ) : (
            <>
              <Text size="sm">
                Raw bytes: +0x0C = {hex(list.state.raw.b0c)}, +0x0D (hang) ={' '}
                {hex(list.state.raw.b0d)}, +0x0E (priority) = {hex(list.state.raw.b0e)}, +0x11 /
                +0x12 (designated TX) = {hex(list.state.raw.b11)} {hex(list.state.raw.b12)}
              </Text>
              {list.state.namedCount === undefined ? (
                <Alert color="yellow" title="Invalid member count">
                  The member count byte is 0x{hex(list.state.memberCountRaw)}, above the 15 named
                  members plus one, so no members are read.
                </Alert>
              ) : (
                <MemberTable
                  caption={`Scan list ${list.slot} members`}
                  members={list.state.members}
                />
              )}
            </>
          )}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Select a scan list to see its members.
        </Text>
      )}
    </Stack>
  );
}
