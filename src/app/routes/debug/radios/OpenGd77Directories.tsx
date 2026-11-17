import { Alert, Button, Group, NativeSelect, Stack, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@app/components/v2/index.ts';
import { MemoryCategoryPanel } from '@app/components/debug/index.ts';
import type { OpenGd77MemoryArchive } from '@integrations/radio-io/radios/opengd77/debugMemory.ts';
import {
  OPENGD77_CONTACT_CAVEAT,
  OPENGD77_CONTACTS_EMPTY,
  OPENGD77_CONTACTS_UNAVAILABLE,
  OPENGD77_RX_GROUP_CAVEAT,
  OPENGD77_RX_GROUPS_EMPTY,
  OPENGD77_RX_GROUPS_UNAVAILABLE,
  OPENGD77_USER_DATABASE_CAVEAT,
  OPENGD77_USER_DATABASE_EMPTY,
  OPENGD77_USER_DATABASE_NOT_CAPTURED,
  opengd77ContactSummary,
  opengd77RxGroupSummary,
  opengd77UserDatabaseHeaderCounts,
  opengd77UserDatabaseNoMatch,
  opengd77UserDatabaseRefusedText,
  opengd77UserDatabaseSummary,
  opengd77UserDatabaseTruncatedText,
} from '@integrations/radio-io/radios/opengd77/debugMemoryText.ts';
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

/**
 * The item count each directory panel shows as its own "N results" before any search, or undefined
 * when that panel has no list to count (not captured, refused, invalid header). The User Database
 * count is the header's captured-entry count: no entry is decoded to know it.
 */
export function opengd77DirectoryCounts(archive: OpenGd77MemoryArchive): {
  contacts: number | undefined;
  rxGroups: number | undefined;
  userDatabase: number | undefined;
} {
  const contacts = projectOpenGd77Contacts(archive);
  const rxGroups = projectOpenGd77RxGroups(archive);
  const db = projectOpenGd77UserDatabase(archive);
  return {
    contacts: contacts.status === 'captured' ? contacts.entries.length : undefined,
    rxGroups: rxGroups.status === 'captured' ? rxGroups.entries.length : undefined,
    userDatabase:
      db.status === 'not-captured' || db.status === 'refused' || db.status === 'invalid-header'
        ? undefined
        : db.capturedEntries,
  };
}

/** Read-only viewer over the open archive. */
export function ContactsPanel({ archive }: { archive: OpenGd77MemoryArchive }) {
  const projection = useMemo(() => projectOpenGd77Contacts(archive), [archive]);
  const rows = useMemo(
    () => projection.entries.map((entry) => ({ id: `contact-${entry.slot}`, entry })),
    [projection],
  );
  if (projection.status !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {OPENGD77_CONTACTS_UNAVAILABLE}
      </Alert>
    );
  return (
    <MemoryCategoryPanel
      summary={opengd77ContactSummary(projection.entries.length, projection.capacity)}
      caveat={OPENGD77_CONTACT_CAVEAT}
      searchPlaceholder="Search contacts"
      caption="OpenGD77 contacts"
      columns={contactColumns}
      rows={rows}
      getRowId={(r) => r.id}
      searchText={(r) =>
        [r.entry.slot, r.entry.name, r.entry.digitalId, callTypeText(r.entry)].join(' ')
      }
      defaultSort={{ key: 'slot', direction: 'asc' }}
      emptyMessage={OPENGD77_CONTACTS_EMPTY}
    />
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

function RxGroupMembers({ group }: { group: OpenGd77RxGroupEntry }) {
  return (
    <Stack gap="xs" role="region" aria-label={`RX group ${group.slot} members`}>
      <Title order={4}>
        RX group {group.slot} · {group.name}
      </Title>
      <Text size="sm">
        {group.resolvedMembers.length} of {group.declaredMembers} members resolved
      </Text>
      <DataTable
        caption={`RX group ${group.slot} members`}
        variant="embedded"
        columns={memberColumns}
        rows={memberRows(group)}
        getRowId={(r) => r.id}
        emptyMessage="This list declares no members."
      />
    </Stack>
  );
}

/** Read-only viewer over the open archive. */
export function RxGroupsPanel({ archive }: { archive: OpenGd77MemoryArchive }) {
  const projection = useMemo(() => projectOpenGd77RxGroups(archive), [archive]);
  const rows = useMemo(
    () => projection.entries.map((entry) => ({ id: `group-${entry.slot}`, entry })),
    [projection],
  );
  if (projection.status !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        {OPENGD77_RX_GROUPS_UNAVAILABLE}
      </Alert>
    );
  return (
    <MemoryCategoryPanel
      summary={opengd77RxGroupSummary(projection.entries.length, projection.capacity)}
      caveat={OPENGD77_RX_GROUP_CAVEAT}
      searchPlaceholder="Search RX groups"
      caption="OpenGD77 RX groups"
      columns={groupColumns}
      rows={rows}
      getRowId={(r) => r.id}
      searchText={(r) => `${r.entry.slot} ${r.entry.name}`}
      defaultSort={{ key: 'slot', direction: 'asc' }}
      details={(r) => <RxGroupMembers group={r.entry} />}
      emptyMessage={OPENGD77_RX_GROUPS_EMPTY}
    />
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

/**
 * The opt-in, paged User Database: the form searches the whole database through the decoder's
 * index; the panel's own search box only filters the page on screen.
 */
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
      <MemoryCategoryPanel
        summary={opengd77UserDatabaseSummary(search?.indices.length, db.capturedEntries)}
        caveat={OPENGD77_USER_DATABASE_CAVEAT}
        searchPlaceholder="Filter this page"
        caption="OpenGD77 User Database entries"
        columns={udColumns}
        rows={rows}
        getRowId={(r) => r.id}
        searchText={(r) => `${r.index} ${r.entry.digitalId} ${r.entry.text}`}
        emptyMessage={
          search
            ? opengd77UserDatabaseNoMatch(applied?.value.trim() ?? '')
            : OPENGD77_USER_DATABASE_EMPTY
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
        {OPENGD77_USER_DATABASE_NOT_CAPTURED}
      </Alert>
    );
  if (projection.status === 'refused')
    return (
      <Alert title="Refused" color="red">
        {opengd77UserDatabaseRefusedText(projection.reason)}
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
          {opengd77UserDatabaseHeaderCounts(
            db.headerEntryCount,
            db.capturedEntries,
            db.segment0Entries,
            db.segment1Entries,
            db.packedByteLength,
          )}
        </Text>
      </Stack>
      {db.truncated && (
        <Alert color="yellow" title="Truncated">
          {opengd77UserDatabaseTruncatedText(
            db.headerEntryCount,
            db.capturedEntries,
            db.beyondProductMax,
          )}
        </Alert>
      )}
      <UserDatabaseTable db={db} />
    </Stack>
  );
}
