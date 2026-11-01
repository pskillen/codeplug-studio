import { ActionIcon, Autocomplete, Loader } from '@mantine/core';
import { IconCurrentLocation, IconSearch, IconX } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import type { Channel } from '@core/models/library.ts';
import { useGeolocation } from '../../hooks/useGeolocation.ts';
import { useMapSettings } from '../../hooks/useMapSettings.ts';
import { channelHasLocation, filterChannelOptions } from '../../lib/channelLookup.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  placeFromChannel,
  placeFromCoords,
  resolvePlace,
  type Place,
} from '../../lib/resolvePlace.ts';
import { mapComboboxProps } from '../../theme.ts';
import classes from './PlaceInput.module.css';

export interface PlaceInputProps {
  /** Accessible label and placeholder context ("Point A", "Search point"). */
  label: string;
  placeholder?: string;
  /** Round chip before the field (A / B). */
  badge?: { text: string; colour: string };
  place: Place | null;
  /** Called with a resolved place, or null when cleared. */
  onPlace: (place: Place | null) => void;
  /** Open project's channels; leave empty when no project is open. */
  channels?: readonly Channel[];
  /** Show the "use my location" button. */
  allowGps?: boolean;
  /** Show a clear (x) button when a place is set. */
  clearable?: boolean;
}

/**
 * One-line point entry for the Field tools: type a locator, an address or postcode, or (with a
 * project open) a library channel's callsign or name; or tap the GPS button. Resolves on Enter,
 * on choosing a suggestion, or with the search button.
 */
export default function PlaceInput({
  label,
  placeholder = 'Locator, address, postcode or callsign',
  badge,
  place,
  onPlace,
  channels = [],
  allowGps = true,
  clearable = false,
}: PlaceInputProps) {
  const { mapboxToken } = useMapSettings();
  const { requestLocation, loading: gpsLoading, error: gpsError } = useGeolocation();
  const [text, setText] = useState(place?.label ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show the current place's label whenever it is set from outside (map click, GPS, swap).
  useEffect(() => {
    setText(place?.label ?? '');
    setError(null);
  }, [place]);

  const located = useMemo(() => channels.filter(channelHasLocation), [channels]);
  const options = useMemo(() => filterChannelOptions(located, text), [located, text]);

  const submit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const byId = located.find((ch) => ch.id === trimmed);
    if (byId) {
      onPlace(placeFromChannel(byId));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onPlace(
        await resolvePlace(trimmed, {
          channels: located,
          mapboxToken,
          provider: mapboxToken.trim() ? 'mapbox' : 'photon',
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Look-up failed');
    } finally {
      setBusy(false);
    }
  };

  const useGps = async () => {
    const result = await requestLocation();
    if (result) onPlace(placeFromCoords(result.lat, result.lon, 'gps', 'My location'));
  };

  const caption = place
    ? `${coordsToLocator(place.lat, place.lon, 6)} · ${place.lat.toFixed(4)}, ${place.lon.toFixed(4)}`
    : null;
  const shownError = error ?? gpsError;

  return (
    <div className={classes.root}>
      <div className={classes.row}>
        {badge ? (
          <span className={classes.badge} style={{ background: badge.colour }} aria-hidden>
            {badge.text}
          </span>
        ) : null}
        <Autocomplete
          className={classes.field}
          aria-label={label}
          placeholder={placeholder}
          value={text}
          onChange={setText}
          onOptionSubmit={(v) => void submit(v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit(text);
            }
          }}
          data={options}
          filter={({ options: o }) => o}
          comboboxProps={mapComboboxProps()}
          leftSection={
            busy ? (
              <Loader size={16} />
            ) : (
              <IconSearch size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
            )
          }
          rightSectionWidth={allowGps && clearable ? 64 : 34}
          rightSection={
            <div className={classes.actions}>
              {allowGps ? (
                <ActionIcon
                  variant="subtle"
                  aria-label={`Use my location for ${label}`}
                  loading={gpsLoading}
                  onClick={() => void useGps()}
                >
                  <IconCurrentLocation size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                </ActionIcon>
              ) : null}
              {clearable && place ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={`Clear ${label}`}
                  onClick={() => {
                    setText('');
                    onPlace(null);
                  }}
                >
                  <IconX size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                </ActionIcon>
              ) : null}
            </div>
          }
        />
      </div>
      {shownError ? (
        <div className={classes.error} role="alert">
          {shownError}
        </div>
      ) : caption ? (
        <div className={classes.caption}>{caption}</div>
      ) : null}
    </div>
  );
}
