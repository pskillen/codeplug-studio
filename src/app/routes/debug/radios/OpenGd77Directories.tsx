import { Alert, Button, Group, NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
} from '@app/components/v2/index.ts';
import type { OpenGd77MemoryArchive } from '@integrations/radio-io/radios/opengd77/debugMemory.ts';
import {
  findOpenGd77UserDatabaseEntries,
  projectOpenGd77Contacts,
  projectOpenGd77RxGroups,
  projectOpenGd77UserDatabase,
  type OpenGd77ContactEntry,
  type OpenGd77RxGroupEntry,
  type OpenGd77UserDatabaseEntry,
  type OpenGd77UserDatabaseOk,
} from '@integrations/radio-io/radios/opengd77/debugDirectories.ts';

const NOT_CAPTURED = 'Not captured';
const USER_DATABASE_PAGE_SIZE = 100;
const USER_DATABASE_SEARCH_CAP = 200;

const count = (n: number) => n.toLocaleString('en-GB');
const hex8 = (n: number) => `0x${n.toString(16).toUpperCase().padStart(8, '0')}`;
const hex2 = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;

const matches = (query: string, ...haystack: string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

interface ContactRow {
  id: string;
  entry: OpenGd77ContactEntry;
}

const callTypeText = (e: OpenGd77ContactEntry) =>
  e.callTypeLabel === 'Unknown' ? `Unknown (${e.callType})` : e.callTypeLabel;

const contactColumns: DataTableColumn<ContactRow>[] = [
  {
    key: 'slot',
    header: 'Slot',
    width: '5rem',
    sortable: true,
    sortValue: (r) => r.entry.slot,
    render: (r) => r.entry.slot,
  },
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(12rem, 2fr)',
    sortable: true,
    sortValue: (r) => r.entry.name,
    render: (r) => <strong>{r.entry.name}</strong>,
  },
  {
    key: 'id',
    header: 'DMR ID',
    width: '8rem',
    sortable: true,
    sortValue: (r) => r.entry.digitalId,
    render: (r) => r.entry.digitalId,
  },
  {
    key: 'type',
    header: 'Call type',
    width: '8rem',
    sortable: true,
    sortValue: (r) => r.entry.callType,
    render: (r) => callTypeText(r.entry),
  },
  {
    key: 'ts',
    header: 'Time-slot byte (raw)',
    width: '9rem',
    render: (r) => hex2(r.entry.timeSlotByte),
  },
];

/** Read-only viewer over the open archive. */
export function ContactsPanel({ archive }: { archive: OpenGd77MemoryArchive }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const projection = useMemo(() => projectOpenGd77Contacts(archive), [archive]);
  const rows = useMemo(
    () => projection.entries.map((entry) => ({ id: `contact-${entry.slot}`, entry })),
    [projection],
  );
  if (projection.status !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        The contact bank was not completely captured, so no contact list can be shown. This does not
        mean the radio has no contacts.
      </Alert>
    );
  const shown = rows.filter((r) =>
    matches(
      query,
      String(r.entry.slot),
      r.entry.name,
      String(r.entry.digitalId),
      callTypeText(r.entry),
    ),
  );
  return (
    <Stack gap="sm">
      <Text>
        {count(projection.entries.length)} captured of {count(projection.capacity)} contact slots
      </Text>
      <Text size="sm" c="dimmed">
        Slots keep their one-based radio numbers. Call type is the radio&apos;s raw value (0 Group,
        1 Private, 2 All call); anything else reads Unknown with that value. The time-slot override
        byte is shown raw: it is not decoded here.
      </Text>
      <DataTable
        caption="OpenGD77 contacts"
        columns={contactColumns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search contacts' }}
        sort={sort}
        onSortChange={setSort}
        emptyMessage="The contact bank is captured and no slot is in use."
        filteredEmptyMessage={`No contacts match “${query.trim()}”.`}
      />
    </Stack>
  );
}

interface GroupRow {
  id: string;
  entry: OpenGd77RxGroupEntry;
}

const groupColumns: DataTableColumn<GroupRow>[] = [
  {
    key: 'slot',
    header: 'List slot',
    width: '6rem',
    sortable: true,
    sortValue: (r) => r.entry.slot,
    render: (r) => r.entry.slot,
  },
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(12rem, 2fr)',
    sortable: true,
    sortValue: (r) => r.entry.name,
    render: (r) => <strong>{r.entry.name}</strong>,
  },
  {
    key: 'members',
    header: 'Members',
    width: '10rem',
    sortable: true,
    sortValue: (r) => r.entry.declaredMembers,
    render: (r) => `${r.entry.resolvedMembers.length} of ${r.entry.declaredMembers} resolved`,
  },
];

interface GroupMemberRow {
  id: string;
  position: number;
  contactSlot?: number;
  digitalId?: number;
  note: string;
}

