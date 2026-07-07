import { MultiSelect, Pill, SimpleGrid, Slider, Stack, Switch, Text } from '@mantine/core';
import { useMemo, type CSSProperties } from 'react';
import { DISTANCE_FILTER_MARKS_KM } from '../../lib/channels.ts';
import {
  ALL_BANDS,
  bandsFromFrequencies,
  isAmateurBand,
  type BandDefinition,
} from '../../lib/bands.ts';
import {
  modeColor,
  modeFilterOptions,
  modeLabel,
  type ChannelMode,
} from '../../lib/channelModes.ts';
import { useChannelListQuery } from '../../hooks/useChannelListQuery.ts';
import { useFilteredChannels } from '../../hooks/useChannelListFilters.ts';
import UseMyLocationButton from '../UseMyLocationButton/UseMyLocationButton.tsx';
import BandPill from '../pills/BandPill.tsx';
import ModePill from '../pills/ModePill.tsx';
import { useLibrary } from '../../state/useLibrary.ts';
import { useOperatorPosition } from '../../state/operatorPosition.tsx';

function bandByIdMap(): Map<string, BandDefinition> {
  return new Map(ALL_BANDS.map((b) => [b.id, b]));
}

function bandMultiSelectPillStyle(band: BandDefinition): CSSProperties {
  if (isAmateurBand(band)) {
    return { backgroundColor: band.color, color: '#fff' };
  }
  return {
    border: `1px solid ${band.color}`,
    borderColor: band.color,
    color: band.color,
    backgroundColor: `${band.color}18`,
  };
}

/** Band, mode, duplex, and distance filters for the channels list page (search lives on `DataTable`). */
export default function ChannelListFilters() {
  const { library } = useLibrary();
  const { channels } = library;
  const { position, setPosition } = useOperatorPosition();
  const query = useChannelListQuery();
  const filtered = useFilteredChannels(channels, query, position);
  const bandsById = useMemo(() => bandByIdMap(), []);

  const bandOptions = useMemo(() => {
    const ids = new Set<string>(query.bandFilter);
    for (const ch of channels) {
      for (const band of bandsFromFrequencies(ch.rxFrequency, ch.txFrequency)) {
        ids.add(band.id);
      }
    }
    return ALL_BANDS.filter((b) => ids.has(b.id)).map((b) => ({ value: b.id, label: b.label }));
  }, [channels, query.bandFilter]);

  const distanceFilterPending = query.distanceFilterEnabled && !position;

  const distanceFilterMarks = DISTANCE_FILTER_MARKS_KM.map((km) => ({
    value: km,
    label: `${km}`,
  }));

  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} spacing="sm">
        <MultiSelect
          label="Band"
          data={bandOptions}
          value={query.bandFilter}
          onChange={query.setBandFilter}
          clearable
          renderPill={({ option, onRemove }) => {
            if (!option) return null;
            const band = bandsById.get(String(option.value));
            if (!band) return null;
            return (
              <Pill withRemoveButton onRemove={onRemove} style={bandMultiSelectPillStyle(band)}>
                {band.label}
              </Pill>
            );
          }}
          renderOption={({ option }) => (
            <BandPill band={bandsById.get(String(option.value)) ?? null} size="xs" />
          )}
        />

        <MultiSelect
          label="Mode"
          data={modeFilterOptions()}
          value={query.modeFilter}
          onChange={query.setModeFilter}
          clearable
          renderPill={({ option, onRemove }) => {
            const mode = String(option.value) as ChannelMode;
            return (
              <Pill
                withRemoveButton
                onRemove={onRemove}
                style={{ backgroundColor: modeColor(mode), color: '#1a1b1e' }}
              >
                {modeLabel(mode)}
              </Pill>
            );
          }}
          renderOption={({ option }) => (
            <ModePill mode={String(option.value) as ChannelMode} size="xs" />
          )}
        />

        <MultiSelect
          label="Simplex / split"
          data={[
            { value: 'simplex', label: 'Simplex' },
            { value: 'split', label: 'Split' },
          ]}
          value={query.duplexFilter ? [query.duplexFilter] : []}
          onChange={(v) => query.setDuplexFilter(v[0] ?? null)}
          clearable
          maxValues={1}
        />
      </SimpleGrid>

      {!position ? (
        <UseMyLocationButton
          label="Show my location"
          onLocation={(lat, lon, accuracyMeters) =>
            setPosition({ lat, lon, accuracyMeters: accuracyMeters ?? null })
          }
        />
      ) : null}

      <Switch
        label="Within distance"
        description="Hide channels without coordinates; limit by radius when your location is set"
        checked={query.distanceFilterEnabled}
        onChange={(e) => query.setDistanceFilterEnabled(e.currentTarget.checked)}
      />

      {query.distanceFilterEnabled ? (
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Within {query.maxDistanceKm} km
            {position
              ? ` — ${filtered.length} channel${filtered.length === 1 ? '' : 's'}`
              : ' — set location for radius'}
          </Text>
          <Slider
            value={query.maxDistanceKm}
            onChange={query.setMaxDistanceKm}
            min={DISTANCE_FILTER_MARKS_KM[0]}
            max={DISTANCE_FILTER_MARKS_KM[DISTANCE_FILTER_MARKS_KM.length - 1]}
            marks={distanceFilterMarks}
            restrictToMarks
            label={(value) => `${value} km`}
          />
        </Stack>
      ) : null}

      {distanceFilterPending ? (
        <Text size="sm" c="dimmed">
          Set your location above to apply the distance radius.
        </Text>
      ) : null}
    </Stack>
  );
}
