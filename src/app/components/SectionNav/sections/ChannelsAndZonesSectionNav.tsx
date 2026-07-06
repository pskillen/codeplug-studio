import { Button, Loader, MultiSelect, Slider, Stack, Switch, Text, TextInput } from '@mantine/core';
import { IconMapPin, IconPlus, IconPlaylistAdd, IconWorldSearch } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import UseMyLocationButton from '../../UseMyLocationButton/UseMyLocationButton.tsx';
import { DISTANCE_FILTER_MARKS_KM } from '../../../lib/channels.ts';
import { ALL_BANDS, bandsFromFrequencies } from '../../../lib/bands.ts';
import { modeFilterOptions } from '../../../lib/channelModes.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useChannelListQuery } from '../../../hooks/useChannelListQuery.ts';
import { useFilteredChannels } from '../../../hooks/useChannelListFilters.ts';
import type { SectionNavProps } from '../../../nav/sectionNavTypes.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import { useOperatorPosition } from '../../../state/operatorPosition.tsx';
import LibrarySectionNavFrame from './LibrarySectionNavFrame.tsx';

export default function ChannelsAndZonesSectionNav({ variant }: SectionNavProps) {
  const isSidebar = variant === 'sidebar';
  const { library } = useLibrary();
  const { channels } = library;
  const { position, setPosition, clearPosition } = useOperatorPosition();
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
    <LibrarySectionNavFrame>
      <Stack gap="sm">
        <Button
          component={Link}
          to="/library/channels/new"
          leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          New channel
        </Button>

        <Button
          component={Link}
          to="/library/zones/new"
          variant="light"
          leftSection={<IconPlus size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          New zone
        </Button>

        <Button
          component={Link}
          to="/library/zones/new-from-location"
          variant="light"
          leftSection={<IconMapPin size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          New zone from location
        </Button>

        <Button
          component={Link}
          to="/library/channels/add-channel-set"
          variant="light"
          leftSection={<IconPlaylistAdd size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          Add channel set…
        </Button>

        <Button
          component={Link}
          to="/library/channels/add-from-ukrepeater"
          variant="light"
          leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          Add from ukrepeater.net
        </Button>

        <Button
          component={Link}
          to="/library/channels/add-from-brandmeister"
          variant="light"
          leftSection={<IconWorldSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
          fullWidth={isSidebar}
        >
          Add from BrandMeister
        </Button>

        <TextInput
          label="Search"
          placeholder="Filter name or callsign…"
          value={query.nameFilterInput}
          onChange={(e) => query.setNameFilter(e.currentTarget.value)}
          rightSection={query.nameFilterPending ? <Loader size={16} /> : undefined}
          size={isSidebar ? 'sm' : 'md'}
        />

        <MultiSelect
          label="Band"
          data={bandOptions}
          value={query.bandFilter}
          onChange={query.setBandFilter}
          clearable
          size={isSidebar ? 'sm' : 'md'}
        />

        <MultiSelect
          label="Mode"
          data={modeFilterOptions()}
          value={query.modeFilter}
          onChange={query.setModeFilter}
          clearable
          size={isSidebar ? 'sm' : 'md'}
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
          size={isSidebar ? 'sm' : 'md'}
        />

        {position ? (
          <Stack gap={4}>
            <Text size="xs" c="dimmed">
              {position.lat.toFixed(5)}, {position.lon.toFixed(5)}
              {position.accuracyMeters != null && Number.isFinite(position.accuracyMeters)
                ? ` (±${Math.round(position.accuracyMeters)} m)`
                : ''}
            </Text>
            <Button variant="subtle" size="compact-sm" onClick={clearPosition}>
              Clear my location
            </Button>
          </Stack>
        ) : query.sortMode === 'name' && !query.distanceFilterEnabled ? (
          <UseMyLocationButton
            onLocation={(lat, lon, accuracyMeters) =>
              setPosition({ lat, lon, accuracyMeters: accuracyMeters ?? null })
            }
          />
        ) : null}

        <Switch
          label="Within distance"
          description={
            isSidebar
              ? 'Hide channels without coordinates'
              : 'Hide channels without coordinates; limit by radius when your location is set'
          }
          checked={query.distanceFilterEnabled}
          onChange={(e) => query.setDistanceFilterEnabled(e.currentTarget.checked)}
          size={isSidebar ? 'sm' : 'md'}
        />

        {query.distanceFilterEnabled ? (
          <Stack gap="xs">
            <Text size="xs" fw={500}>
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
              size={isSidebar ? 'sm' : 'md'}
            />
          </Stack>
        ) : null}

        {distanceFilterPending ? (
          <Stack gap="xs">
            <Text size="xs" c="dimmed">
              Set your location to apply the distance radius.
            </Text>
            <UseMyLocationButton
              onLocation={(lat, lon, accuracyMeters) =>
                setPosition({ lat, lon, accuracyMeters: accuracyMeters ?? null })
              }
            />
          </Stack>
        ) : null}
      </Stack>
    </LibrarySectionNavFrame>
  );
}
