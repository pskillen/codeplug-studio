import { Alert, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
} from '@app/components/v2/index.ts';
import {
  dm32TagHex,
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

const count = (n: number) => n.toLocaleString('en-GB');
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const matches = (query: string, ...haystack: string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

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
      {reason} This does not mean the radio has no {noun}.
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

export function TalkGroupsPanel({
  talkGroups,
  references,
}: {
  talkGroups: Dm32TalkGroupInventory;
  references: Dm32ReferenceResolution;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const [selected, setSelected] = useState<number>();
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
  const selectedRow = rows.find((r) => r.slot === selected);
  if (talkGroups.status !== 'captured') return <Unavailable {...talkGroups} noun="talk groups" />;
  const shown = rows.filter((r) => matches(query, String(r.slot), r.label, String(r.entry.dmrId)));
  const present = talkGroups.overflow.filter((o) => o.addresses.length > 0);
  const missing = talkGroups.overflow.filter((o) => o.addresses.length === 0);
  return (
    <Stack gap="sm">
      <Text>
        Decoded {count(talkGroups.decoded)} talk groups from the first talk-group page (one page
        holds at most {count(talkGroups.pageCapacity)} of the {count(talkGroups.capacity)} hardware
        entries) ·{' '}
        {talkGroups.storedCount === undefined
          ? `stored count: ${NOT_CAPTURED.toLowerCase()} (quick-access page ${
              talkGroups.quickAccess === 'ambiguous' ? 'ambiguous' : 'missing'
            })`
          : `stored count ${count(talkGroups.storedCount)}`}
      </Text>
      <Text size="sm" c="dimmed">
        This list is not complete: pages tagged 0x45 to 0x48 hold further talk-group data whose
        layout is not established, so they are not decoded. Position is the one-based place in the
        stored list that channel TX contacts refer to. Each name is the radio&apos;s single name
        field; callsign data is unavailable because the digital address book (V-frame 0x0F) is not
        captured. Not validated on hardware.
      </Text>
      {talkGroups.countMismatch && (
        <Alert color="yellow" title="Stored count differs from the decoded count">
          The quick-access page states {count(talkGroups.storedCount ?? 0)} talk groups; the first
          page decodes {count(talkGroups.decoded)}. The difference is not explained by this capture.
        </Alert>
      )}
      {talkGroups.excess > 0 && (
        <Alert color="yellow" title="Count above hardware capacity">
          The stored count claims {count(talkGroups.excess)} talk groups above the{' '}
          {count(talkGroups.capacity)} hardware entries; they are not listed.
        </Alert>
      )}
      <Text size="sm">
        Pages 0x45 to 0x48: present, layout not established:{' '}
        {present.length === 0
          ? 'none captured'
          : present.map((o) => `${dm32TagHex(o.tag)} (${o.addresses.length})`).join(', ')}
        {missing.length > 0 &&
          ` · ${NOT_CAPTURED.toLowerCase()}: ${missing.map((o) => dm32TagHex(o.tag)).join(', ')}`}
      </Text>
      <DataTable
        caption="DM-32UV memory talk groups"
        columns={talkGroupColumns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search talk groups' }}
        sort={sort}
        onSortChange={setSort}
        onRowActivate={(r) => setSelected(r.slot)}
        emptyMessage="The talk-group page was captured and holds no entries."
        filteredEmptyMessage={`No talk groups match “${query.trim()}”.`}
      />
      <Text size="sm" c="dimmed">
        Referenced by counts only captured channel TX contacts (by list position) and RX group
        members (matched by DMR ID).
        {references.partialReasons.length > 0
          ? ` Partial: ${references.partialReasons.join('; ')}.`
          : ''}
      </Text>
      {selectedRow ? (
        <Stack gap="xs" role="region" aria-label={`Talk group ${selectedRow.slot} referenced by`}>
          <Title order={4}>
            Talk group {selectedRow.slot} · {selectedRow.label} is referenced by
          </Title>
          {references.partialReasons.length > 0 && (
            <Text size="sm">Partial list: some sources were not captured.</Text>
          )}
          {!selectedRow.refs ? (
            <Text size="sm">No captured channel or RX group refers to it.</Text>
          ) : (
            <>
              {selectedRow.refs.channels.map((c) => (
                <Text size="sm" key={`c${c.slot}`}>
                  Channel {c.slot} · {c.label} (TX contact)
                </Text>
              ))}
              {selectedRow.refs.rxGroups.map((g) => (
                <Text size="sm" key={`g${g.slot}`}>
                  RX group {g.slot} · {g.name} (member by DMR ID)
                </Text>
              ))}
            </>
          )}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Select a talk group to see what refers to it.
        </Text>
      )}
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
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
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
  const shown = rows.filter((r) => matches(query, String(r.slot), r.label, String(r.entry.dmrId)));
  return (
    <Stack gap="sm">
      <Text>
        The radio states {count(radioIds.declaredCount ?? 0)} radio IDs · {count(radioIds.decoded)}{' '}
        decoded · {count(radioIds.vacant)} vacant positions · {count(radioIds.capacity)} hardware
        entries
      </Text>
      <Text size="sm" c="dimmed">
        Radio IDs are the operator DMR IDs the radio transmits with. A channel refers to one by a
        zero-based index, so index n is slot n + 1 here. Each name is the radio&apos;s single name
        field. Not validated on hardware.
      </Text>
      {radioIds.excess > 0 && (
        <Alert color="yellow" title="Count above hardware capacity">
          The stored count claims {count(radioIds.excess)} radio IDs above the{' '}
          {count(radioIds.capacity)} hardware entries; they are not listed.
        </Alert>
      )}
      <DataTable
        caption="DM-32UV memory radio IDs"
        columns={radioIdColumns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search radio IDs' }}
        sort={sort}
        onSortChange={setSort}
        emptyMessage="The radio-ID page was captured and holds no IDs."
        filteredEmptyMessage={`No radio IDs match “${query.trim()}”.`}
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
      <Alert color="yellow" title="Digital address book (V-frame 0x0F bank): not captured">
        The digital contact list is read through a separate bank this capture does not include, so
        no digital contacts or callsigns are shown. This does not mean the radio has none.
      </Alert>
      {contacts.status !== 'captured' ? (
        <Unavailable {...contacts} noun="analogue contacts" />
      ) : (
        <>
          <Text>
            Analogue (DTMF) contacts: the radio states {count(contacts.declaredCount ?? 0)} ·{' '}
            {count(contacts.records.length)} raw records captured
          </Text>
          <Text size="sm" c="dimmed">
            The analogue contact record layout is not established, so records are shown as raw hex
            only. Not validated on hardware.
          </Text>
          {contacts.beyondPage > 0 && (
            <Alert color="yellow" title="Records beyond the captured page">
              The stored count places {count(contacts.beyondPage)} records beyond the captured page;
              they are not captured.
            </Alert>
          )}
          <DataTable
            caption="DM-32UV analogue contact raw records"
            columns={analogColumns}
            rows={rows}
            getRowId={(r) => r.id}
            emptyMessage="The analogue contact page was captured and the radio states no contacts."
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

export function RxGroupsPanel({ rxGroups }: { rxGroups: Dm32RxGroupInventory }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const [selected, setSelected] = useState<number>();
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
  const shown = rows.filter((r) =>
    matches(
      query,
      String(r.slot),
      r.label,
      ...r.entry.members.map((m) => (m.dmrId === undefined ? '' : String(m.dmrId))),
    ),
  );
  const group = rxGroups.entries.find((g) => g.slot === selected);
  return (
    <Stack gap="sm">
      <Text>
        Decoded {count(rxGroups.decoded)} RX groups of {count(rxGroups.capacity)} hardware groups ·
        occupied slots:{' '}
        {rxGroups.occupiedSlots.length === 0 ? 'none' : rxGroups.occupiedSlots.join(', ')}
      </Text>
      <Text size="sm" c="dimmed">
        A group is present when its bit is set in the stored bitmask, so slots can have holes.
        Members are DMR IDs as stored, in stored order with duplicates kept; empty positions are
        shown as empty. A member is matched to a talk group by DMR ID only when exactly one decoded
        talk group has it. Each name is the radio&apos;s single name field; callsign data is
        unavailable. Not validated on hardware.
      </Text>
      {rxGroups.bitsAboveCapacity > 0 && (
        <Alert color="yellow" title="Bits above hardware capacity">
          The bitmask sets {count(rxGroups.bitsAboveCapacity)} bits above the{' '}
          {count(rxGroups.capacity)} hardware groups; they are not listed.
        </Alert>
      )}
      <DataTable
        caption="DM-32UV memory RX groups"
        columns={rxGroupColumns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search RX groups' }}
        sort={sort}
        onSortChange={setSort}
        onRowActivate={(r) => setSelected(r.slot)}
        emptyMessage="The RX-group page was captured and no group bit is set."
        filteredEmptyMessage={`No RX groups match “${query.trim()}”.`}
      />
      {group ? (
        <Stack gap="xs" role="region" aria-label={`RX group ${group.slot} members`}>
          <Title order={4}>
            RX group {group.slot} · {group.name || '(unnamed)'}
          </Title>
          <Text size="sm">{STORE_TEXT[group.timeSlotStore]}</Text>
          {group.blank ? (
            <Alert color="yellow" title="Blank record">
              The bit is set but the 109-byte record is all 0x00 or all 0xFF, so no members are
              read.
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
      ) : (
        <Text size="sm" c="dimmed">
          Select an RX group to see its members.
        </Text>
      )}
    </Stack>
  );
}
