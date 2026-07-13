import { Group, NumberInput, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import MapLocationPicker from '../MapLocationPicker/MapLocationPicker.tsx';

function parseCoord(value: string): number | null {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export interface GeoPointEditorProps {
  lat: string;
  lon: string;
  maidenheadLocator: string;
  onChange: (value: { lat: string; lon: string; maidenheadLocator: string }) => void;
  mapActive?: boolean;
}

export default function GeoPointEditor({
  lat,
  lon,
  maidenheadLocator,
  onChange,
  mapActive = true,
}: GeoPointEditorProps) {
  const [locatorError, setLocatorError] = useState<string | null>(null);

  const applyLocator = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setLocatorError(null);
      onChange({ lat, lon, maidenheadLocator: '' });
      return;
    }
    if (!isValidLocator(trimmed)) {
      setLocatorError('Invalid Maidenhead locator');
      onChange({ lat, lon, maidenheadLocator: trimmed.toUpperCase() });
      return;
    }
    setLocatorError(null);
    const coords = locatorToCoords(trimmed);
    onChange({
      lat: coords != null ? String(coords.lat) : lat,
      lon: coords != null ? String(coords.lon) : lon,
      maidenheadLocator: trimmed.toUpperCase(),
    });
  };

  const applyCoords = (nextLat: number, nextLon: number) => {
    setLocatorError(null);
    onChange({
      lat: String(nextLat),
      lon: String(nextLon),
      maidenheadLocator: coordsToLocator(nextLat, nextLon, 6),
    });
  };

  const latN = parseCoord(lat);
  const lonN = parseCoord(lon);

  return (
    <Stack gap="sm">
      <TextInput
        label="Maidenhead locator"
        value={maidenheadLocator}
        onChange={(e) => {
          setLocatorError(null);
          onChange({ lat, lon, maidenheadLocator: e.currentTarget.value });
        }}
        onBlur={(e) => applyLocator(e.currentTarget.value)}
        error={locatorError}
      />
      <Group grow align="flex-start">
        <NumberInput
          label="Latitude"
          value={lat === '' ? '' : (latN ?? '')}
          onChange={(value) => {
            const nextLat = value === '' ? '' : String(value);
            const next = { lat: nextLat, lon, maidenheadLocator };
            const la = parseCoord(nextLat);
            const lo = parseCoord(lon);
            if (la != null && lo != null) {
              next.maidenheadLocator = coordsToLocator(la, lo, 6);
            }
            onChange(next);
          }}
          decimalScale={6}
        />
        <NumberInput
          label="Longitude"
          value={lon === '' ? '' : (lonN ?? '')}
          onChange={(value) => {
            const nextLon = value === '' ? '' : String(value);
            const next = { lat, lon: nextLon, maidenheadLocator };
            const la = parseCoord(lat);
            const lo = parseCoord(nextLon);
            if (la != null && lo != null) {
              next.maidenheadLocator = coordsToLocator(la, lo, 6);
            }
            onChange(next);
          }}
          decimalScale={6}
        />
      </Group>
      {mapActive && latN != null && lonN != null ? (
        <MapLocationPicker lat={latN} lon={lonN} onPick={applyCoords} />
      ) : mapActive ? (
        <MapLocationPicker lat={null} lon={null} onPick={applyCoords} />
      ) : null}
    </Stack>
  );
}
