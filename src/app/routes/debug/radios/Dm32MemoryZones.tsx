import { Alert, Stack, Text, Title } from '@mantine/core';
import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '@app/components/v2/index.ts';
import { MemoryCategoryPanel } from '@app/components/debug/index.ts';
import {
  DM32_SCAN_LIST_CAVEAT,
  DM32_SCAN_LISTS_EMPTY,
  DM32_SCAN_LISTS_UNAVAILABLE_NOTE,
  DM32_ZONES_EMPTY,
  DM32_ZONES_UNAVAILABLE_NOTE,
  dm32ScanListExcessText,
  dm32ScanListSummary,
  dm32ZoneCaveat,
  dm32ZoneExcessText,
  dm32ZoneSummary,
} from '@integrations/radio-io/radios/dm32uv/debugMemoryText.ts';
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

const hex = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');

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

function ZoneMembers({ zone }: { zone: Dm32ZoneEntry }) {
  return (
    <Stack gap="xs" aria-label={`Zone ${zone.slot} members`} role="region">
      <Title order={4}>
        Zone {zone.slot} ·{' '}
        {zone.state.kind === 'decoded' ? zone.state.name || '(unnamed)' : zoneRow(zone).label}
      </Title>
      {zone.state.kind !== 'decoded' ? (
        <Alert color="yellow" title={zone.state.kind === 'vacant' ? 'Vacant record' : NOT_CAPTURED}>
          {zone.state.kind === 'vacant'
            ? 'This record has no name, so it holds no zone.'
            : zone.state.reason}
        </Alert>
      ) : !zone.state.memberCountValid ? (
        <Alert color="yellow" title="Invalid member count">
          The member count byte is {zone.state.memberCountRaw} (0x{hex(zone.state.memberCountRaw)}
          ), above the 64-member maximum, so no members are read.
        </Alert>
      ) : (
        <MemberTable caption={`Zone ${zone.slot} members`} members={zone.state.members} />
      )}
    </Stack>
  );
}

export function ZonesPanel({ zones }: { zones: Dm32ZoneInventory }) {
  const rows = useMemo(() => zones.entries.map(zoneRow), [zones]);
  if (zones.status !== 'captured')
    return (
      <Alert
        title={zones.status === 'not-captured' ? NOT_CAPTURED : 'Page order not established'}
        color="yellow"
      >
        {zones.reason} {DM32_ZONES_UNAVAILABLE_NOTE}
      </Alert>
    );
  const header = zones.header!;
  return (
    <Stack gap="sm">
      {zones.excess > 0 && (
        <Alert color="yellow" title="Count above hardware capacity">
          {dm32ZoneExcessText(zones.excess, zones.capacity)}
        </Alert>
      )}
      <MemoryCategoryPanel
        summary={dm32ZoneSummary({
          declared: header.count,
          listed: zones.entries.length,
          capacity: zones.capacity,
          decoded: zones.decoded,
          vacant: zones.vacant,
          notCaptured: zones.notCaptured,
        })}
        caveat={dm32ZoneCaveat(header)}
        searchPlaceholder="Search zones"
        caption="DM-32UV memory zones"
        columns={zoneColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) =>
          [
            r.slot,
            r.label,
            ...(r.entry.state.kind === 'decoded' ? memberLabels(r.entry.state.members) : []),
          ].join(' ')
        }
        defaultSort={{ key: 'slot', direction: 'asc' }}
        details={(r) => <ZoneMembers zone={r.entry} />}
        emptyMessage={DM32_ZONES_EMPTY}
      />
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

function ScanListMembers({ list }: { list: Dm32ScanListEntry }) {
  return (
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
            Raw bytes: +0x0C = {hex(list.state.raw.b0c)}, +0x0D (hang) = {hex(list.state.raw.b0d)},
            +0x0E (priority) = {hex(list.state.raw.b0e)}, +0x11 / +0x12 (designated TX) ={' '}
            {hex(list.state.raw.b11)} {hex(list.state.raw.b12)}
          </Text>
          {list.state.namedCount === undefined ? (
            <Alert color="yellow" title="Invalid member count">
              The member count byte is 0x{hex(list.state.memberCountRaw)}, above the 15 named
              members plus one, so no members are read.
            </Alert>
          ) : (
            <MemberTable caption={`Scan list ${list.slot} members`} members={list.state.members} />
          )}
        </>
      )}
    </Stack>
  );
}

export function ScanListsPanel({ scanLists }: { scanLists: Dm32ScanListInventory }) {
  const rows = useMemo(() => scanLists.entries.map(scanRow), [scanLists]);
  if (scanLists.status !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {scanLists.reason} {DM32_SCAN_LISTS_UNAVAILABLE_NOTE}
      </Alert>
    );
  return (
    <Stack gap="sm">
      {scanLists.excess > 0 && (
        <Alert color="yellow" title="Count above hardware capacity">
          {dm32ScanListExcessText(scanLists.excess, scanLists.capacity)}
        </Alert>
      )}
      <MemoryCategoryPanel
        summary={dm32ScanListSummary({
          declared: scanLists.declaredCount ?? 0,
          listed: scanLists.entries.length,
          capacity: scanLists.capacity,
          decoded: scanLists.decoded,
          vacant: scanLists.vacant,
        })}
        caveat={DM32_SCAN_LIST_CAVEAT}
        searchPlaceholder="Search scan lists"
        caption="DM-32UV memory scan lists"
        columns={scanColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) =>
          [
            r.slot,
            r.label,
            ...(r.entry.state.kind === 'decoded' ? memberLabels(r.entry.state.members) : []),
          ].join(' ')
        }
        defaultSort={{ key: 'slot', direction: 'asc' }}
        details={(r) => <ScanListMembers list={r.entry} />}
        emptyMessage={DM32_SCAN_LISTS_EMPTY}
      />
    </Stack>
  );
}
