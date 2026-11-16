import { Alert, Stack, Text, Title } from '@mantine/core';
import { useMemo } from 'react';
import { DataTable, type DataTableColumn } from '@app/components/v2/index.ts';
import { MemoryCategoryPanel } from '@app/components/debug/index.ts';
import {
  DM32_ANALOG_CONTACT_CAVEAT,
  DM32_ANALOG_CONTACTS_EMPTY,
  DM32_DIGITAL_BOOK_TEXT,
  DM32_DIGITAL_BOOK_TITLE,
  DM32_RADIO_ID_CAVEAT,
  DM32_RADIO_IDS_EMPTY,
  DM32_RX_GROUPS_EMPTY,
  DM32_TALK_GROUP_CAVEAT,
  DM32_TALK_GROUP_SELECT_HINT,
  DM32_TALK_GROUPS_EMPTY,
  dm32AnalogBeyondPageText,
  dm32AnalogContactSummary,
  dm32ListUnavailableText,
  dm32RadioIdExcessText,
  dm32RadioIdSummary,
  dm32RxGroupBitsText,
  dm32RxGroupCaveat,
  dm32RxGroupSummary,
  dm32TalkGroupExcessText,
  dm32TalkGroupMismatchText,
  dm32TalkGroupPagesText,
  dm32TalkGroupReferencesCaveat,
  dm32TalkGroupSummary,
} from '@integrations/radio-io/radios/dm32uv/debugMemoryText.ts';
import {
  type Dm32AnalogContactInventory,
  type Dm32AnalogContactRecord,
  type Dm32CallType,
  type Dm32RadioIdEntry,
  type Dm32RadioIdInventory,
  type Dm32ReferenceResolution,
  type Dm32RxGroupEntry,
  type Dm32RxGroupInventory,
  type Dm32RxGroupMember,
  type Dm32RxMemberMatch,
  type Dm32TalkGroupEntry,
  type Dm32TalkGroupInventory,
  type Dm32TalkGroupReferences,
} from '@integrations/radio-io/radios/dm32uv/debugMemoryLists.ts';

const NOT_CAPTURED = 'Not captured';
const DASH = '—';

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

const CALL_TYPE_LABEL: Record<Dm32CallType, string> = {
  private: 'Private call',
  group: 'Group call',
  all: 'All call',
  unknown: 'Unknown type',
};

function Unavailable({
  status,
  reason,
  noun,
}: {
  status: 'not-captured' | 'ambiguous' | 'captured';
  reason?: string;
  noun: string;
}) {
  return (
    <Alert
      title={status === 'ambiguous' ? 'Several pages, not decoded' : NOT_CAPTURED}
      color="yellow"
    >
      {dm32ListUnavailableText(reason, noun)}
    </Alert>
  );
}

// ---------------------------------------------------------------------------------------------

interface TalkGroupRow {
  id: string;
  slot: number;
  entry: Dm32TalkGroupEntry;
  label: string;
  refs?: Dm32TalkGroupReferences;
}

const refCount = (refs?: Dm32TalkGroupReferences) =>
  `${refs?.channels.length ?? 0} channels · ${refs?.rxGroups.length ?? 0} RX groups`;

const talkGroupColumns: DataTableColumn<TalkGroupRow>[] = [
  {
    key: 'slot',
    header: 'Position',
    width: '5.5rem',
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
    key: 'dmrId',
    header: 'DMR ID',
    width: '8rem',
    sortable: true,
    sortValue: (r) => r.entry.dmrId,
    render: (r) => r.entry.dmrId,
  },
  {
    key: 'type',
    header: 'Call type',
    width: '8rem',
    render: (r) =>
      r.entry.callType === 'unknown'
        ? `Unknown (raw ${r.entry.callTypeRaw})`
        : CALL_TYPE_LABEL[r.entry.callType],
  },
  {
    key: 'refs',
    header: 'Referenced by',
    width: '11rem',
    render: (r) => refCount(r.refs),
  },
];

