import { Alert, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
} from '@app/components/v2/index.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { AtD890MemoryProjection } from '@integrations/radio-io/radios/at-d890uv/debugMemory.ts';
import type {
  AtD890BankEntry,
  AtD890BankReference,
  AtD890BankReferenceStatus,
  AtD890BankRecord,
  AtD890RxGroupEntry,
  AtD890RxMember,
} from '@integrations/radio-io/radios/at-d890uv/debugMemoryContacts.ts';

const NOT_CAPTURED = 'Not captured';
const DASH = '—';
const count = (n: number) => n.toLocaleString('en-GB');
const matches = (query: string, ...haystack: string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

const CALL_TYPE_LABEL = ['Private', 'Group', 'All call'] as const;

/** Callsign first, then name, as everywhere a callsign and name both exist. */
export function bankIdentity(record: Pick<AtD890BankRecord, 'callsign' | 'name'>): string {
  return [record.callsign, record.name].filter(Boolean).join(' ') || '(unnamed)';
}

export const BANK_REFERENCE_EXPLANATION: Record<AtD890BankReferenceStatus, string> = {
  resolved: 'Resolved',
  'out-of-range': 'Out of range: beyond the shared bank slots',
  absent: 'Absent: the bank bitmap does not mark this slot occupied',
  'not-captured': 'Not captured: the slot is occupied but its record is incomplete',
  'inventory-not-captured': 'Cannot resolve: the contact bank bitmap was not captured',
  unreadable: 'Unreadable: the captured record is unclassified',
};

/** One short cell text for a bank reference, e.g. a channel's TX contact. */
export function describeBankReference(ref: AtD890BankReference): string {
  if (ref.status === 'resolved' && ref.record)
    return `#${ref.slot} ${bankIdentity(ref.record)} (${CALL_TYPE_LABEL[ref.record.callType]})`;
  const slot = ref.slot == null ? '' : `#${ref.slot} `;
  return `${slot}${BANK_REFERENCE_EXPLANATION[ref.status]}`;
}

interface BankRow {
  id: string;
  slot: number;
  entry: AtD890BankEntry;
  record?: AtD890BankRecord;
  /** The complete identity text: sorted, searched and shown. */
  label: string;
  note?: string;
  typeText: string;
  usedBy: string;
}

function usageText(slot: number, references: AtD890MemoryProjection['references']): string {
  const used = references.bySlot.get(slot);
  const parts: string[] = [];
  if (used?.channels.length)
    parts.push(`Channels: ${used.channels.map((c) => `${c.slot} ${c.label}`).join(', ')}`);
  if (used?.rxGroups.length)
    parts.push(
      `RX groups: ${used.rxGroups.map((g) => `${g.slot}${g.name ? ` ${g.name}` : ''}`).join(', ')}`,
    );
  if (parts.length) return parts.join(' · ');
  return references.channelsComplete && references.rxGroupsComplete
    ? 'None in captured channels or RX groups'
    : 'None found; channel or RX group coverage incomplete';
}

function bankRow(
  entry: AtD890BankEntry,
  references: AtD890MemoryProjection['references'],
): BankRow {
  const base = {
    id: `bank-${entry.slot}`,
    slot: entry.slot,
    entry,
    usedBy: usageText(entry.slot, references),
  };
  const s = entry.state;
  if (s.kind === 'decoded')
    return {
      ...base,
      record: s.record,
      label: bankIdentity(s.record),
      typeText: CALL_TYPE_LABEL[s.record.callType],
    };
  if (s.kind === 'not-captured')
    return {
      ...base,
      label: NOT_CAPTURED,
      typeText: 'Unclassified',
      note: 'Occupied; the record was not completely captured, so its category is unknown',
    };
  if (s.kind === 'unknown-type')
    return {
      ...base,
      label: s.name || '(unnamed)',
      typeText: `Unclassified (type ${s.rawCallType})`,
      note: `Unknown call type ${s.rawCallType}`,
    };
  return {
    ...base,
    label: s.name || '(unnamed)',
    typeText: `Unclassified (type ${s.rawCallType})`,
    note: s.reason,
  };
}

function bankColumns(showUsage: boolean): DataTableColumn<BankRow>[] {
  const columns: DataTableColumn<BankRow>[] = [
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
      key: 'dmrId',
      header: 'DMR ID',
      width: '6.5rem',
      sortable: true,
      sortValue: (r) => r.record?.dmrId ?? null,
      render: (r) => r.record?.dmrId ?? DASH,
    },
    {
      key: 'type',
      header: 'Type',
      width: '9rem',
      sortable: true,
      sortValue: (r) => r.typeText,
      render: (r) => r.typeText,
    },
    {
      key: 'city',
      header: 'City',
      width: 'minmax(8rem, 1fr)',
      sortable: true,
      sortValue: (r) => r.record?.city ?? null,
      render: (r) => r.record?.city || DASH,
    },
  ];
  if (showUsage)
    columns.push({
      key: 'usedBy',
      header: 'Referenced by',
      width: 'minmax(16rem, 2fr)',
      render: (r) => r.usedBy,
    });
  return columns;
}

