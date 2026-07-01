import { Button, Checkbox, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import type { LocationEditSource } from '@core/domain/channelLocation.ts';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import MapLocationPicker from '../MapLocationPicker/MapLocationPicker.tsx';
import { FormSection } from '../ui/index.ts';

export interface ChannelLocationValues {
  maidenheadLocator: string;
  lat: number | null;
  lon: number | null;
  useLocation: boolean;
  lastEdited: LocationEditSource;
}

export interface ChannelLocationSectionProps {
  value: ChannelLocationValues;
  onChange: (value: ChannelLocationValues) => void;
}

export default function ChannelLocationSection({ value, onChange }: ChannelLocationSectionProps) {
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
      lat: coords?.lat ?? value.lat,
      lon: coords?.lon ?? value.lon,
      useLocation: true,
      lastEdited: 'locator',
    });
  };

  const applyCoords = (lat: number, lon: number) => {
    setLocatorError(null);
    onChange({
      ...value,
      lat,
      lon,
      maidenheadLocator: coordsToLocator(lat, lon, 6),
      useLocation: true,
      lastEdited: 'coords',
    });
  };

  const clearPosition = () => {
    setLocatorError(null);
    onChange({
      maidenheadLocator: '',
      lat: null,
      lon: null,
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
            value={value.lat ?? undefined}
            onChange={(v) => {
              const lat = typeof v === 'number' ? v : null;
              const next = { ...value, lat, lastEdited: 'coords' as const };
              if (lat != null && value.lon != null) {
                next.maidenheadLocator = coordsToLocator(lat, value.lon, 6);
              }
              onChange(next);
            }}
            decimalScale={6}
          />
          <NumberInput
            label="Longitude"
            value={value.lon ?? undefined}
            onChange={(v) => {
              const lon = typeof v === 'number' ? v : null;
              const next = { ...value, lon, lastEdited: 'coords' as const };
              if (value.lat != null && lon != null) {
                next.maidenheadLocator = coordsToLocator(value.lat, lon, 6);
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
        <MapLocationPicker lat={value.lat} lon={value.lon} onPick={applyCoords} height={280} />
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
    lat: channel.location?.lat ?? null,
    lon: channel.location?.lon ?? null,
    useLocation: channel.useLocation,
    lastEdited: 'coords',
  };
}