function TalkGroupReferences({
  row,
  references,
}: {
  row: TalkGroupRow;
  references: Dm32ReferenceResolution;
}) {
  return (
    <Stack gap="xs" role="region" aria-label={`Talk group ${row.slot} referenced by`}>
      <Title order={4}>
        Talk group {row.slot} · {row.label} is referenced by
      </Title>
      {references.partialReasons.length > 0 && (
        <Text size="sm">Partial list: some sources were not captured.</Text>
      )}
      {!row.refs ? (
        <Text size="sm">No captured channel or RX group refers to it.</Text>
      ) : (
        <>
          {row.refs.channels.map((c) => (
            <Text size="sm" key={`c${c.slot}`}>
              Channel {c.slot} · {c.label} (TX contact)
            </Text>
          ))}
          {row.refs.rxGroups.map((g) => (
            <Text size="sm" key={`g${g.slot}`}>
              RX group {g.slot} · {g.name} (member by DMR ID)
            </Text>
          ))}
        </>
      )}
    </Stack>
  );
}

export function TalkGroupsPanel({
  talkGroups,
  references,
}: {
  talkGroups: Dm32TalkGroupInventory;
  references: Dm32ReferenceResolution;
}) {
  const rows = useMemo(
    () =>
      talkGroups.entries.map((entry) => ({
        id: `tg-${entry.slot}`,
        slot: entry.slot,
        entry,
        label: entry.name || '(unnamed)',
        refs: references.referencedBy.get(entry.slot),
      })),
    [talkGroups, references],
  );
  if (talkGroups.status !== 'captured') return <Unavailable {...talkGroups} noun="talk groups" />;
  const present = talkGroups.overflow
    .filter((o) => o.addresses.length > 0)
    .map((o) => ({ tag: o.tag, count: o.addresses.length }));
  const missing = talkGroups.overflow.filter((o) => o.addresses.length === 0).map((o) => o.tag);
  return (
    <Stack gap="sm">
      {talkGroups.countMismatch && (
        <Alert color="yellow" title="Stored count differs from the decoded count">
          {dm32TalkGroupMismatchText(talkGroups.storedCount ?? 0, talkGroups.decoded)}
        </Alert>
      )}
      {talkGroups.excess > 0 && (
        <Alert color="yellow" title="Count above hardware capacity">
          {dm32TalkGroupExcessText(talkGroups.excess, talkGroups.capacity)}
        </Alert>
      )}
      <Text size="sm">{dm32TalkGroupPagesText(present, missing)}</Text>
      <MemoryCategoryPanel
        summary={dm32TalkGroupSummary(
          talkGroups.decoded,
          talkGroups.pageCapacity,
          talkGroups.capacity,
          talkGroups.storedCount,
          talkGroups.quickAccess,
        )}
        caveat={[
          DM32_TALK_GROUP_CAVEAT,
          `${dm32TalkGroupReferencesCaveat(references.partialReasons)} ${DM32_TALK_GROUP_SELECT_HINT}`,
        ]}
        searchPlaceholder="Search talk groups"
        caption="DM-32UV memory talk groups"
        columns={talkGroupColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.slot} ${r.label} ${r.entry.dmrId}`}
        defaultSort={{ key: 'slot', direction: 'asc' }}
        details={(r) => <TalkGroupReferences row={r} references={references} />}
        emptyMessage={DM32_TALK_GROUPS_EMPTY}
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------------------------

interface RadioIdRow {
  id: string;
  slot: number;
  entry: Dm32RadioIdEntry;
  label: string;
}

const radioIdColumns: DataTableColumn<RadioIdRow>[] = [
  {
    key: 'slot',
    header: 'Slot',
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
    key: 'dmrId',
    header: 'DMR ID',
    width: '8rem',
    sortable: true,
    sortValue: (r) => r.entry.dmrId,
    render: (r) => r.entry.dmrId,
  },
];

export function RadioIdsPanel({ radioIds }: { radioIds: Dm32RadioIdInventory }) {
  const rows = useMemo(
    () =>
      radioIds.entries.map((entry) => ({
        id: `rid-${entry.slot}`,
        slot: entry.slot,
        entry,
        label: entry.name || '(unnamed)',
      })),
    [radioIds],
  );
  if (radioIds.status !== 'captured') return <Unavailable {...radioIds} noun="radio IDs" />;
  return (
    <Stack gap="sm">
      {radioIds.excess > 0 && (
        <Alert color="yellow" title="Count above hardware capacity">
          {dm32RadioIdExcessText(radioIds.excess, radioIds.capacity)}
        </Alert>
      )}
      <MemoryCategoryPanel
        summary={dm32RadioIdSummary(
          radioIds.declaredCount ?? 0,
          radioIds.decoded,
          radioIds.vacant,
          radioIds.capacity,
        )}
        caveat={[DM32_RADIO_ID_CAVEAT]}
        searchPlaceholder="Search radio IDs"
        caption="DM-32UV memory radio IDs"
        columns={radioIdColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.slot} ${r.label} ${r.entry.dmrId}`}
        defaultSort={{ key: 'slot', direction: 'asc' }}
        emptyMessage={DM32_RADIO_IDS_EMPTY}
      />
    </Stack>
  );
}

