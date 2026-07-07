import { Button, Checkbox, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import type { LocationEditSource } from '@core/domain/channelLocation.ts';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import MapLocationPicker from '../MapLocationPicker/MapLocationPicker.tsx';
import { FormSection } from '../ui/index.ts';

export interface ChannelLocationValues {
  maidenheadLocator: string;
  /** Decimal degrees as typed text — parse on save, not on every keystroke. */
  lat: string;
  lon: string;
  useLocation: boolean;
  lastEdited: LocationEditSource;
}

function parseCoord(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export interface ChannelLocationSectionProps {
  value: ChannelLocationValues;
  onChange: (value: ChannelLocationValues) => void;
  /** When false, the map unmounts while locator/coords fields stay mounted. */
  mapActive?: boolean;
}

export default function ChannelLocationSection({
  value,
  onChange,
  mapActive = true,
}: ChannelLocationSectionProps) {
  const [locatorError, setLocatorError] = useState<string | null>(null);

  const applyLocator = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setLocatorError(null);
      onChange({ ...value, maidenheadLocator: '', lastEdited: 'locator' });
      return;
    }
    if (!isValidLocator(trimmed)) {
      setLocatorError('Invalid Maidenhead locator');
      onChange({ ...value, maidenheadLocator: trimmed.toUpperCase(), lastEdited: 'locator' });
      return;
    }
    setLocatorError(null);
    const coords = locatorToCoords(trimmed);
    onChange({
      ...value,
      maidenheadLocator: trimmed.toUpperCase(),
      lat: coords != null ? String(coords.lat) : value.lat,
      lon: coords != null ? String(coords.lon) : value.lon,
      useLocation: true,
      lastEdited: 'locator',
    });
  };

  const applyCoords = (lat: number, lon: number) => {
    setLocatorError(null);
    onChange({
      ...value,
      lat: String(lat),
      lon: String(lon),
      maidenheadLocator: coordsToLocator(lat, lon, 6),
      useLocation: true,
      lastEdited: 'coords',
    });
  };

  const clearPosition = () => {
    setLocatorError(null);
    onChange({
      maidenheadLocator: '',
      lat: '',
      lon: '',
      useLocation: false,
      lastEdited: 'coords',
    });
  };

  return (
    <FormSection title="Location">
      <Stack gap="sm">
        <TextInput
          label="Maidenhead locator"
          value={value.maidenheadLocator}
          onChange={(e) => {
            setLocatorError(null);
            onChange({
              ...value,
              maidenheadLocator: e.currentTarget.value,
              lastEdited: 'locator',
            });
          }}
          onBlur={(e) => applyLocator(e.currentTarget.value)}
          error={locatorError}
        />
        <Group grow>
          <NumberInput
            label="Latitude"
            value={value.lat}
            onChange={(v) => {
              const lat = String(v ?? '');
              const next = { ...value, lat, lastEdited: 'coords' as const };
              const latN = parseCoord(lat);
              const lonN = parseCoord(value.lon);
              if (latN != null && lonN != null) {
                next.maidenheadLocator = coordsToLocator(latN, lonN, 6);
              }
              onChange(next);
            }}
            decimalScale={6}
          />
          <NumberInput
            label="Longitude"
            value={value.lon}
            onChange={(v) => {
              const lon = String(v ?? '');
              const next = { ...value, lon, lastEdited: 'coords' as const };
              const latN = parseCoord(value.lat);
              const lonN = parseCoord(lon);
              if (latN != null && lonN != null) {
                next.maidenheadLocator = coordsToLocator(latN, lonN, 6);
              }
              onChange(next);
            }}
            decimalScale={6}
          />
        </Group>
        <Checkbox
          label="Use location"
          description="Include this channel on maps and distance filters when coordinates are set"
          checked={value.useLocation}
          onChange={(e) => onChange({ ...value, useLocation: e.currentTarget.checked })}
        />
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            Click or drag the map marker to set coordinates.
          </Text>
          <Button type="button" variant="subtle" size="compact-sm" onClick={clearPosition}>
            Clear position
          </Button>
        </Group>
        <MapLocationPicker
          lat={parseCoord(value.lat)}
          lon={parseCoord(value.lon)}
          onPick={applyCoords}
          height={280}
          active={mapActive}
        />
      </Stack>
    </FormSection>
  );
}

/** Hydrate editor state from a persisted channel row. */
export function channelLocationValuesFromChannel(channel: {
  location: { lat: number; lon: number } | null;
  useLocation: boolean;
  maidenheadLocator: string | null;
}): ChannelLocationValues {
  return {
    maidenheadLocator: channel.maidenheadLocator ?? '',
    lat: channel.location?.lat != null ? String(channel.location.lat) : '',
    lon: channel.location?.lon != null ? String(channel.location.lon) : '',
    useLocation: channel.useLocation,
    lastEdited: 'coords',
  };
}
