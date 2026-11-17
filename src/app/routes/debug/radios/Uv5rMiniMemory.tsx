import { Alert, Badge, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useMemo } from 'react';
import type { DataTableColumn } from '@app/components/v2/index.ts';
import {
  identityLabel,
  MemoryCategories,
  MemoryCategoryPanel,
} from '@app/components/debug/index.ts';
import type { RadioChannelDto, RadioTone } from '@integrations/radio-io/radioChannelDto.ts';
import {
  UV5R_MINI_CHANNEL_CAVEAT,
  UV5R_MINI_CHANNELS_CAPTION,
  UV5R_MINI_CHANNELS_EMPTY,
  UV5R_MINI_CHANNELS_UNAVAILABLE,
  UV5R_MINI_ZONE_CAVEAT,
  UV5R_MINI_ZONE_NO_MEMBERS,
  UV5R_MINI_ZONES_CAPTION,
  UV5R_MINI_ZONES_EMPTY,
  UV5R_MINI_ZONES_UNAVAILABLE,
  uv5rMiniZoneHiddenMember,
  uv5rMiniZoneHiddenSummary,
  uv5rMiniZoneMembersLabel,
  uv5rMiniZonesInvalid,
  uv5rMiniZoneSummary,
  uv5rMiniChannelSummary,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/memoryText.ts';
import { decodeChannelsFromImage } from '@integrations/radio-io/radios/uv5r-mini/channelCodec.ts';
import { decodeUv5rMiniZoneTable } from '@integrations/radio-io/radios/uv5r-mini/modData/index.ts';
import { UV5R_MINI_LAYOUT } from '@integrations/radio-io/radios/uv17pro-family/layout.ts';
import { uv17ProBackupMemSpans } from '@integrations/radio-io/radios/uv17pro-family/backupRestoreRoles.ts';
import type { DebugArchive } from './captureArchive.ts';

const mhz = (hz: number) => (hz / 1e6).toFixed(5);

function formatTone(tone: RadioTone): string {
  if (tone.kind === 'ctcss') return `${tone.hz} Hz`;
  if (tone.kind === 'dcs') return `D${String(tone.code).padStart(3, '0')}${tone.polarity ?? 'N'}`;
  return 'None';
}

interface ChannelRow {
  id: string;
  slot: number;
  /** Callsign first, then name; the Mini stores one name field, so this is the name. */
  label: string;
  channel: RadioChannelDto;
}

function channelRow(channel: RadioChannelDto): ChannelRow {
  return {
    id: `channel-${channel.slotIndex}`,
    slot: channel.slotIndex,
    label: identityLabel(undefined, channel.wireName) || '(unnamed)',
    channel,
  };
}

const CHANNEL_COLUMNS: DataTableColumn<ChannelRow>[] = [
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
    render: (r) => <strong>{r.label}</strong>,
    hideOnMobile: true,
  },
  {
    key: 'rx',
    header: 'RX MHz',
    width: '8rem',
    sortable: true,
    sortValue: (r) => r.channel.rxHz,
    render: (r) => mhz(r.channel.rxHz),
  },
  {
    key: 'tx',
    header: 'TX MHz',
    width: '8rem',
    sortable: true,
    sortValue: (r) => r.channel.txHz,
    render: (r) => mhz(r.channel.txHz),
  },
  { key: 'bw', header: 'Bandwidth', width: '6rem', render: (r) => r.channel.bandwidth },
];

type ZoneView = Extract<
  ReturnType<typeof decodeUv5rMiniZoneTable>,
  { zones: unknown }
>['zones'][number];

interface ZoneRow {
  id: string;
  index: number;
  zone: ZoneView;
}

const zoneLabel = (r: ZoneRow) => r.zone.name || '(unnamed)';

const ZONE_COLUMNS: DataTableColumn<ZoneRow>[] = [
  {
    key: 'zone',
    header: 'Zone',
    width: '5rem',
    sortable: true,
    sortValue: (r) => r.index,
    render: (r) => r.index + 1,
  },
  {
    key: 'name',
    header: 'Name',
    width: 'minmax(12rem, 2fr)',
    sortable: true,
    sortValue: zoneLabel,
    render: (r) => <strong>{zoneLabel(r)}</strong>,
  },
  {
    key: 'members',
    header: 'Members',
    width: '7rem',
    sortable: true,
    sortValue: (r) => r.zone.slotIndexes.length,
    render: (r) => r.zone.slotIndexes.length,
  },
];

