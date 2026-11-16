import { Alert, Stack, Tabs, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
} from '@app/components/v2/index.ts';
import type { RadioChannelDto, RadioTone } from '@integrations/radio-io/radioChannelDto.ts';
import {
  buildDm32SparseCapture,
  projectDm32Memory,
  type Dm32ChannelEntry,
  type Dm32ChannelInventory,
} from '@integrations/radio-io/radios/dm32uv/debugMemory.ts';
import {
  projectDm32MemoryLists,
  type Dm32ScanListInventory,
} from '@integrations/radio-io/radios/dm32uv/debugMemoryZones.ts';
import { projectDm32Lists } from '@integrations/radio-io/radios/dm32uv/debugMemoryLists.ts';
import { ContactsPanel, RadioIdsPanel, TalkGroupsPanel } from './Dm32MemoryLists.tsx';
import { ScanListsPanel, ZonesPanel } from './Dm32MemoryZones.tsx';
import { archiveKey } from './viewerUtils.ts';
import type { DebugArchive } from './captureArchive.ts';

const MODEL_ID = 'DM-32UV';
const NOT_CAPTURED = 'Not captured';
const DASH = '—';

const count = (n: number) => n.toLocaleString('en-GB');
const mhz = (hz: number) => (hz / 1e6).toFixed(5);
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

function formatTone(tone: RadioTone): string {
  if (tone.kind === 'ctcss') return `${tone.hz} Hz`;
  if (tone.kind === 'dcs') return `D${String(tone.code).padStart(3, '0')}${tone.polarity ?? 'N'}`;
  return 'None';
}

const MODE_LABEL: Record<NonNullable<RadioChannelDto['mode']>, string> = {
  analog: 'Analogue',
  digital: 'Digital',
  'fixed-analog': 'A+D (TX A)',
  'fixed-digital': 'D+A (TX D)',
};

interface ChannelRow {
  id: string;
  slot: number;
  entry: Dm32ChannelEntry;
  /** The complete identity text: sorted, searched and shown. */
  label: string;
  note?: string;
}

function channelRow(entry: Dm32ChannelEntry): ChannelRow {
  const base = { id: `channel-${entry.slot}`, slot: entry.slot, entry };
  const state = entry.state;
  if (state.kind === 'decoded') return { ...base, label: state.channel.wireName || '(unnamed)' };
  if (state.kind === 'empty')
    return { ...base, label: 'Empty slot', note: 'All 48 bytes are 0xFF (erased)' };
  if (state.kind === 'blank')
    return {
      ...base,
      label: 'Blank record',
      note: `No name and no RX frequency · ${hex(state.raw)}`,
    };
  return { ...base, label: NOT_CAPTURED, note: state.reason };
}

function decoded(row: ChannelRow) {
  return row.entry.state.kind === 'decoded' ? row.entry.state : undefined;
}

function frequencyCell(row: ChannelRow, which: 'rx' | 'tx') {
  const state = decoded(row);
  if (!state) return DASH;
  const { flags, channel } = state;
  if (which === 'rx')
    return flags.rxInvalidBcd ? `Invalid BCD (${hex(flags.rxRaw)})` : mhz(channel.rxHz);
  if (flags.noTxStored) return 'No TX frequency stored';
  return flags.txInvalidBcd ? `Invalid BCD (${hex(flags.txRaw)})` : mhz(channel.txHz);
}

function flagsText(c: RadioChannelDto, modeByte: number): string {
  return [
    `Mode byte 0x${modeByte.toString(16).toUpperCase().padStart(2, '0')}`,
    c.rxOnly ? 'RX only' : '',
    c.scanAdd ? 'Auto scan' : '',
  ]
    .filter(Boolean)
    .join(', ');
}

function cell(row: ChannelRow, value: (c: RadioChannelDto) => string | number | undefined) {
  const state = decoded(row);
  if (!state) return DASH;
  return value(state.channel) ?? DASH;
}

const digital = (c: RadioChannelDto) => c.mode !== undefined && c.mode !== 'analog';

/** A channel's raw scan list id resolved against the scan lists of the same capture. */
function scanListText(id: number | undefined, scanLists: Dm32ScanListInventory): string {
  if (id == null || id === 0) return 'None';
  if (scanLists.status !== 'captured') return `${id} (raw; scan lists not captured)`;
  const state = scanLists.entries[id - 1]?.state;
  if (state?.kind !== 'decoded') return `${id} (absent)`;
  return `${id}: ${state.name || '(unnamed)'}`;
}