const BANK_EXPLANATION = (
  <>
    Contacts and talk groups share one bank of {count(AT_D890UV_LIMITS.TALK_GROUPS_MAX)} slots on
    the radio: private-call records are contacts, group and all-call records are talk groups. Slots
    keep their one-based radio numbers whichever tab filters them. The separate DMR ID database is
    outside this capture and is not decoded.
  </>
);

function BankPanel({
  projection,
  kind,
}: {
  projection: AtD890MemoryProjection;
  kind: 'contacts' | 'talk-groups';
}) {
  const { bank, references } = projection;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const isContacts = kind === 'contacts';
  const noun = isContacts ? 'contacts' : 'talk groups';
  const columns = useMemo(() => bankColumns(!isContacts), [isContacts]);
  const rows = useMemo(
    () =>
      bank.entries
        .filter((e) =>
          e.state.kind !== 'decoded'
            ? true
            : isContacts
              ? e.state.record.callType === 0
              : e.state.record.callType !== 0,
        )
        .map((e) => bankRow(e, references)),
    [bank, references, isContacts],
  );
  if (bank.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        The contact bank occupancy bitmap was not completely captured, so no {noun} can be shown.
        This does not mean the radio has none.
      </Alert>
    );
  const unclassified = bank.entries.filter((e) => e.state.kind !== 'decoded').length;
  const mine = rows.length - unclassified;
  const shown = rows.filter((r) =>
    matches(
      query,
      String(r.slot),
      String(r.slot).padStart(4, '0'),
      r.label,
      r.typeText,
      r.record ? String(r.record.dmrId) : '',
      r.record?.city ?? '',
      r.record?.callsign ?? '',
      r.record?.name ?? '',
      r.usedBy,
    ),
  );
  return (
    <Stack gap="sm">
      <Text>
        Bank occupied {count(bank.occupied)} of {count(bank.capacity)} slots · decoded{' '}
        {count(bank.decoded)} of {count(bank.occupied)} occupied · {count(mine)} {noun}
        {unclassified > 0 && ` · ${count(unclassified)} unclassified`}
      </Text>
      <Text size="sm" c="dimmed">
        {BANK_EXPLANATION} Each identity shows the callsign first, then the name.
      </Text>
      {unclassified > 0 && (
        <Alert color="yellow" title="Unclassified slots">
          {count(unclassified)} occupied slots cannot be classified (not completely captured,
          malformed or of an unknown call type). They are listed in both Contacts and Talk groups
          rather than counted as empty.
        </Alert>
      )}
      {!isContacts && (!references.channelsComplete || !references.rxGroupsComplete) && (
        <Alert color="yellow" title="Referenced by is partial">
          {[!references.channelsComplete && 'channel', !references.rxGroupsComplete && 'RX group']
            .filter(Boolean)
            .join(' and ')}{' '}
          coverage is incomplete, so only the references that were captured are listed. An empty
          list is not proof that nothing refers to a talk group.
        </Alert>
      )}
      {bank.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title="Bitmap bits beyond the slot range">
          {count(bank.outOfRangeBits.length)} bits are marked occupied above the{' '}
          {count(bank.capacity)} hardware slots (first: {bank.outOfRangeBits[0]}) and are not
          listed.
        </Alert>
      )}
      <DataTable
        caption={`AT-D890UV ${noun}`}
        columns={columns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: `Search ${noun}` }}
        sort={sort}
        onSortChange={setSort}
        stickyFirstColumn
        mobileIdentity={(r) => (
          <span>
            {r.slot} · <strong>{r.label}</strong>
          </span>
        )}
        mobileIdentityLabel="Slot · identity"
        emptyMessage={`The bank bitmap is captured and no ${noun} are present.`}
        filteredEmptyMessage={`No ${noun} match “${query.trim()}”.`}
      />
    </Stack>
  );
}

export function ContactsPanel({ projection }: { projection: AtD890MemoryProjection }) {
  return <BankPanel projection={projection} kind="contacts" />;
}

export function TalkGroupsPanel({ projection }: { projection: AtD890MemoryProjection }) {
  return <BankPanel projection={projection} kind="talk-groups" />;
}

interface RxRow {
  id: string;
  slot: number;
  entry: AtD890RxGroupEntry;
  label: string;
  memberCount: number | null;
}

function rxRow(entry: AtD890RxGroupEntry): RxRow {
  return {
    id: `rx-${entry.slot}`,
    slot: entry.slot,
    entry,
    label: entry.name.status === 'not-captured' ? NOT_CAPTURED : entry.name.text || '(unnamed)',
    memberCount: entry.members.status === 'captured' ? entry.members.list.length : null,
  };
}