function Uv5rMiniZoneBlock({
  row,
  channels,
}: {
  row: ZoneRow;
  channels: readonly RadioChannelDto[] | undefined;
}) {
  const title = `Zone ${row.index + 1}: ${zoneLabel(row)}`;
  const members = row.zone.slotIndexes.map((slot) => ({
    slot: slot + 1,
    channel: channels?.find((c) => c.slotIndex === slot + 1),
  }));
  const shown = members.filter((m) => m.channel !== undefined);
  const hidden = members.filter((m) => m.channel === undefined);
  return (
    <Stack gap={4} data-testid={`uv5r-mini-zone-${row.index + 1}`}>
      <Group gap="xs">
        <Text fw={600}>{title}</Text>
        <Badge variant="light">{uv5rMiniZoneMembersLabel(members.length)}</Badge>
      </Group>
      {members.length === 0 ? (
        <Text size="sm" c="dimmed">
          {UV5R_MINI_ZONE_NO_MEMBERS}
        </Text>
      ) : (
        <>
          {shown.length > 0 && (
            <Table withTableBorder aria-label={`${title} members`}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Slot</Table.Th>
                  <Table.Th>Identity</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown.map(({ slot, channel }) => (
                  <Table.Tr key={slot}>
                    <Table.Td>{slot}</Table.Td>
                    <Table.Td>
                      {identityLabel(undefined, channel!.wireName) || '(unnamed)'}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {hidden.length > 0 && (
            <details>
              <summary>{uv5rMiniZoneHiddenSummary(hidden.length)}</summary>
              <Text size="sm">
                Slots:{' '}
                {hidden
                  .map((m) => uv5rMiniZoneHiddenMember(m.slot, channels !== undefined))
                  .join(', ')}
              </Text>
            </details>
          )}
        </>
      )}
    </Stack>
  );
}

/** Decode only data actually captured in a recognised region. */
export function Uv5rMiniMemory({
  archive,
  notDecoded,
}: {
  archive?: DebugArchive;
  notDecoded?: readonly string[];
}) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Memory</Title>
        <Alert title="No capture">Open or read a capture to inspect its memory.</Alert>
      </Stack>
    );
  return <Uv5rMiniMemoryLoaded archive={archive} notDecoded={notDecoded} />;
}

function Uv5rMiniMemoryLoaded({
  archive,
  notDecoded,
}: {
  archive: DebugArchive;
  notDecoded?: readonly string[];
}) {
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
  const rows = useMemo(() => channels?.map(channelRow), [channels]);
  const channelsPanel = !rows ? (
    <Alert title="Channels unavailable">{UV5R_MINI_CHANNELS_UNAVAILABLE}</Alert>
  ) : (
    <MemoryCategoryPanel
      summary={uv5rMiniChannelSummary(rows.length, UV5R_MINI_LAYOUT.channelCount)}
      caveat={UV5R_MINI_CHANNEL_CAVEAT}
      searchPlaceholder="Search channels"
      caption={UV5R_MINI_CHANNELS_CAPTION}
      columns={CHANNEL_COLUMNS}
      rows={rows}
      getRowId={(r) => r.id}
      searchText={(r) => `${r.slot} ${r.label} ${mhz(r.channel.rxHz)} ${mhz(r.channel.txHz)}`}
      defaultSort={{ key: 'slot', direction: 'asc' }}
      stickyFirstColumn
      mobileIdentity={(r) => (
        <span>
          {r.slot} · <strong>{r.label}</strong>
        </span>
      )}
      mobileIdentityLabel="Slot · identity"
      details={(r) => (
        <Text size="sm">
          RX tone {formatTone(r.channel.rxTone)} · TX tone {formatTone(r.channel.txTone)} · Power{' '}
          {r.channel.powerPercent == null ? 'Default' : `${r.channel.powerPercent}%`}
        </Text>
      )}
      emptyMessage={UV5R_MINI_CHANNELS_EMPTY}
    />
  );
  const zoneRows = useMemo(
    () =>
      zones && !('reject' in zones)
        ? zones.zones.map((zone, i): ZoneRow => ({ id: `zone-${i + 1}`, index: i, zone }))
        : undefined,
    [zones],
  );
  const zonesPanel = !zones ? (
    <Alert title="Zones unavailable">{UV5R_MINI_ZONES_UNAVAILABLE}</Alert>
  ) : 'reject' in zones ? (
    <Alert title="Zones missing or invalid">{uv5rMiniZonesInvalid(zones.reject)}</Alert>
  ) : (
    <MemoryCategoryPanel
      summary={uv5rMiniZoneSummary(zones.zones.length)}
      caveat={UV5R_MINI_ZONE_CAVEAT}
      searchPlaceholder="Search zones"
      caption={UV5R_MINI_ZONES_CAPTION}
      columns={ZONE_COLUMNS}
      rows={zoneRows!}
      getRowId={(r) => r.id}
      searchText={(r) =>
        `${r.index + 1} ${zoneLabel(r)} ${r.zone.slotIndexes
          .map((slot) => channels?.find((c) => c.slotIndex === slot + 1)?.wireName ?? '')
          .join(' ')}`
      }
      defaultSort={{ key: 'zone', direction: 'asc' }}
      details={(r) => <Uv5rMiniZoneBlock row={r} channels={channels} />}
      emptyMessage={UV5R_MINI_ZONES_EMPTY}
    />
  );
  return (
    <Stack>
      <Title order={3}>Memory</Title>
      <MemoryCategories
        notDecoded={notDecoded}
        storageKey="debug-memory-category:uv5r-mini"
        categories={[
          {
            value: 'channels',
            label: 'Channels',
            count: channels?.length,
            render: () => channelsPanel,
          },
          {
            value: 'zones',
            label: 'Zones',
            count: zoneRows?.length,
            render: () => zonesPanel,
          },
        ]}
      />
    </Stack>
  );
}
