import { isRt95ChannelRecordReadable } from '@integrations/radio-io/radios/rt95/channelCodec.ts';
import { Alert, Badge, Checkbox, Group, Stack, Table, Text, Title } from '@mantine/core';
import {
  DataTable,
  type DataTableColumn,
  type DataTableSortState,
} from '@app/components/v2/index.ts';
import { useState } from 'react';
import {
  decodeRt95DebugSlots,
  type Rt95DebugSlot,
} from '@integrations/radio-io/radios/rt95/debugMemory.ts';
import { RT95_MMD1_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import {
  MMD1_BASE,
  MMD1_END,
  MMD1_STATE_ADDR,
} from '@integrations/radio-io/radios/rt95/modData/layout.ts';
import {
  decodeRt95Description,
  decodeRt95ModData,
  decodeRt95ZoneState,
  type Rt95ModDataValid,
} from '@integrations/radio-io/radios/rt95/modData/decode.ts';
import {
  RT95_KEY_TABLE_ADDR,
  RT95_KEY_TABLE_LENGTH,
  RT95_KEY_FUNCTION_DIR,
} from '@integrations/radio-io/radios/rt95/zoneKey.ts';
import { MemoryCategories } from './MemoryCategories.tsx';
import { rt95GuardEvidence, type DebugArchive } from './captureArchive.ts';

type SlotRow = Rt95DebugSlot & { description: string };

const columns: DataTableColumn<SlotRow>[] = [
  {
    key: 'slot',
    header: 'Slot',
    sortable: true,
    sortValue: (row) => row.slot,
    render: (row) => row.slot,
  },
  {
    key: 'occupancy',
    header: 'Occupancy',
    render: (row) => row.occupancy,
  },
  {
    key: 'name',
    header: 'Wire name',
    sortable: true,
    sortValue: (row) => row.name,
    render: (row) => (
      <>
        {row.name || (row.occupancy === 'occupied' ? '(unnamed)' : '—')}
        {row.description && <Text>{row.description} [body]</Text>}
      </>
    ),
  },
  ...(
    [
      ['rx', 'RX'],
      ['duplex', 'Duplex / offset'],
      ['tx', 'TX'],
      ['power', 'Power'],
      ['width', 'Width'],
      ['rxTone', 'RX tone'],
      ['txTone', 'TX tone'],
      ['scan', 'Scan'],
      ['toneSquelch', 'Tone squelch'],
      ['signalling', 'Optional signalling'],
      ['dtmf', 'DTMF index'],
      ['fiveTone', '5-Tone index'],
    ] as const
  ).map(([key, label]): DataTableColumn<SlotRow> => ({
    key,
    header: label,
    render: (row) => (row.occupancy === 'occupied' ? row[key] : '—'),
  })),
  {
    key: 'record',
    header: 'Record',
    render: (row) => (
      <details>
        <summary>Slot {row.slot} raw record</summary>
        <Text>
          Unresolved flags and bytes; raw evidence:{' '}
          {row.raw
            ? Array.from(row.raw, (b) => b.toString(16).padStart(2, '0')).join(' ')
            : 'Unavailable'}
        </Text>
      </details>
    ),
  },
];

type ZoneView = Rt95ModDataValid['zones'][number];

function Rt95ZoneBlock({ zone, slots }: { zone: ZoneView; slots: SlotRow[] }) {
  const title = `Zone ${zone.index + 1}: ${zone.name || '(unnamed)'}`;
  const members = zone.memberIndexes.map((index) => ({ index, slot: slots[index] }));
  const shown = members.filter(
    ({ slot }) =>
      slot !== undefined &&
      slot.occupancy === 'occupied' &&
      slot.raw !== undefined &&
      isRt95ChannelRecordReadable(slot.raw),
  );
  const hidden = members.filter((m) => !shown.includes(m));
  return (
    <Stack gap={4} data-testid={`rt95-zone-${zone.index + 1}`}>
      <Group gap="xs">
        <Text fw={600}>{title}</Text>
        <Badge variant="light">
          {zone.memberIndexes.length} {zone.memberIndexes.length === 1 ? 'member' : 'members'}
        </Badge>
        <Badge variant="light" color={zone.valid ? 'green' : 'red'}>
          {zone.valid ? 'members valid' : 'invalid member CRC'}
        </Badge>
      </Group>
      {!zone.valid ? null : zone.memberIndexes.length === 0 ? (
        <Text size="sm" c="dimmed">
          Empty zone.
        </Text>
      ) : (
        <>
          {shown.length > 0 && (
            <Table withTableBorder aria-label={`${title} members`}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Slot</Table.Th>
                  <Table.Th>Radio name / description</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown.map(({ index, slot }) => (
                  <Table.Tr key={index}>
                    <Table.Td>{index + 1}</Table.Td>
                    <Table.Td>
                      {[slot!.name || '(unnamed)', slot!.description].filter(Boolean).join(' ')}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {hidden.length > 0 && (
            <details>
              <summary>
                {hidden.length} {hidden.length === 1 ? 'member points' : 'members point'} at empty
                or unreadable slots
              </summary>
              <Text size="sm">
                Slots:{' '}
                {hidden
                  .map(
                    ({ index, slot }) =>
                      `${index + 1} (${slot && slot.occupancy === 'occupied' ? 'unreadable' : (slot?.occupancy ?? 'unavailable')})`,
                  )
                  .join(', ')}
              </Text>
            </details>
          )}
        </>
      )}
    </Stack>
  );
}

export function Rt95Memory({ archive }: { archive: DebugArchive }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSortState | null>({ key: 'slot', direction: 'asc' });
  const [showEmpty, setShowEmpty] = useState(false);
  const bytes = archive.regions[RT95_MMD1_REGION_ID];
  const guard = rt95GuardEvidence(archive);
  const cloneRegion = archive.manifest.regions.find((r) => r.id === 'programming-image');
  const clone = archive.regions['programming-image'];
  const at = (address: number, length: number) => {
    if (
      !clone ||
      !cloneRegion ||
      address < cloneRegion.address ||
      address + length > cloneRegion.address + clone.length
    )
      return undefined;
    return clone.subarray(address - cloneRegion.address, address - cloneRegion.address + length);
  };
  const readBlock = (address: number) =>
    bytes && address >= MMD1_BASE && address + 16 <= MMD1_BASE + bytes.length
      ? bytes.subarray(address - MMD1_BASE, address - MMD1_BASE + 16)
      : undefined;
  const decoded = bytes ? decodeRt95ModData(readBlock) : undefined;
  const header = readBlock(MMD1_BASE);
  const slots = decodeRt95DebugSlots(clone, cloneRegion?.address ?? 0).map((slot) => {
    const description =
      guard?.ok && decoded?.status === 'valid' && slot.occupancy === 'occupied'
        ? decodeRt95Description(readBlock, decoded, slot.slot - 1, slot.raw)
        : undefined;
    return { ...slot, description: description && 'text' in description ? description.text : '' };
  });
  const visibleSlots = slots.filter((slot) => showEmpty || slot.occupancy !== 'empty');
  const shown = visibleSlots.filter((slot) =>
    `${slot.slot} ${slot.name} ${slot.description}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const keys = at(RT95_KEY_TABLE_ADDR, RT95_KEY_TABLE_LENGTH);
  const state =
    decoded?.status === 'valid'
      ? decodeRt95ZoneState(readBlock(MMD1_STATE_ADDR), decoded)
      : undefined;
  const channelsPanel = (
    <Stack>
      <Title order={4}>Clone channels</Title>
      <Text size="sm" c="dimmed">
        Clone image: the storage MCU is not documented. Descriptions come from MMD1 data (main
        board).
      </Text>
      <Checkbox
        label="Show empty slots"
        checked={showEmpty}
        onChange={(event) => setShowEmpty(event.currentTarget.checked)}
      />
      <DataTable
        caption="RT95 clone channels"
        columns={columns}
        rows={shown}
        getRowId={(slot) => String(slot.slot)}
        search={{ value: query, onChange: setQuery, placeholder: 'Search channels' }}
        sort={sort}
        onSortChange={setSort}
        totalRowCount={visibleSlots.length}
        emptyMessage="No channel slots to show."
        filteredEmptyMessage={`No channels match “${query.trim()}”.`}
      />
    </Stack>
  );
  const zonesPanel = (
    <Stack>
      <Title order={4}>MMD1 zones</Title>
      <Text size="sm" c="dimmed">
        MMD1 data: main board.
      </Text>
      <Text>
        Body EEPROM is reached through the head; it can return checksum-valid zeros without a body
        reply. Running firmware, release and modification status remain unknown.
      </Text>
      {!guard ? (
        <Alert>Guard evidence unverified [body].</Alert>
      ) : !guard.ok ? (
        <Alert>Guard refused MMD1 capture: {guard.reason} [body].</Alert>
      ) : (
        <Text>Chip guard verified from recorded probe blocks [body].</Text>
      )}
      {!bytes ? (
        <Text>MMD1 not captured [body].</Text>
      ) : (
        <>
          {header && (
            <Text>
              Header [body] · magic{' '}
              {Array.from(header.subarray(0, 4), (v) =>
                v >= 32 && v <= 126 ? String.fromCharCode(v) : '.',
              ).join('')}{' '}
              · version {header[4]} · zone count {header[5]} · flags 0x
              {header[6]!.toString(16).padStart(2, '0')} · zone generation{' '}
              {header[8]! | (header[9]! << 8)} · description generation{' '}
              {header[10]! | (header[11]! << 8)}
            </Text>
          )}
          {decoded?.status !== 'valid' ? (
            <Alert>
              Header {decoded?.status === 'absent' ? 'blank or absent' : 'invalid'}:{' '}
              {decoded?.reason} [body].
            </Alert>
          ) : (
            <>
              <Text>
                Header valid [body].{' '}
                {guard?.ok &&
                bytes.length === MMD1_END - MMD1_BASE &&
                decoded.zones.every((zone) => zone.valid)
                  ? 'MM9PDY-compatible data present.'
                  : ''}
              </Text>
              <Text size="sm" c="dimmed">
                The RT95 record has no callsign field. The MM9PDY target writes the channel's
                callsign into the radio name when it has one, so the first column may be a callsign.
              </Text>
              {decoded.zones.map((zone) => (
                <Rt95ZoneBlock key={zone.index} zone={zone} slots={slots} />
              ))}
              {state?.valid ? (
                <>
                  <Text>ZST1 selection A [body]: {state.sideA}</Text>
                  <Text>ZST1 selection B [body]: {state.sideB}</Text>
                </>
              ) : (
                <Text>ZST1 state [body]: invalid or unavailable ({state?.reason})</Text>
              )}
            </>
          )}
        </>
      )}
    </Stack>
  );
  const pKeysPanel = (
    <Stack>
      <Title order={4}>P-keys</Title>
      <Text size="sm" c="dimmed">
        Clone image: the storage MCU is not documented.
      </Text>
      {keys ? (
        Array.from(keys, (value, i) => (
          <Text key={i}>
            Group {Math.floor(i / 6) + 1} key {(i % 6) + 1}: 0x
            {value.toString(16).padStart(2, '0')}{' '}
            {value === RT95_KEY_FUNCTION_DIR ? '· DIR; used as ZON by compatible firmware.' : ''}
          </Text>
        ))
      ) : (
        <Text>P-key bytes unavailable.</Text>
      )}
    </Stack>
  );
  return (
    <MemoryCategories
      storageKey="debug-memory-category:rt95"
      categories={[
        { value: 'channels', label: 'Channels', count: shown.length, render: () => channelsPanel },
        { value: 'zones', label: 'Zones', render: () => zonesPanel },
        { value: 'p-keys', label: 'P-keys', render: () => pKeysPanel },
      ]}
    />
  );
}

/** The RT95 Memory tab: the clone channels, MMD1 zones and P-keys, plus what is not decoded yet. */
export function Rt95MemoryView({ archive }: { archive?: DebugArchive }) {
  return (
    <Stack>
      <Title order={3}>Memory</Title>
      {!archive && <Alert title="No capture">Open or read a capture to inspect its memory.</Alert>}
      {archive && <Rt95Memory archive={archive} />}
      {['Scan lists', 'Contacts', 'Talk groups'].map((section) => (
        <Text key={section}>{section}: not decoded for this radio yet.</Text>
      ))}
    </Stack>
  );
}
