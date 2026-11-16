import { isRt95ChannelRecordReadable } from '@integrations/radio-io/radios/rt95/channelCodec.ts';
import { Alert, Badge, Checkbox, Group, Stack, Table, Text, Title } from '@mantine/core';
import type { DataTableColumn } from '@app/components/v2/index.ts';
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
import {
  identityLabel,
  MemoryCategories,
  MemoryCategoryPanel,
} from '@app/components/debug/index.ts';
import { RT95_CHANNEL_COUNT } from '@integrations/radio-io/radios/rt95/constants.ts';
import {
  RT95_CHANNEL_CAVEAT,
  RT95_CHANNELS_EMPTY,
  RT95_PKEY_CAVEAT,
  RT95_PKEY_DIR_MEANING,
  RT95_PKEYS_PROVENANCE,
  RT95_PKEYS_UNAVAILABLE,
  RT95_ZONE_CAVEAT,
  RT95_ZONES_EMPTY,
  RT95_ZONES_PROVENANCE,
  rt95PKeySummary,
  rt95ZoneSummary,
  rt95ChannelSummary,
  rt95SlotIdentityFallback,
  RT95_SLOT_RAW_UNAVAILABLE,
  RT95_ZONES_BODY_CAVEAT,
  rt95SlotDetailsText,
} from '@integrations/radio-io/radios/rt95/debugMemoryText.ts';
import { rt95GuardEvidence, type DebugArchive } from './captureArchive.ts';

type SlotRow = Rt95DebugSlot & { description: string; label: string };

const slotHex = (raw: Uint8Array | undefined) =>
  raw
    ? Array.from(raw, (b) => b.toString(16).padStart(2, '0')).join(' ')
    : RT95_SLOT_RAW_UNAVAILABLE;

