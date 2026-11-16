import { Alert, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { decodeChannelsFromImage } from '@integrations/radio-io/radios/uv5r-mini/channelCodec.ts';
import { decodeUv5rMiniZoneTable } from '@integrations/radio-io/radios/uv5r-mini/modData/index.ts';
import { UV5R_MINI_LAYOUT } from '@integrations/radio-io/radios/uv17pro-family/layout.ts';
import { uv17ProBackupMemSpans } from '@integrations/radio-io/radios/uv17pro-family/backupRestoreRoles.ts';
import type { DebugArchive } from './captureArchive.ts';

/** Decode only data actually captured in a recognised region. */
export function Uv5rMiniMemory({ archive }: { archive?: DebugArchive }) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert title="No capture">Open or read a capture to inspect its memory.</Alert>
      </Stack>
    );
  return <Uv5rMiniMemoryLoaded archive={archive} />;
}

function Uv5rMiniMemoryLoaded({ archive }: { archive: DebugArchive }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<string | null>('slot');
  const mem = uv17ProBackupMemSpans(UV5R_MINI_LAYOUT)[0]!;
  const entry = archive.manifest.regions.find(
    (r) => r.id === mem.id && r.address === mem.packedOffset && r.byteLength <= mem.size,
  );
  const bytes = archive.regions.clone ?? (entry && archive.regions[entry.id]);
  const channels =
    bytes && bytes.length >= UV5R_MINI_LAYOUT.channelSpan
      ? decodeChannelsFromImage(bytes).filter((c) => !c.empty)
      : undefined;
  const sector =
    archive.regions.clone?.subarray(0xc000, 0xd000) ??
    (archive.manifest.regions.some(
      (r) => r.id === 'zones' && r.address === 0xc000 && r.byteLength === 0x1000,
    )
      ? archive.regions.zones
      : undefined);
  const zones = sector?.length === 0x1000 ? decodeUv5rMiniZoneTable(sector) : undefined;
  const shown = channels
    ?.filter((c) => c.wireName.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    .sort((a, b) =>
      sort === 'name'
        ? a.wireName.localeCompare(b.wireName) || a.slotIndex - b.slotIndex
        : a.slotIndex - b.slotIndex,
    );
  return (
    <Stack>
      <Title order={3}>Channels</Title>
      {!channels ? (
        <Alert title="Channels unavailable">A complete channel range is required.</Alert>
      ) : (
        <>
          <TextInput
            label="Search channels"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Select
            label="Sort channels"
            value={sort}
            onChange={setSort}
            data={[
              { value: 'slot', label: 'Slot' },
              { value: 'name', label: 'Name' },
            ]}
            allowDeselect={false}
          />
          <Table.ScrollContainer minWidth={500}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Slot</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>RX MHz</Table.Th>
                  <Table.Th>TX MHz</Table.Th>
                  <Table.Th>Bandwidth</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown?.map((c) => (
                  <Table.Tr key={c.slotIndex}>
                    <Table.Td>{c.slotIndex}</Table.Td>
                    <Table.Td>{c.wireName || '(unnamed)'}</Table.Td>
                    <Table.Td>{(c.rxHz / 1e6).toFixed(5)}</Table.Td>
                    <Table.Td>{(c.txHz / 1e6).toFixed(5)}</Table.Td>
                    <Table.Td>{c.bandwidth}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </>
      )}
      <Title order={3}>Zones</Title>
      {!zones ? (
        <Text>Zone table unavailable: the complete sector was not captured.</Text>
      ) : 'reject' in zones ? (
        <Text>Zone table missing or invalid: {zones.reject}. This does not identify firmware.</Text>
      ) : (
        zones.zones.map((zone, i) => (
          <div key={`${zone.name}-${i}`}>
            <Text fw={600}>{zone.name}</Text>
            <Text>
              {zone.slotIndexes
                .map((slot) => {
                  const channel = channels?.find((c) => c.slotIndex === slot + 1);
                  return `${slot + 1}: ${channel?.wireName || (channels ? '(missing channel)' : '(channel unavailable)')}`;
                })
                .join(', ') || 'No members'}
            </Text>
          </div>
        ))
      )}
    </Stack>
  );
}
