import { Alert, Stack, Switch, Table, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
} from '@app/components/v2/index.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type {
  AtD890MemberStatus,
  AtD890MemoryProjection,
} from '@integrations/radio-io/radios/at-d890uv/debugMemory.ts';
import {
  AT_D890_SETTINGS_GROUPS,
  type AtD890ScanListEntry,
  type AtD890ScanMember,
  type AtD890ScanPriority,
  type AtD890SettingFieldView,
} from '@integrations/radio-io/radios/at-d890uv/debugMemorySettings.ts';

const NOT_CAPTURED = 'Not captured';
const DASH = '—';
const count = (n: number) => n.toLocaleString('en-GB');
const mhz = (hz: number) => (hz / 1e6).toFixed(5);
const hexByte = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');
const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(7, '0')}`;
const matches = (query: string, ...haystack: string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

export const MEMBER_EXPLANATION: Record<AtD890MemberStatus, string> = {
  resolved: 'Resolved',
  'out-of-range': 'Out of range: beyond the hardware channel slots',
  absent: 'Absent: the channel bitmap does not mark this slot occupied',
  'not-captured': 'Not captured: the slot is occupied but its record is incomplete',
  'inventory-not-captured': 'Cannot resolve: the channel bitmap was not captured',
  unreadable: 'Unreadable: the captured record is empty or invalid',
};

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
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const [selectedSlot, setSelectedSlot] = useState<number>();
  const rows = useMemo(() => lists.entries.map(scanRow), [lists]);
  if (lists.bitmap !== 'captured')
    return (
      <Alert title={NOT_CAPTURED} color="yellow">
        The scan list occupancy bitmap was not completely captured, so no scan list can be shown.
        This does not mean the radio has no scan lists.
      </Alert>
    );
  const selected = lists.entries.find((e) => e.slot === selectedSlot);
  const shown = rows.filter((r) =>
    matches(query, String(r.slot), r.label, r.memberText, r.priorityText),
  );
  return (
    <Stack gap="sm">
      <Text>
        Occupied {count(lists.occupied)} of {count(lists.capacity)} scan list slots · fully decoded{' '}
        {count(lists.decoded)} of {count(lists.occupied)} occupied
      </Text>
      <Text size="sm" c="dimmed">
        Name, member array and priority bytes decode independently, each only when its whole span
        was captured. Members keep radio order, duplicates included; a member index is zero-based
        and resolves to channel slot index + 1. Slots without a captured record are not proof of an
        unused list.
      </Text>
      {lists.outOfRangeBits.length > 0 && (
        <Alert color="yellow" title="Bitmap bits beyond the scan list range">
          Bits {lists.outOfRangeBits.join(', ')} are set above the {count(lists.capacity)} hardware
          scan lists and are not listed.
        </Alert>
      )}
      <DataTable
        caption="AT-D890UV scan lists"
        columns={scanColumns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search scan lists' }}
        sort={sort}
        onSortChange={setSort}
        onRowActivate={(r) => setSelectedSlot(r.slot)}
        emptyMessage="The scan list bitmap is captured and no scan list slot is occupied."
        filteredEmptyMessage={`No scan lists match “${query.trim()}”.`}
      />
      {selected ? (
        <ScanListDetails entry={selected} />
      ) : (
        <Text size="sm" c="dimmed">
          Select a scan list to see its priority channels and members (up to{' '}
          {AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX}).
        </Text>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const hexBytes = (bytes: readonly number[]) => bytes.map(hexByte).join(' ');

function valueText(f: AtD890SettingFieldView): string {
  if (f.status === 'not-captured') return NOT_CAPTURED;
  if (f.value === undefined)
    return f.valueLabel ? `${f.valueLabel} (read-only value)` : 'Unsupported value (see raw bytes)';
  if (typeof f.value === 'boolean') return f.value ? 'On' : 'Off';
  if (typeof f.value === 'string') return f.value === '' ? '(empty)' : f.value;
  return f.valueLabel ? `${f.valueLabel} (${f.value})` : String(f.value);
}

function addressText(f: AtD890SettingFieldView): string {
  const span = f.length > 1 ? `${hexAddress(f.address)} +${f.length}` : hexAddress(f.address);
  return f.mask === undefined ? span : `${span} mask 0x${hexByte(f.mask)}`;
}

export function SettingsPanel({ projection }: { projection: AtD890MemoryProjection }) {
  const settings = projection.settings;
  const [query, setQuery] = useState('');
  const [raw, setRaw] = useState(false);
  const groups = useMemo(
    () =>
      AT_D890_SETTINGS_GROUPS.map((g) => ({
        ...g,
        fields: settings.fields.filter((f) => f.group === g.id),
      })).filter((g) => g.id !== 'other' || g.fields.length > 0),
    [settings],
  );
  const searching = query.trim() !== '';
  const fieldMatches = (f: AtD890SettingFieldView, groupLabel: string) =>
    matches(
      query,
      f.label,
      f.id,
      f.help,
      groupLabel,
      valueText(f),
      f.raw ? hexBytes(f.raw) : '',
      addressText(f),
    );
  const unknownShown = settings.unknown.filter(
    (u) => !searching || matches(query, 'unknown', hexAddress(u.address), hexBytes(u.bytes)),
  );
  const aprsShown = settings.aprsRuns.filter(
    (r) => !searching || matches(query, 'aprs', hexAddress(r.address), hexBytes(r.bytes)),
  );
  return (
    <Stack gap="sm">
      <Text>
        {count(settings.counts.captured)} of {count(settings.counts.registered)} known setting
        fields captured · {count(settings.counts.decoded)} decoded to a known value
      </Text>
      <Text size="sm" c="dimmed">
        Each field is shown only when every byte of its own span was captured; missing bytes stay
        missing and are never filled with defaults. Meanings follow the stock settings layout
        documented for this radio; the bytes alone do not show which firmware is installed. Nothing
        here edits the radio. {count(settings.missingBytes)} bytes of the main and power-on settings
        blocks were not captured.
      </Text>
      <Stack gap="xs">
        <TextInput
          label="Search settings"
          placeholder="Search settings"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <Switch
          label="Show raw bytes + address"
          checked={raw}
          onChange={(e) => setRaw(e.currentTarget.checked)}
        />
      </Stack>
      {groups.map((g) => {
        const fields = g.fields.filter((f) => !searching || fieldMatches(f, g.label));
        if (searching && fields.length === 0 && g.id !== 'gps') return null;
        return (
          <Stack key={g.id} gap="xs" component="section" aria-label={g.label}>
            <Title order={4}>{g.label}</Title>
            {g.fields.length === 0 && g.id !== 'gps' && (
              <Text size="sm" c="dimmed">
                {g.id === 'scan'
                  ? 'No scan setting is established in the decoded settings fields; this is unavailable, not off. Scan lists are in their own tab.'
                  : 'No mod-feature setting interpretation is established, so none is decoded here. Captured bytes remain inspectable under Unknown bytes.'}
              </Text>
            )}
            {fields.length > 0 && (
              <Table.ScrollContainer minWidth={320}>
                <Table aria-label={`${g.label} settings`}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Setting</Table.Th>
                      <Table.Th>Value</Table.Th>
                      {raw && <Table.Th>Address</Table.Th>}
                      {raw && <Table.Th>Raw bytes</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {fields.map((f) => {
                      const showRaw = raw || (f.status === 'captured' && f.value === undefined);
                      return (
                        <Table.Tr key={f.id}>
                          <Table.Td>{f.label}</Table.Td>
                          <Table.Td>
                            {valueText(f)}
                            {f.conditional && (
                              <Text size="xs" c="dimmed">
                                {f.conditional}
                              </Text>
                            )}
                            {!raw && showRaw && f.raw && (
                              <Text size="xs" c="dimmed">
                                Raw {hexAddress(f.address)}: {hexBytes(f.raw)}
                              </Text>
                            )}
                          </Table.Td>
                          {raw && <Table.Td>{addressText(f)}</Table.Td>}
                          {raw && <Table.Td>{f.raw ? hexBytes(f.raw) : DASH}</Table.Td>}
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
            {g.id === 'gps' && (
              <Stack gap={2}>
                <Text size="sm" c="dimmed">
                  APRS settings bytes are shown raw only; no APRS field is decoded.
                </Text>
                {settings.aprsRuns.length === 0 ? (
                  <Text size="sm">APRS bytes: {NOT_CAPTURED}</Text>
                ) : (
                  aprsShown.map((r) => (
                    <Text size="sm" key={r.address} ff="monospace">
                      APRS {hexAddress(r.address)}: {hexBytes(r.bytes)}
                    </Text>
                  ))
                )}
              </Stack>
            )}
          </Stack>
        );
      })}
      <Stack gap="xs" component="section" aria-label="Unknown bytes">
        <Title order={4}>Unknown bytes</Title>
        <Text size="sm" c="dimmed">
          Captured bytes (or bits of a partly known byte) in the main and power-on settings blocks
          that no known field covers. They are unexplained, not zero.
        </Text>
        {unknownShown.length === 0 ? (
          <Text size="sm">
            {settings.unknown.length === 0
              ? 'No unexplained captured bytes.'
              : `No unknown bytes match “${query.trim()}”.`}
          </Text>
        ) : (
          unknownShown.map((u) => (
            <Text size="sm" key={u.address} ff="monospace">
              {hexAddress(u.address)}: {hexBytes(u.bytes)}
              {u.unclaimedMask === undefined
                ? ''
                : ` (unclaimed bits 0x${hexByte(u.unclaimedMask)})`}
            </Text>
          ))
        )}
      </Stack>
    </Stack>
  );
}