const columns: DataTableColumn<SlotRow>[] = [
  {
    key: 'slot',
    header: 'Slot',
    width: '4.5rem',
    sortable: true,
    sortValue: (row) => row.slot,
    render: (row) => row.slot,
    hideOnMobile: true,
  },
  {
    key: 'identity',
    header: 'Identity',
    width: 'minmax(12rem, 2fr)',
    sortable: true,
    sortValue: (row) => row.label,
    render: (row) => <strong>{row.label}</strong>,
    hideOnMobile: true,
  },
  {
    key: 'description',
    header: 'Description',
    width: 'minmax(10rem, 1.5fr)',
    render: (row) => (row.description ? <Text>{row.description} [body]</Text> : '—'),
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
];

type ZoneView = Rt95ModDataValid['zones'][number];

interface ZoneRow {
  id: string;
  zone: ZoneView;
  label: string;
}

const zoneColumns: DataTableColumn<ZoneRow>[] = [
  {
    key: 'zone',
    header: 'Zone',
    width: '5rem',
    sortable: true,
    sortValue: (r) => r.zone.index,
    render: (r) => r.zone.index + 1,
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
    sortValue: (r) => r.zone.memberIndexes.length,
    render: (r) => r.zone.memberIndexes.length,
  },
  {
    key: 'valid',
    header: 'Member check',
    width: '10rem',
    render: (r) => (r.zone.valid ? 'Members valid' : 'Invalid member CRC'),
  },
];

interface PKeyRow {
  id: string;
  index: number;
  value: number;
}

const pKeyColumns: DataTableColumn<PKeyRow>[] = [
  {
    key: 'group',
    header: 'Group',
    width: '5rem',
    sortable: true,
    sortValue: (r) => r.index,
    render: (r) => Math.floor(r.index / 6) + 1,
  },
  { key: 'key', header: 'Key', width: '5rem', render: (r) => (r.index % 6) + 1 },
  {
    key: 'value',
    header: 'Byte',
    width: '6rem',
    render: (r) => `0x${r.value.toString(16).padStart(2, '0')}`,
  },
  {
    key: 'meaning',
    header: 'Meaning',
    width: 'minmax(14rem, 2fr)',
    render: (r) => (r.value === RT95_KEY_FUNCTION_DIR ? RT95_PKEY_DIR_MEANING : ''),
  },
];

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
                      {slot!.name || '(unnamed)'}
                      {slot!.description ? (
                        <Text span c="dimmed">
                          {' '}
                          · {slot!.description}
                        </Text>
                      ) : null}
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

export function Rt95Memory({
  archive,
  notDecoded,
}: {
  archive: DebugArchive;
  notDecoded?: readonly string[];
}) {
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
    return {
      ...slot,
      description: description && 'text' in description ? description.text : '',
      label: identityLabel(undefined, slot.name) || rt95SlotIdentityFallback(slot.occupancy),
    };
  });
  const visibleSlots = slots.filter((slot) => showEmpty || slot.occupancy !== 'empty');
  const keys = at(RT95_KEY_TABLE_ADDR, RT95_KEY_TABLE_LENGTH);
  const state =
    decoded?.status === 'valid'
      ? decodeRt95ZoneState(readBlock(MMD1_STATE_ADDR), decoded)
      : undefined;
  const channelsPanel = (
    <Stack>
      <Checkbox
        label="Show empty slots"
        checked={showEmpty}
        onChange={(event) => setShowEmpty(event.currentTarget.checked)}
      />
      <MemoryCategoryPanel
        summary={rt95ChannelSummary(visibleSlots.length, RT95_CHANNEL_COUNT, showEmpty)}
        caveat={RT95_CHANNEL_CAVEAT}
        searchPlaceholder="Search channels"
        caption="RT95 clone channels"
        columns={columns}
        rows={visibleSlots}
        getRowId={(slot) => String(slot.slot)}
        searchText={(slot) =>
          `${slot.slot} ${slot.label} ${slot.description} ${slot.rx} ${slot.tx}`
        }
        defaultSort={{ key: 'slot', direction: 'asc' }}
        stickyFirstColumn
        mobileIdentity={(slot) => (
          <span>
            {slot.slot} · <strong>{slot.label}</strong>
          </span>
        )}
        mobileIdentityLabel="Slot · identity"
        details={(slot) => (
          <Text size="sm">{rt95SlotDetailsText(slot.slot, slotHex(slot.raw))}</Text>
        )}
        emptyMessage={RT95_CHANNELS_EMPTY}
      />
    </Stack>
  );
  const zonesPanel = (
    <Stack>
      <Title order={4}>MMD1 zones</Title>
      <Text size="sm" c="dimmed">
        {RT95_ZONES_PROVENANCE}
      </Text>
      <Text>{RT95_ZONES_BODY_CAVEAT}</Text>
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
              <MemoryCategoryPanel
                summary={rt95ZoneSummary(
                  decoded.zones.length,
                  decoded.zones.filter((zone) => zone.valid).length,
                )}
                caveat={RT95_ZONE_CAVEAT}
                searchPlaceholder="Search zones"
                caption="RT95 MMD1 zones"
                columns={zoneColumns}
                rows={decoded.zones.map((zone) => ({
                  id: `zone-${zone.index + 1}`,
                  zone,
                  label: zone.name || '(unnamed)',
                }))}
                getRowId={(r) => r.id}
                searchText={(r) =>
                  `${r.zone.index + 1} ${r.label} ${r.zone.memberIndexes
                    .map((i) => `${slots[i]?.label ?? ''} ${slots[i]?.description ?? ''}`)
                    .join(' ')}`
                }
                defaultSort={{ key: 'zone', direction: 'asc' }}
                details={(r) => <Rt95ZoneBlock zone={r.zone} slots={slots} />}
                emptyMessage={RT95_ZONES_EMPTY}
              />
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
        {RT95_PKEYS_PROVENANCE}
      </Text>
      {keys ? (
        <MemoryCategoryPanel
          summary={rt95PKeySummary(keys.length, Math.ceil(keys.length / 6))}
          caveat={RT95_PKEY_CAVEAT}
          searchPlaceholder="Search P-keys"
          caption="RT95 P-keys"
          columns={pKeyColumns}
          rows={Array.from(keys, (value, index) => ({ id: `pkey-${index}`, index, value }))}
          getRowId={(r) => r.id}
          searchText={(r) =>
            `${Math.floor(r.index / 6) + 1} ${(r.index % 6) + 1} ${r.value.toString(16)} ${
              r.value === RT95_KEY_FUNCTION_DIR ? RT95_PKEY_DIR_MEANING : ''
            }`
          }
          defaultSort={{ key: 'group', direction: 'asc' }}
        />
      ) : (
        <Text>{RT95_PKEYS_UNAVAILABLE}</Text>
      )}
    </Stack>
  );
  return (
    <MemoryCategories
      notDecoded={notDecoded}
      storageKey="debug-memory-category:rt95"
      categories={[
        {
          value: 'channels',
          label: 'Channels',
          count: visibleSlots.length,
          render: () => channelsPanel,
        },
        { value: 'zones', label: 'Zones', render: () => zonesPanel },
        { value: 'p-keys', label: 'P-keys', render: () => pKeysPanel },
      ]}
    />
  );
}

/** The RT95 Memory tab: the clone channels, MMD1 zones and P-keys. */
export function Rt95MemoryView({
  archive,
  notDecoded,
}: {
  archive?: DebugArchive;
  notDecoded?: readonly string[];
}) {
  return (
    <Stack>
      <Title order={3}>Memory</Title>
      {!archive && <Alert title="No capture">Open or read a capture to inspect its memory.</Alert>}
      {archive && <Rt95Memory archive={archive} notDecoded={notDecoded} />}
    </Stack>
  );
}