const RX_COLUMNS: DataTableColumn<RxRow>[] = [
  {
    key: 'slot',
    header: 'RX group slot',
    width: '8rem',
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

interface MemberRow {
  id: string;
  member: AtD890RxMember;
  overrides: 'captured' | 'not-captured';
}

const MEMBER_COLUMNS: DataTableColumn<MemberRow>[] = [
  { key: 'position', header: 'Position', width: '5.5rem', render: (r) => r.member.position },
  {
    key: 'slot',
    header: 'Bank slot',
    width: '6.5rem',
    render: (r) => r.member.reference.slot ?? `Index ${r.member.rawIndex}`,
  },
  {
    key: 'identity',
    header: 'Identity',
    width: 'minmax(14rem, 2fr)',
    render: (r) =>
      r.member.reference.record ? <strong>{bankIdentity(r.member.reference.record)}</strong> : DASH,
  },
  {
    key: 'dmrId',
    header: 'DMR ID',
    width: '6.5rem',
    render: (r) => r.member.reference.record?.dmrId ?? DASH,
  },
  {
    key: 'type',
    header: 'Type',
    width: '7rem',
    render: (r) =>
      r.member.reference.record ? CALL_TYPE_LABEL[r.member.reference.record.callType] : DASH,
  },
  {
    key: 'ts',
    header: 'Time slot',
    width: '7rem',
    render: (r) =>
      r.overrides === 'not-captured'
        ? NOT_CAPTURED
        : r.member.timeSlot
          ? `TS${r.member.timeSlot}`
          : 'Default',
  },
  {
    key: 'status',
    header: 'Status',
    width: 'minmax(16rem, 2fr)',
    render: (r) => BANK_REFERENCE_EXPLANATION[r.member.reference.status],
  },
];

export function RxGroupsPanel({ projection }: { projection: AtD890MemoryProjection }) {
  const { rxGroups, bank } = projection;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const [selectedSlot, setSelectedSlot] = useState<number>();
  const rows = useMemo(() => rxGroups.entries.map(rxRow), [rxGroups]);
  if (rxGroups.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        The RX group occupancy bitmap was not completely captured, so no RX group list can be shown.
        This does not mean the radio has none.
      </Alert>
    );
  const selected = rxGroups.entries.find((g) => g.slot === selectedSlot);
  const shown = rows.filter((r) => matches(query, String(r.slot), r.label));
  const namesDecoded = rxGroups.entries.filter((g) => g.name.status === 'captured').length;
  const membersDecoded = rxGroups.entries.filter((g) => g.members.status === 'captured').length;
  return (
    <Stack gap="sm">
      <Text>
        Occupied {count(rxGroups.occupied)} of {count(rxGroups.capacity)} RX group slots · names
        decoded {count(namesDecoded)} · member lists decoded {count(membersDecoded)}
      </Text>
      <Text size="sm" c="dimmed">
        Members are shown at their stored positions, duplicates included; empty positions are
        skipped. Each member is a zero-based index into the shared contact bank and resolves to bank
        slot index + 1, never by DMR ID.
        {bank.bitmap !== 'captured' &&
          ' The bank bitmap was not captured, so members cannot be resolved.'}
      </Text>
      {rxGroups.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title="Bitmap bits beyond the RX group range">
          Bits {rxGroups.outOfRangeBits.join(', ')} are set above the {count(rxGroups.capacity)}{' '}
          hardware lists and are not listed.
        </Alert>
      )}
      <DataTable
        caption="AT-D890UV RX groups"
        columns={RX_COLUMNS}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search RX groups' }}
        sort={sort}
        onSortChange={setSort}
        onRowActivate={(r) => setSelectedSlot(r.slot)}
        emptyMessage="The RX group bitmap is captured and no RX group is occupied."
        filteredEmptyMessage={`No RX groups match “${query.trim()}”.`}
      />
      {selected ? (
        <Stack gap="xs" aria-label={`RX group ${selected.slot} members`} role="region">
          <Title order={4}>
            RX group {selected.slot} ·{' '}
            {selected.name.status === 'captured'
              ? selected.name.text || '(unnamed)'
              : `Name ${NOT_CAPTURED.toLowerCase()}`}
          </Title>
          {selected.members.status === 'not-captured' ? (
            <Alert color="yellow" title={NOT_CAPTURED}>
              This RX group&apos;s member list was not completely captured.
            </Alert>
          ) : (
            <>
              {selected.members.list.length > AT_D890UV_LIMITS.RX_GROUP_MEMBERS_MAX && (
                <Alert color="yellow" title="More members than the hardware allows" />
              )}
              <DataTable
                caption={`RX group ${selected.slot} members`}
                variant="embedded"
                columns={MEMBER_COLUMNS}
                rows={selected.members.list.map((member) => ({
                  id: `member-${member.position}`,
                  member,
                  overrides: selected.overrides,
                }))}
                getRowId={(r) => r.id}
                emptyMessage="This RX group has no members."
              />
            </>
          )}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Select an RX group to see its members.
        </Text>
      )}
    </Stack>
  );
}
