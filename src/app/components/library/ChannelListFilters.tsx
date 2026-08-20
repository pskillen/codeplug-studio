import { Slider, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import { DISTANCE_FILTER_MARKS_KM } from '../../lib/channels.ts';
import { ALL_BANDS, bandsFromFrequencies, type BandDefinition } from '../../lib/bands.ts';
import { modeFilterOptions, modeLabel, type ChannelMode } from '../../lib/channelModes.ts';
import { useChannelListQuery } from '../../hooks/useChannelListQuery.ts';
import { useFilteredChannels } from '../../hooks/useChannelListFilters.ts';
import { CHANNEL_ZONE_FILTER_NONE } from '../../routes/library/lists/channelListZoneFilter.ts';
import { FacetBar, FacetChip, SplitFilter } from './FacetBar.tsx';
import FilterPopover from '../v2/FilterPopover.tsx';
import { Pill } from '../v2/index.ts';
import classes from './ChannelListFilters.module.css';
import { useLibrary } from '../../state/useLibrary.ts';
import { useOperatorPosition } from '../../state/operatorPosition.tsx';

type FilterTab = 'bands' | 'zones' | 'modes';

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: 'bands', label: 'Bands' },
  { value: 'zones', label: 'Zones' },
  { value: 'modes', label: 'Modes' },
];

function useBandOptions() {
  const { library } = useLibrary();
  const { channels } = library;
  const query = useChannelListQuery();
  return useMemo(() => {
    const ids = new Set<string>(query.bandFilter);
    for (const ch of channels) {
      for (const band of bandsFromFrequencies(ch.rxFrequency, ch.txFrequency)) {
        ids.add(band.id);
      }
    }
    return ALL_BANDS.filter((b) => ids.has(b.id));
  }, [channels, query.bandFilter]);
}

function useZoneOptions() {
  const { library } = useLibrary();
  const { zones } = library;
  return useMemo(
    () =>
      [...zones].sort((a, b) => {
        const orderA = a.order ?? Number.POSITIVE_INFINITY;
        const orderB = b.order ?? Number.POSITIVE_INFINITY;
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }),
    [zones],
  );
}

/**
 * Filters trigger button + tabbed flyout popover (Bands/Zones/Modes) for
 * `/library/channels`. Simplex/Split and the distance radius live in the
 * popover footer, visible regardless of which tab is active.
 */
export default function ChannelListFilters() {
  const { library } = useLibrary();
  const { position } = useOperatorPosition();
  const query = useChannelListQuery();
  const filtered = useFilteredChannels(library.channels, query, position, library.zones);

  const bandOptions = useBandOptions();
  const zoneOptions = useZoneOptions();
  const modeOptions = useMemo(() => modeFilterOptions(), []);

  const distanceFilterPending = query.distanceFilterEnabled && !position;
  const distanceFilterMarks = DISTANCE_FILTER_MARKS_KM.map((km) => ({
    value: km,
    label: `${km}`,
  }));

  const [opened, setOpened] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('bands');

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

  const toggleZoneFilter = (zoneId: string) => {
    if (query.zoneFilter.includes(zoneId)) {
      query.setZoneFilter(query.zoneFilter.filter((id) => id !== zoneId));
    } else {
      query.setZoneFilter([...query.zoneFilter, zoneId]);
    }
  };

  const activeCount =
    query.bandFilter.length +
    query.zoneFilter.length +
    query.modeFilter.length +
    (query.duplexFilter ? 1 : 0) +
    (query.distanceFilterEnabled ? 1 : 0);

  return (
    <FilterPopover
      triggerLabel="Filters"
      opened={opened}
      onOpenChange={setOpened}
      activeCount={activeCount}
      tabs={FILTER_TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      footer={
        <>
          <div className={classes.footerRow}>
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
          </div>
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
        </>
      }
    >
      {activeTab === 'bands' ? (
        <FacetBar>
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
        </FacetBar>
      ) : null}
      {activeTab === 'zones' ? (
        <FacetBar>
          <FacetChip
            label="All zones"
            active={query.zoneFilter.length === 0}
            onClick={() => query.setZoneFilter([])}
          />
          <FacetChip
            label="Not in a zone"
            active={query.zoneFilter.includes(CHANNEL_ZONE_FILTER_NONE)}
            onClick={() => toggleZoneFilter(CHANNEL_ZONE_FILTER_NONE)}
          />
          {zoneOptions.map((zone) => (
            <FacetChip
              key={zone.id}
              label={zone.name}
              active={query.zoneFilter.includes(zone.id)}
              onClick={() => toggleZoneFilter(zone.id)}
            />
          ))}
        </FacetBar>
      ) : null}
      {activeTab === 'modes' ? (
        <FacetBar>
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
      ) : null}
    </FilterPopover>
  );
}

/**
 * Removable pill row for every currently-applied Channels list filter —
 * stays visible even when the FilterPopover is closed, so nothing hides
 * silently. Renders nothing when no filter is active.
 */
export function ChannelListAppliedFilters() {
  const query = useChannelListQuery();
  const bandOptions = useBandOptions();
  const zoneOptions = useZoneOptions();

  const pills = useMemo(() => {
    const items: { key: string; label: string; onRemove: () => void }[] = [];

    for (const bandId of query.bandFilter) {
      const band = bandOptions.find((b) => b.id === bandId);
      items.push({
        key: `band:${bandId}`,
        label: band?.label ?? bandId,
        onRemove: () => query.setBandFilter(query.bandFilter.filter((id) => id !== bandId)),
      });
    }

    for (const zoneId of query.zoneFilter) {
      const label =
        zoneId === CHANNEL_ZONE_FILTER_NONE
          ? 'Not in a zone'
          : (zoneOptions.find((z) => z.id === zoneId)?.name ?? zoneId);
      items.push({
        key: `zone:${zoneId}`,
        label,
        onRemove: () => query.setZoneFilter(query.zoneFilter.filter((id) => id !== zoneId)),
      });
    }

    for (const mode of query.modeFilter) {
      items.push({
        key: `mode:${mode}`,
        label: modeLabel(mode as ChannelMode),
        onRemove: () => query.setModeFilter(query.modeFilter.filter((m) => m !== mode)),
      });
    }

    if (query.duplexFilter) {
      items.push({
        key: 'duplex',
        label: query.duplexFilter === 'simplex' ? 'Simplex' : 'Split',
        onRemove: () => query.setDuplexFilter(null),
      });
    }

    if (query.distanceFilterEnabled) {
      items.push({
        key: 'distance',
        label: `Within ${query.maxDistanceKm} km`,
        onRemove: () => query.setDistanceFilterEnabled(false),
      });
    }

    return items;
  }, [query, bandOptions, zoneOptions]);

  if (pills.length === 0) return null;

  return (
    <div className={classes.appliedPills}>
      {pills.map((pill) => (
        <Pill key={pill.key} tone="accent" onRemove={pill.onRemove}>
          {pill.label}
        </Pill>
      ))}
    </div>
  );
}
