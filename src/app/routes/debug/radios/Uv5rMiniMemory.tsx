import { Alert, Stack, Text, Title } from '@mantine/core';
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
  UV5R_MINI_CHANNELS_UNAVAILABLE,
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
      caption="UV-5R Mini memory channels"
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
      emptyMessage="No channels are stored."
    />
  );
  const zonesPanel = (
    <Stack>
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
          { value: 'zones', label: 'Zones', render: () => zonesPanel },
        ]}
      />
    </Stack>
  );
}
