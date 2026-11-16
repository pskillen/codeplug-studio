import { Alert, Stack, Text } from '@mantine/core';
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
  type Dm32TalkGroupEntry,
  type Dm32TalkGroupInventory,
} from '@integrations/radio-io/radios/dm32uv/debugMemoryLists.ts';

const NOT_CAPTURED = 'Not captured';

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
}

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
];

export function TalkGroupsPanel({ talkGroups }: { talkGroups: Dm32TalkGroupInventory }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const rows = useMemo(
    () =>
      talkGroups.entries.map((entry) => ({
        id: `tg-${entry.slot}`,
        slot: entry.slot,
        entry,
        label: entry.name || '(unnamed)',
      })),
    [talkGroups],
  );
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
        emptyMessage="The talk-group page was captured and holds no entries."
        filteredEmptyMessage={`No talk groups match “${query.trim()}”.`}
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