function channelColumns(scanLists: Dm32ScanListInventory): DataTableColumn<ChannelRow>[] {
  return [
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
      key: 'rx',
      header: 'RX MHz',
      width: '8rem',
      sortable: true,
      sortValue: (r) => {
        const s = decoded(r);
        return s && !s.flags.rxInvalidBcd ? s.channel.rxHz : null;
      },
      render: (r) => frequencyCell(r, 'rx'),
    },
    {
      key: 'tx',
      header: 'TX MHz',
      width: '8rem',
      sortable: true,
      sortValue: (r) => {
        const s = decoded(r);
        return s && !s.flags.noTxStored && !s.flags.txInvalidBcd ? s.channel.txHz : null;
      },
      render: (r) => frequencyCell(r, 'tx'),
    },
    {
      key: 'mode',
      header: 'Mode',
      width: '7rem',
      sortable: true,
      sortValue: (r) => decoded(r)?.channel.mode ?? null,
      render: (r) => cell(r, (c) => (c.mode ? MODE_LABEL[c.mode] : undefined)),
    },
    { key: 'bw', header: 'Bandwidth', width: '6rem', render: (r) => cell(r, (c) => c.bandwidth) },
    {
      key: 'power',
      header: 'Power',
      width: '5rem',
      render: (r) => cell(r, (c) => (c.powerPercent == null ? 'Default' : `${c.powerPercent}%`)),
    },
    {
      key: 'rxTone',
      header: 'RX tone',
      width: '6rem',
      render: (r) => cell(r, (c) => formatTone(c.rxTone)),
    },
    {
      key: 'txTone',
      header: 'TX tone',
      width: '6rem',
      render: (r) => cell(r, (c) => formatTone(c.txTone)),
    },
    {
      key: 'cc',
      header: 'CC',
      width: '3.5rem',
      render: (r) => cell(r, (c) => (digital(c) ? c.colorCode : undefined)),
    },
    {
      key: 'ts',
      header: 'Slot (TS)',
      width: '4.5rem',
      render: (r) => cell(r, (c) => (digital(c) ? c.timeslot : undefined)),
    },
    {
      key: 'scan',
      header: 'Scan list',
      width: '6rem',
      render: (r) => cell(r, (c) => scanListText(c.scanListId, scanLists)),
    },
    {
      key: 'rxGroup',
      header: 'RX group',
      width: '6rem',
      render: (r) => cell(r, (c) => (digital(c) ? `${c.rxGroupIndex ?? 0} (raw)` : undefined)),
    },
    {
      key: 'txContact',
      header: 'TX contact',
      width: '7rem',
      render: (r) =>
        decoded(r)
          ? r.entry.txContactIndex === undefined
            ? NOT_CAPTURED
            : r.entry.txContactIndex === 0
              ? 'None (0)'
              : `${r.entry.txContactIndex} (raw)`
          : DASH,
    },
    {
      key: 'flags',
      header: 'Flags',
      width: 'minmax(10rem, 1.5fr)',
      render: (r) => {
        const s = decoded(r);
        return s ? flagsText(s.channel, s.flags.modeByte) : DASH;
      },
    },
  ];
}

const matches = (query: string, ...haystack: string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

function ChannelsPanel({
  channels,
  scanLists,
}: {
  channels: Dm32ChannelInventory;
  scanLists: Dm32ScanListInventory;
}) {
  const columns = useMemo(() => channelColumns(scanLists), [scanLists]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const rows = useMemo(() => channels.entries.map(channelRow), [channels]);
  if (channels.status !== 'captured')
    return (
      <Alert
        title={channels.status === 'not-captured' ? NOT_CAPTURED : 'Page order not established'}
        color="yellow"
      >
        {channels.reason} This does not mean the radio has no channels.
      </Alert>
    );
  const shown = rows.filter((r) => {
    const s = decoded(r);
    return matches(
      query,
      String(r.slot),
      String(r.slot).padStart(3, '0'),
      r.label,
      s && !s.flags.rxInvalidBcd ? `${mhz(s.channel.rxHz)} ${mhz(s.channel.txHz)}` : '',
    );
  });
  return (
    <Stack gap="sm">
      <Text>
        The radio states {count(channels.declaredCount ?? 0)} channels ·{' '}
        {count(channels.entries.length)} listed of {count(channels.capacity)} hardware slots ·
        decoded {count(channels.decoded)} · empty {count(channels.empty)} · blank{' '}
        {count(channels.blank)} · not captured {count(channels.notCaptured)}
      </Text>
      <Text size="sm" c="dimmed">
        Slots without a captured record are listed as not captured; a missing capture does not mean
        a slot is unused. Each identity is the radio&apos;s single name field, shown complete
        including any callsign; separate callsign and name data is unavailable. The scan list
        resolves against the scan lists of this capture; RX group and TX contact are raw numbers,
        not resolved yet.
        {!channels.txContactBlocks.low || !channels.txContactBlocks.high
          ? ' Some TX contact pages were not captured.'
          : ''}
      </Text>
      {channels.excess > 0 && (
        <Alert color="yellow" title="Count above hardware capacity">
          The stored count claims {count(channels.excess)} slots above the{' '}
          {count(channels.capacity)} hardware slots; they are not listed.
        </Alert>
      )}
      <DataTable
        caption="DM-32UV memory channels"
        columns={columns}
        rows={shown}
        getRowId={(r) => r.id}
        totalRowCount={rows.length}
        search={{ value: query, onChange: setQuery, placeholder: 'Search channels' }}
        sort={sort}
        onSortChange={setSort}
        stickyFirstColumn
        mobileIdentity={(r) => (
          <span>
            {r.slot} · <strong>{r.label}</strong>
          </span>
        )}
        mobileIdentityLabel="Slot · identity"
        emptyMessage="The channel count was captured and the radio states no channels."
        filteredEmptyMessage={`No channels match “${query.trim()}”.`}
      />
    </Stack>
  );
}

const PLACEHOLDERS: { value: string; label: string; piece: string }[] = [
  { value: 'rx-groups', label: 'RX groups', piece: 'a later piece' },
  { value: 'settings', label: 'Settings', piece: 'a later piece' },
];

/** Read-only DM-32UV Memory viewer. Replacing the archive resets rows, search and sort. */
export function Dm32Memory({ archive }: { archive?: DebugArchive }) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert title="No capture">Open or read a capture to inspect its memory.</Alert>
      </Stack>
    );
  return <Dm32MemoryLoaded key={archiveKey(archive)} archive={archive} />;
}

