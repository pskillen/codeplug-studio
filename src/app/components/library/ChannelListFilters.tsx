import { MultiSelect, SimpleGrid, Slider, Stack, Switch, Text } from '@mantine/core';
import { useMemo } from 'react';
import { DISTANCE_FILTER_MARKS_KM } from '../../lib/channels.ts';
import { ALL_BANDS, bandsFromFrequencies } from '../../lib/bands.ts';
import { modeFilterOptions } from '../../lib/channelModes.ts';
import { useChannelListQuery } from '../../hooks/useChannelListQuery.ts';
import { useFilteredChannels } from '../../hooks/useChannelListFilters.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useOperatorPosition } from '../../state/operatorPosition.tsx';

/** Band, mode, duplex, and distance filters for the channels list page (search lives on `DataTable`). */
export default function ChannelListFilters() {
  const { library } = useLibrary();
  const { channels } = library;
  const { position } = useOperatorPosition();
  const query = useChannelListQuery();
  const filtered = useFilteredChannels(channels, query, position);

  const bandOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const ch of channels) {
      for (const band of bandsFromFrequencies(ch.rxFrequency, ch.txFrequency)) {
        ids.add(band.id);
      }
    }
    return ALL_BANDS.filter((b) => ids.has(b.id)).map((b) => ({ value: b.id, label: b.label }));
  }, [channels]);

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
        />

        <MultiSelect
          label="Mode"
          data={modeFilterOptions()}
          value={query.modeFilter}
          onChange={query.setModeFilter}
          clearable
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
          Set your location below to apply the distance radius.
        </Text>
      ) : null}
    </Stack>
  );
}
