import { Slider, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { DISTANCE_FILTER_MARKS_KM } from '../../lib/channels.ts';
import { ALL_BANDS, bandsFromFrequencies, type BandDefinition } from '../../lib/bands.ts';
import { modeFilterOptions, modeLabel, type ChannelMode } from '../../lib/channelModes.ts';
import { useChannelListQuery } from '../../hooks/useChannelListQuery.ts';
import { useFilteredChannels } from '../../hooks/useChannelListFilters.ts';
import UseMyLocationButton from '../UseMyLocationButton/UseMyLocationButton.tsx';
import { FacetBar, FacetChip, SplitFilter } from './FacetBar.tsx';
import classes from './ChannelListFilters.module.css';
import { useLibrary } from '../../state/useLibrary.ts';
import { useOperatorPosition } from '../../state/operatorPosition.tsx';

/** Band, duplex, and distance facets for the channels list (mk2 L2 facet bar). */
export default function ChannelListFilters() {
  const { library } = useLibrary();
  const { channels } = library;
  const { position, setPosition } = useOperatorPosition();
  const query = useChannelListQuery();
  const filtered = useFilteredChannels(channels, query, position);

  const bandOptions = useMemo(() => {
    const ids = new Set<string>(query.bandFilter);
    for (const ch of channels) {
      for (const band of bandsFromFrequencies(ch.rxFrequency, ch.txFrequency)) {
        ids.add(band.id);
      }
    }
    return ALL_BANDS.filter((b) => ids.has(b.id));
  }, [channels, query.bandFilter]);

  const modeOptions = useMemo(() => modeFilterOptions(), []);

  const distanceFilterPending = query.distanceFilterEnabled && !position;

  const distanceFilterMarks = DISTANCE_FILTER_MARKS_KM.map((km) => ({
    value: km,
    label: `${km}`,
  }));

  const toggleBand = (bandId: string) => {
    if (query.bandFilter.includes(bandId)) {
      query.setBandFilter(query.bandFilter.filter((id) => id !== bandId));
    } else {
      query.setBandFilter([...query.bandFilter, bandId]);
    }
  };

  const toggleMode = (mode: string) => {
    if (query.modeFilter.includes(mode)) {
      query.setModeFilter(query.modeFilter.filter((m) => m !== mode));
    } else {
      query.setModeFilter([...query.modeFilter, mode]);
    }
  };

  return (
    <Stack gap="sm" className={classes.root}>
      <FacetBar scrollable>
        <FacetChip
          label="All bands"
          active={query.bandFilter.length === 0}
          onClick={() => query.setBandFilter([])}
        />
        {bandOptions.map((band: BandDefinition) => (
          <FacetChip
            key={band.id}
            label={band.label}
            active={query.bandFilter.includes(band.id)}
            onClick={() => toggleBand(band.id)}
          />
        ))}
        <SplitFilter
          options={[
            { value: 'simplex', label: 'Simplex' },
            { value: 'split', label: 'Split' },
          ]}
          value={query.duplexFilter}
          onChange={(value) => query.setDuplexFilter(value)}
        />
        <FacetChip
          label={`Within ${query.maxDistanceKm} km`}
          active={query.distanceFilterEnabled}
          onClick={() => query.setDistanceFilterEnabled(!query.distanceFilterEnabled)}
        />
      </FacetBar>

      <FacetBar scrollable>
        <FacetChip
          label="All modes"
          active={query.modeFilter.length === 0}
          onClick={() => query.setModeFilter([])}
        />
        {modeOptions.map((opt) => (
          <FacetChip
            key={opt.value}
            label={modeLabel(opt.value as ChannelMode)}
            active={query.modeFilter.includes(opt.value)}
            onClick={() => toggleMode(opt.value)}
          />
        ))}
      </FacetBar>

      {!position ? (
        <UseMyLocationButton
          label="Show my location"
          onLocation={(lat, lon, accuracyMeters) =>
            setPosition({ lat, lon, accuracyMeters: accuracyMeters ?? null })
          }
        />
      ) : null}

      {query.distanceFilterEnabled ? (
        <Stack gap="xs" className={classes.distanceSection}>
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
