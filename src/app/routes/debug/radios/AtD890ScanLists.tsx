import { Alert, Stack, Text, Title } from '@mantine/core';
import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '@app/components/v2/index.ts';
import { MemoryCategoryPanel } from '@app/components/debug/index.ts';
import {
  AT_D890UV_SCAN_EMPTY,
  AT_D890UV_SCAN_UNAVAILABLE,
  atD890ScanBitsText,
  atD890ScanCaveat,
  atD890ScanSummary,
} from '@integrations/radio-io/radios/at-d890uv/debugMemoryText.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { AtD890MemoryProjection } from '@integrations/radio-io/radios/at-d890uv/debugMemory.ts';
import {
  type AtD890ScanListEntry,
  type AtD890ScanMember,
  type AtD890ScanPriority,
} from '@integrations/radio-io/radios/at-d890uv/debugMemorySettings.ts';

import { MEMBER_EXPLANATION } from './viewerUtils.ts';

const NOT_CAPTURED = 'Not captured';
const DASH = '—';
const mhz = (hz: number) => (hz / 1e6).toFixed(5);

// ---------------------------------------------------------------------------
// Scan lists
// ---------------------------------------------------------------------------

/** A channel is identified by its single name field (it may carry a callsign); callsign is not separate. */
function memberIdentity(m: AtD890ScanMember): string {
  return m.channel ? m.channel.wireName || '(unnamed)' : DASH;
}

function describePriority(p: AtD890ScanPriority): string {
  if (p.kind === 'off') return 'Off';
  if (p.kind === 'current') return 'Current Channel';
  const m = p.member;
  const where = `Channel slot ${p.word}`;
  return m.channel
    ? `${where} · ${m.channel.wireName || '(unnamed)'}`
    : `${where} · ${MEMBER_EXPLANATION[m.status]}`;
}

interface ScanRow {
  id: string;
  slot: number;
  entry: AtD890ScanListEntry;
  label: string;
  memberCount: number | null;
  priorityText: string;
  /** Identity text of every member, so search covers them. */
  memberText: string;
}

function scanRow(entry: AtD890ScanListEntry): ScanRow {
  const members = entry.members.status === 'captured' ? entry.members.list : [];
  return {
    id: `scan-${entry.slot}`,
    slot: entry.slot,
    entry,
    label: entry.name.status === 'not-captured' ? NOT_CAPTURED : entry.name.text || '(unnamed)',
    memberCount: entry.members.status === 'captured' ? entry.members.list.length : null,
    priorityText:
      entry.priority.status === 'captured'
        ? `${entry.priority.select.label ?? `Unknown (${entry.priority.select.raw})`}`
        : NOT_CAPTURED,
    memberText: members.map(memberIdentity).join(' '),
  };
}

const scanColumns: DataTableColumn<ScanRow>[] = [
  {
    key: 'slot',
    header: 'Scan list slot',
    width: '7rem',
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
    width: '7rem',
    sortable: true,
    sortValue: (r) => r.memberCount,
    render: (r) => (r.memberCount == null ? NOT_CAPTURED : r.memberCount),
  },
  {
    key: 'priority',
    header: 'Priority select',
    width: 'minmax(10rem, 1.5fr)',
    render: (r) => r.priorityText,
  },
];

interface ScanMemberRow {
  id: string;
  member: AtD890ScanMember;
}

const scanMemberColumns: DataTableColumn<ScanMemberRow>[] = [
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
    render: (r) => (r.member.channel ? <strong>{memberIdentity(r.member)}</strong> : DASH),
  },
  {
    key: 'rx',
    header: 'RX MHz',
    width: '6.5rem',
    render: (r) => (r.member.channel ? mhz(r.member.channel.rxHz) : DASH),
  },
  {
    key: 'role',
    header: 'Priority role',
    width: '8rem',
    render: (r) =>
      r.member.roles.length ? r.member.roles.map((n) => `Priority ${n}`).join(', ') : DASH,
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(16rem, 2fr)',
    render: (r) => MEMBER_EXPLANATION[r.member.status],
  },
];

function ScanListDetails({ entry }: { entry: AtD890ScanListEntry }) {
  return (
    <Stack gap="xs" aria-label={`Scan list ${entry.slot} details`} role="region">
      <Title order={4}>
        Scan list {entry.slot} ·{' '}
        {entry.name.status === 'captured' ? entry.name.text || '(unnamed)' : `Name not captured`}
      </Title>
      {entry.priority.status === 'not-captured' ? (
        <Alert color="yellow" title={`Priority ${NOT_CAPTURED.toLowerCase()}`}>
          This list&apos;s priority bytes were not completely captured.
        </Alert>
      ) : (
        <Stack gap={2}>
          <Text size="sm">
            Priority select:{' '}
            {entry.priority.select.label ?? `Unknown value ${entry.priority.select.raw} (raw)`}
          </Text>
          <Text size="sm">Priority 1: {describePriority(entry.priority.first)}</Text>
          <Text size="sm">Priority 2: {describePriority(entry.priority.second)}</Text>
          <Text size="xs" c="dimmed">
            Priority channels are shown even when they are not members. A priority word is one-based
            (0 is Current Channel, 0xFFFF is Off); a member index is zero-based.
          </Text>
        </Stack>
      )}
      {entry.members.status === 'not-captured' ? (
        <Alert color="yellow" title={NOT_CAPTURED}>
          This list&apos;s member array was not completely captured.
        </Alert>
      ) : (
        <DataTable
          caption={`Scan list ${entry.slot} members`}
          variant="embedded"
          columns={scanMemberColumns}
          rows={entry.members.list.map((member) => ({ id: `member-${member.position}`, member }))}
          getRowId={(r) => r.id}
          emptyMessage="This scan list has no members."
        />
      )}
    </Stack>
  );
}

export function ScanListsPanel({ projection }: { projection: AtD890MemoryProjection }) {
  const lists = projection.scanLists;
  const rows = useMemo(() => lists.entries.map(scanRow), [lists]);
  if (lists.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {AT_D890UV_SCAN_UNAVAILABLE}
      </Alert>
    );
  return (
    <Stack gap="sm">
      {lists.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title="Bitmap bits beyond the scan list range">
          {atD890ScanBitsText(lists.outOfRangeBits, lists.capacity)}
        </Alert>
      )}
      <MemoryCategoryPanel
        summary={atD890ScanSummary(lists.occupied, lists.capacity, lists.decoded)}
        caveat={atD890ScanCaveat(AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX)}
        searchPlaceholder="Search scan lists"
        caption="AT-D890UV scan lists"
        columns={scanColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.slot} ${r.label} ${r.memberText} ${r.priorityText}`}
        defaultSort={{ key: 'slot', direction: 'asc' }}
        details={(r) => <ScanListDetails entry={r.entry} />}
        emptyMessage={AT_D890UV_SCAN_EMPTY}
      />
    </Stack>
  );
}
