import { Alert, Stack, Text, Title } from '@mantine/core';
import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '@app/components/v2/index.ts';
import { MemoryCategoryPanel } from '@app/components/debug/index.ts';
import {
  AT_D890UV_BANK_IDENTITY_NOTE,
  AT_D890UV_RX_EMPTY,
  AT_D890UV_RX_MEMBERS_NOT_CAPTURED,
  AT_D890UV_RX_UNAVAILABLE,
  atD890BankBitsText,
  atD890BankEmpty,
  atD890BankExplanation,
  atD890BankSummary,
  atD890BankUnavailable,
  atD890RxBitsText,
  atD890RxCaveat,
  atD890RxSummary,
  atD890UnclassifiedText,
  atD890UsagePartialText,
} from '@integrations/radio-io/radios/at-d890uv/debugMemoryText.ts';
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

/** The bank entries one panel lists: unclassified slots show in both, decoded ones by call type. */
function bankEntries(bank: AtD890MemoryProjection['bank'], isContacts: boolean) {
  return bank.entries.filter((e) =>
    e.state.kind !== 'decoded'
      ? true
      : isContacts
        ? e.state.record.callType === 0
        : e.state.record.callType !== 0,
  );
}

/** The panel's own row count ("N results" before any search), or undefined when the bank was not captured. */
export function atD890BankRowCount(
  projection: AtD890MemoryProjection,
  kind: 'contacts' | 'talk-groups',
): number | undefined {
  const { bank } = projection;
  return bank.bitmap === 'captured' ? bankEntries(bank, kind === 'contacts').length : undefined;
}

function BankPanel({
  projection,
  kind,
}: {
  projection: AtD890MemoryProjection;
  kind: 'contacts' | 'talk-groups';
}) {
  const { bank, references } = projection;
  const isContacts = kind === 'contacts';
  const noun = isContacts ? 'contacts' : 'talk groups';
  const columns = useMemo(() => bankColumns(!isContacts), [isContacts]);
  const rows = useMemo(
    () => bankEntries(bank, isContacts).map((e) => bankRow(e, references)),
    [bank, references, isContacts],
  );
  if (bank.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {atD890BankUnavailable(noun)}
      </Alert>
    );
  const unclassified = bank.entries.filter((e) => e.state.kind !== 'decoded').length;
  const mine = rows.length - unclassified;
  return (
    <Stack gap="sm">
      {unclassified > 0 && (
        <Alert color="yellow" title="Unclassified slots">
          {atD890UnclassifiedText(unclassified)}
        </Alert>
      )}
      {!isContacts && (!references.channelsComplete || !references.rxGroupsComplete) && (
        <Alert color="yellow" title="Referenced by is partial">
          {atD890UsagePartialText(
            [!references.channelsComplete && 'channel', !references.rxGroupsComplete && 'RX group']
              .filter(Boolean)
              .join(' and '),
          )}
        </Alert>
      )}
      {bank.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title="Bitmap bits beyond the slot range">
          {atD890BankBitsText(bank.outOfRangeBits.length, bank.capacity, bank.outOfRangeBits[0]!)}
        </Alert>
      )}
      <MemoryCategoryPanel
        summary={atD890BankSummary(
          bank.occupied,
          bank.capacity,
          bank.decoded,
          mine,
          noun,
          unclassified,
        )}
        caveat={[
          atD890BankExplanation(AT_D890UV_LIMITS.TALK_GROUPS_MAX),
          AT_D890UV_BANK_IDENTITY_NOTE,
        ]}
        searchPlaceholder={`Search ${noun}`}
        caption={`AT-D890UV ${noun}`}
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) =>
          [
            r.slot,
            String(r.slot).padStart(4, '0'),
            r.label,
            r.typeText,
            r.record ? String(r.record.dmrId) : '',
            r.record?.city ?? '',
            r.record?.callsign ?? '',
            r.record?.name ?? '',
            r.usedBy,
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
        emptyMessage={atD890BankEmpty(noun)}
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

function RxGroupDetails({ group }: { group: AtD890RxGroupEntry }) {
  return (
    <Stack gap="xs" aria-label={`RX group ${group.slot} members`} role="region">
      <Title order={4}>
        RX group {group.slot} ·{' '}
        {group.name.status === 'captured'
          ? group.name.text || '(unnamed)'
          : `Name ${NOT_CAPTURED.toLowerCase()}`}
      </Title>
      {group.members.status === 'not-captured' ? (
        <Alert color="yellow" title={NOT_CAPTURED}>
          {AT_D890UV_RX_MEMBERS_NOT_CAPTURED}
        </Alert>
      ) : (
        <>
          {group.members.list.length > AT_D890UV_LIMITS.RX_GROUP_MEMBERS_MAX && (
            <Alert color="yellow" title="More members than the hardware allows" />
          )}
          <DataTable
            caption={`RX group ${group.slot} members`}
            variant="embedded"
            columns={MEMBER_COLUMNS}
            rows={group.members.list.map((member) => ({
              id: `member-${member.position}`,
              member,
              overrides: group.overrides,
            }))}
            getRowId={(r) => r.id}
            emptyMessage="This RX group has no members."
          />
        </>
      )}
    </Stack>
  );
}

export function RxGroupsPanel({ projection }: { projection: AtD890MemoryProjection }) {
  const { rxGroups, bank } = projection;
  const rows = useMemo(() => rxGroups.entries.map(rxRow), [rxGroups]);
  if (rxGroups.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {AT_D890UV_RX_UNAVAILABLE}
      </Alert>
    );
  const namesDecoded = rxGroups.entries.filter((g) => g.name.status === 'captured').length;
  const membersDecoded = rxGroups.entries.filter((g) => g.members.status === 'captured').length;
  return (
    <Stack gap="sm">
      {rxGroups.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title="Bitmap bits beyond the RX group range">
          {atD890RxBitsText(rxGroups.outOfRangeBits, rxGroups.capacity)}
        </Alert>
      )}
      <MemoryCategoryPanel
        summary={atD890RxSummary(
          rxGroups.occupied,
          rxGroups.capacity,
          namesDecoded,
          membersDecoded,
        )}
        caveat={atD890RxCaveat(bank.bitmap === 'captured')}
        searchPlaceholder="Search RX groups"
        caption="AT-D890UV RX groups"
        columns={RX_COLUMNS}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.slot} ${r.label}`}
        defaultSort={{ key: 'slot', direction: 'asc' }}
        details={(r) => <RxGroupDetails group={r.entry} />}
        emptyMessage={AT_D890UV_RX_EMPTY}
      />
    </Stack>
  );
}