// ---------------------------------------------------------------------------------------------

interface AnalogRow {
  id: string;
  record: Dm32AnalogContactRecord;
}

const analogColumns: DataTableColumn<AnalogRow>[] = [
  { key: 'slot', header: 'Record', width: '5.5rem', render: (r) => r.record.slot },
  {
    key: 'raw',
    header: 'Raw bytes (32)',
    width: 'minmax(20rem, 4fr)',
    render: (r) => <code>{hex(r.record.raw)}</code>,
  },
];

export function ContactsPanel({ contacts }: { contacts: Dm32AnalogContactInventory }) {
  const rows = useMemo(
    () => contacts.records.map((record) => ({ id: `analog-${record.slot}`, record })),
    [contacts],
  );
  return (
    <Stack gap="sm">
      <Alert color="yellow" title={DM32_DIGITAL_BOOK_TITLE}>
        {DM32_DIGITAL_BOOK_TEXT}
      </Alert>
      {contacts.status !== 'captured' ? (
        <Unavailable {...contacts} noun="analogue contacts" />
      ) : (
        <>
          {contacts.beyondPage > 0 && (
            <Alert color="yellow" title="Records beyond the captured page">
              {dm32AnalogBeyondPageText(contacts.beyondPage)}
            </Alert>
          )}
          <MemoryCategoryPanel
            summary={dm32AnalogContactSummary(contacts.declaredCount ?? 0, contacts.records.length)}
            caveat={[DM32_ANALOG_CONTACT_CAVEAT]}
            searchPlaceholder="Search analogue contacts"
            caption="DM-32UV analogue contact raw records"
            columns={analogColumns}
            rows={rows}
            getRowId={(r) => r.id}
            searchText={(r) => `${r.record.slot} ${hex(r.record.raw)}`}
            defaultSort={{ key: 'slot', direction: 'asc' }}
            emptyMessage={DM32_ANALOG_CONTACTS_EMPTY}
          />
        </>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------------------------

const MATCH_TEXT = (m: Dm32RxMemberMatch | undefined): string => {
  if (!m) return DASH;
  if (m.kind === 'matched')
    return `${m.name || '(unnamed)'} (talk group ${m.talkGroupSlot}, matched by DMR ID)`;
  if (m.kind === 'several') return `${m.count} talk groups share this DMR ID, so no match is shown`;
  if (m.kind === 'none')
    return 'No decoded talk group has this DMR ID (the decoded list is one page and not complete)';
  return 'Talk groups not captured, so the DMR ID is not matched';
};

const STORE_TEXT: Record<Dm32RxGroupEntry['timeSlotStore'], string> = {
  valid: 'Time-slot store valid',
  'no-marker': 'No time-slot store (marker absent); all slots none',
  'check-failed': 'Time-slot store check failed; time slots not shown',
};

interface RxGroupRow {
  id: string;
  slot: number;
  entry: Dm32RxGroupEntry;
  label: string;
}

const rxGroupColumns: DataTableColumn<RxGroupRow>[] = [
  {
    key: 'slot',
    header: 'Slot',
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
    header: 'Members',
    width: '7rem',
    render: (r) => (r.entry.blank ? 'Blank record' : r.entry.occupiedMembers),
  },
];

interface RxMemberRow {
  id: string;
  member: Dm32RxGroupMember;
}

const rxMemberColumns: DataTableColumn<RxMemberRow>[] = [
  { key: 'position', header: 'Position', width: '5.5rem', render: (r) => r.member.position },
  {
    key: 'dmrId',
    header: 'DMR ID',
    width: '8rem',
    render: (r) => (r.member.empty ? 'Empty' : r.member.dmrId),
  },
  {
    key: 'ts',
    header: 'Time slot',
    width: '6rem',
    render: (r) => (r.member.timeSlot ? `TS${r.member.timeSlot}` : DASH),
  },
  {
    key: 'match',
    header: 'Talk group',
    width: 'minmax(16rem, 3fr)',
    render: (r) => MATCH_TEXT(r.member.match),
  },
];

function RxGroupMembers({ group }: { group: Dm32RxGroupEntry }) {
  return (
    <Stack gap="xs" role="region" aria-label={`RX group ${group.slot} members`}>
      <Title order={4}>
        RX group {group.slot} · {group.name || '(unnamed)'}
      </Title>
      <Text size="sm">{STORE_TEXT[group.timeSlotStore]}</Text>
      {group.blank ? (
        <Alert color="yellow" title="Blank record">
          The bit is set but the 109-byte record is all 0x00 or all 0xFF, so no members are read.
        </Alert>
      ) : (
        <DataTable
          caption={`RX group ${group.slot} members`}
          variant="embedded"
          columns={rxMemberColumns}
          rows={group.members.map((member) => ({ id: `m-${member.position}`, member }))}
          getRowId={(r) => r.id}
          emptyMessage="This group has no members."
        />
      )}
    </Stack>
  );
}

export function RxGroupsPanel({ rxGroups }: { rxGroups: Dm32RxGroupInventory }) {
  const rows = useMemo(
    () =>
      rxGroups.entries.map((entry) => ({
        id: `rxg-${entry.slot}`,
        slot: entry.slot,
        entry,
        label: entry.name || '(unnamed)',
      })),
    [rxGroups],
  );
  if (rxGroups.status !== 'captured') return <Unavailable {...rxGroups} noun="RX groups" />;
  return (
    <Stack gap="sm">
      {rxGroups.bitsAboveCapacity > 0 && (
        <Alert color="yellow" title="Bits above hardware capacity">
          {dm32RxGroupBitsText(rxGroups.bitsAboveCapacity, rxGroups.capacity)}
        </Alert>
      )}
      <MemoryCategoryPanel
        summary={dm32RxGroupSummary(rxGroups.decoded, rxGroups.capacity, rxGroups.occupiedSlots)}
        caveat={dm32RxGroupCaveat}
        searchPlaceholder="Search RX groups"
        caption="DM-32UV memory RX groups"
        columns={rxGroupColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) =>
          [
            r.slot,
            r.label,
            ...r.entry.members.map((m) => (m.dmrId === undefined ? '' : String(m.dmrId))),
          ].join(' ')
        }
        defaultSort={{ key: 'slot', direction: 'asc' }}
        details={(r) => <RxGroupMembers group={r.entry} />}
        emptyMessage={DM32_RX_GROUPS_EMPTY}
      />
    </Stack>
  );
}