function memberRows(entry: OpenGd77RxGroupEntry): GroupMemberRow[] {
  const resolved = entry.resolvedMembers.map((m, i) => ({
    id: `member-${i}`,
    position: i + 1,
    contactSlot: m.contactSlot,
    digitalId: m.digitalId,
    note: 'Resolved',
  }));
  const reason = entry.contactsCaptured ? 'contact slot is empty' : 'contact bank not captured';
  const unresolved = Array.from({ length: entry.unresolved }, (_, i) => ({
    id: `unresolved-${i}`,
    position: resolved.length + i + 1,
    note: `Unresolved: ${reason}`,
  }));
  return [...resolved, ...unresolved];
}

const memberColumns: DataTableColumn<GroupMemberRow>[] = [
  { key: 'pos', header: 'Order', width: '4.5rem', render: (r) => r.position },
  { key: 'slot', header: 'Contact slot', width: '7rem', render: (r) => r.contactSlot ?? '—' },
  { key: 'id', header: 'DMR ID', width: '8rem', render: (r) => r.digitalId ?? '—' },
  { key: 'note', header: 'Status', width: 'minmax(14rem, 2fr)', render: (r) => r.note },
];

/** Read-only viewer over the open archive. */
export function RxGroupsPanel({ archive }: { archive: OpenGd77MemoryArchive }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const [selectedSlot, setSelectedSlot] = useState<number>();
  const projection = useMemo(() => projectOpenGd77RxGroups(archive), [archive]);
  const rows = useMemo(
    () => projection.entries.map((entry) => ({ id: `group-${entry.slot}`, entry })),
    [projection],
  );
  if (projection.status !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        The RX group list bank was not completely captured, so no list can be shown. This does not
        mean the radio has no RX groups.
      </Alert>
    );
  const selected = projection.entries.find((g) => g.slot === selectedSlot);
  const shown = rows.filter((r) => matches(query, String(r.entry.slot), r.entry.name));
  return (
    <Stack gap="sm">
      <Text>
        {count(projection.entries.length)} of {count(projection.capacity)} RX group lists in use
      </Text>
      <Text size="sm" c="dimmed">
        Members are contacts. A member the product decoder cannot resolve is counted and listed as
        unresolved, never dropped; resolved members are listed first.
      </Text>
      <DataTable
        caption="OpenGD77 RX groups"
        columns={groupColumns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search RX groups' }}
        sort={sort}
        onSortChange={setSort}
        onRowActivate={(r) => setSelectedSlot(r.entry.slot)}
        emptyMessage="The RX group bank is captured and no list is in use."
        filteredEmptyMessage={`No RX groups match “${query.trim()}”.`}
      />
      {selected ? (
        <Stack gap="xs" role="region" aria-label={`RX group ${selected.slot} members`}>
          <Title order={4}>
            RX group {selected.slot} · {selected.name}
          </Title>
          <Text size="sm">
            {selected.resolvedMembers.length} of {selected.declaredMembers} members resolved
          </Text>
          <DataTable
            caption={`RX group ${selected.slot} members`}
            variant="embedded"
            columns={memberColumns}
            rows={memberRows(selected)}
            getRowId={(r) => r.id}
            emptyMessage="This list declares no members."
          />
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Select a list to see its members.
        </Text>
      )}
    </Stack>
  );
}

interface UdRow {
  id: string;
  index: number;
  entry: OpenGd77UserDatabaseEntry;
}

const udColumns: DataTableColumn<UdRow>[] = [
  { key: 'index', header: 'Index', width: '6rem', render: (r) => r.index },
  { key: 'id', header: 'DMR ID', width: '8rem', render: (r) => r.entry.digitalId },
  { key: 'text', header: 'Text', width: 'minmax(16rem, 3fr)', render: (r) => r.entry.text },
  {
    key: 'addr',
    header: 'Flash address',
    width: '10rem',
    render: (r) => hex8(r.entry.flashAddress),
  },
];

function modeMeaning(mode: number, segment1Abs: number): string {
  const ch = String.fromCharCode(mode);
  if (mode === 0x4e) return `Segment 1 at ${hex8(segment1Abs)}`;
  if (mode === 0x6e) return `Segment 1 at ${hex8(segment1Abs)}, overwrites voice prompts`;
  return `Unrecognised mode byte ${JSON.stringify(ch)}; addresses assume segment 1 at ${hex8(segment1Abs)}`;
}

function UserDatabaseTable({ db }: { db: OpenGd77UserDatabaseOk }) {
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState<'id-prefix' | 'text'>('id-prefix');
  const [draft, setDraft] = useState('');
  const [applied, setApplied] = useState<{ kind: 'id-prefix' | 'text'; value: string }>();
  const search = useMemo(
    () =>
      applied?.value.trim()
        ? findOpenGd77UserDatabaseEntries(db, applied, USER_DATABASE_SEARCH_CAP)
        : undefined,
    [db, applied],
  );
  const total = search ? search.indices.length : db.capturedEntries;
  const pages = Math.max(1, Math.ceil(total / USER_DATABASE_PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const first = current * USER_DATABASE_PAGE_SIZE;
  const last = Math.min(total, first + USER_DATABASE_PAGE_SIZE);
  const rows: UdRow[] = [];
  for (let i = first; i < last; i++) {
    const index = search ? search.indices[i]! : i;
    rows.push({ id: `entry-${index}`, index, entry: db.entryAt(index) });
  }
  const submit = () => {
    setApplied({ kind, value: draft });
    setPage(0);
  };
  return (
    <Stack gap="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Group align="flex-end" gap="sm">
          <NativeSelect
            label="Search by"
            value={kind}
            onChange={(e) => setKind(e.currentTarget.value as 'id-prefix' | 'text')}
            data={[
              { value: 'id-prefix', label: 'DMR ID prefix' },
              { value: 'text', label: 'Text' },
            ]}
          />
          <TextInput
            label="Search the User Database"
            placeholder={kind === 'id-prefix' ? 'DMR ID prefix' : 'Text'}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
          />
          <Button type="submit">Search</Button>
          {applied && (
            <Button
              variant="default"
              onClick={() => {
                setApplied(undefined);
                setDraft('');
                setPage(0);
              }}
            >
              Clear search
            </Button>
          )}
        </Group>
      </form>
      {search?.capped && (
        <Alert color="yellow" title="Results capped">
          Showing the first {USER_DATABASE_SEARCH_CAP} matches. Refine the search to see others.
        </Alert>
      )}
      <DataTable
        caption="OpenGD77 User Database entries"
        columns={udColumns}
        rows={rows}
        getRowId={(r) => r.id}
        emptyMessage={
          search
            ? `No entries match “${applied?.value.trim()}”.`
            : 'This User Database has no captured entries.'
        }
      />
      <Group gap="sm">
        <Button variant="default" disabled={current === 0} onClick={() => setPage(current - 1)}>
          Previous
        </Button>
        <Text>
          Page {count(current + 1)} of {count(pages)}
        </Text>
        <Button
          variant="default"
          disabled={current >= pages - 1}
          onClick={() => setPage(current + 1)}
        >
          Next
        </Button>
        <Text size="sm" c="dimmed">
          {search
            ? `${count(search.indices.length)} matching entries`
            : `${count(db.capturedEntries)} entries`}
        </Text>
      </Group>
    </Stack>
  );
}

/** Read-only viewer over the open archive. */
export function UserDatabasePanel({ archive }: { archive: OpenGd77MemoryArchive }) {
  const projection = useMemo(() => projectOpenGd77UserDatabase(archive), [archive]);
  if (projection.status === 'not-captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        This archive holds no User Database region. This does not mean the radio has none.
      </Alert>
    );
  if (projection.status === 'refused')
    return (
      <Alert title="Refused" color="red">
        The User Database region was not accepted: {projection.reason}.
      </Alert>
    );
  if (projection.status === 'invalid-header')
    return (
      <Stack gap="sm">
        <Alert title="Invalid header" color="red">
          {projection.reason}. No entries are listed.
        </Alert>
        <Text>
          Raw header: <code>{projection.headerHex}</code>
        </Text>
      </Stack>
    );
  const db = projection;
  return (
    <Stack gap="sm">
      <Stack gap={2} role="group" aria-label="User Database header">
        <Text fw={600}>Valid header</Text>
        <Text size="sm">
          Mode byte {hex2(db.modeByte)} (&apos;{String.fromCharCode(db.modeByte)}&apos;):{' '}
          {modeMeaning(db.modeByte, db.segment1Abs)}
        </Text>
        <Text size="sm">
          Raw header: <code>{db.headerHex}</code>
        </Text>
        <Text size="sm">
          Header entry count {count(db.headerEntryCount)} · captured entries{' '}
          {count(db.capturedEntries)} · segment 0 {count(db.segment0Entries)} · segment 1{' '}
          {count(db.segment1Entries)} · packed length {count(db.packedByteLength)} bytes
        </Text>
        <Text size="sm" c="dimmed">
          Entries are stored packed in this archive; flash addresses below are the real addresses.
          Text is 6-bit packed and trimmed; characters outside the alphabet decode as spaces.
        </Text>
      </Stack>
      {db.truncated && (
        <Alert color="yellow" title="Truncated">
          The header declares {count(db.headerEntryCount)} entries but only{' '}
          {count(db.capturedEntries)} are shown
          {db.beyondProductMax
            ? ': the product read caps the User Database below the header count.'
            : ': the stored bytes end early.'}
        </Alert>
      )}
      <UserDatabaseTable db={db} />
    </Stack>
  );
}