function Dm32MemoryLoaded({ archive }: { archive: DebugArchive }) {
  const projection = useMemo(
    () =>
      archive.manifest.radioModelId === MODEL_ID
        ? projectDm32MemoryLists(projectDm32Memory(buildDm32SparseCapture(archive)))
        : undefined,
    [archive],
  );
  if (!projection)
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert color="red" title="Not a DM-32UV capture">
          This archive is for {archive.manifest.radioModelId}; nothing is decoded.
        </Alert>
      </Stack>
    );
  const { capture } = projection;
  const lists = projectDm32Lists(capture);
  return (
    <Stack>
      <Title order={3}>Memory</Title>
      <Text size="sm" c="dimmed">
        Read-only inventory decoded from captured bytes · radio slot order preserved. Nothing is
        imported into a library or build. Not validated on hardware.
      </Text>
      <Text size="sm">
        {capture.blocks.size} whole 4 KiB blocks accepted ·{' '}
        {capture.discovery
          ? 'page order from the discovery map'
          : 'no discovery map recorded, so page order is not established'}
      </Text>
      {capture.refused.length > 0 && (
        <Alert color="yellow" title={`${capture.refused.length} archive entries refused`}>
          {capture.refused.map((r) => (
            <Text size="sm" key={r.id}>
              {r.id}: {r.reason}
            </Text>
          ))}
        </Alert>
      )}
      <Tabs defaultValue="channels" keepMounted={false}>
        <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          <Tabs.Tab value="channels">Channels</Tabs.Tab>
          <Tabs.Tab value="zones">Zones</Tabs.Tab>
          <Tabs.Tab value="scan-lists">Scan lists</Tabs.Tab>
          <Tabs.Tab value="talk-groups">Talk groups</Tabs.Tab>
          <Tabs.Tab value="radio-ids">Radio IDs</Tabs.Tab>
          <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
          {PLACEHOLDERS.map((p) => (
            <Tabs.Tab key={p.value} value={p.value}>
              {p.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="channels" pt="md">
          <ChannelsPanel channels={projection.channels} scanLists={projection.scanLists} />
        </Tabs.Panel>
        <Tabs.Panel value="zones" pt="md">
          <ZonesPanel zones={projection.zones} />
        </Tabs.Panel>
        <Tabs.Panel value="scan-lists" pt="md">
          <ScanListsPanel scanLists={projection.scanLists} />
        </Tabs.Panel>
        <Tabs.Panel value="talk-groups" pt="md">
          <TalkGroupsPanel talkGroups={lists.talkGroups} />
        </Tabs.Panel>
        <Tabs.Panel value="radio-ids" pt="md">
          <RadioIdsPanel radioIds={lists.radioIds} />
        </Tabs.Panel>
        <Tabs.Panel value="contacts" pt="md">
          <ContactsPanel contacts={lists.analogContacts} />
        </Tabs.Panel>
        {PLACEHOLDERS.map((p) => (
          <Tabs.Panel key={p.value} value={p.value} pt="md">
            <Alert title="Not yet available">
              {p.label} are not decoded yet; they arrive in {p.piece}.
            </Alert>
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  );
}
