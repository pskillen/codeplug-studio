import { Button, Group, Input, Slider, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import {
  compassOctant,
  formatDistanceKmAndMi,
  pathMetricsBetween,
} from '@core/domain/geoDistance.ts';
import { isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import type { GeoPoint } from '@core/models/libraryTypes.ts';
import { GeocodeError, geocodeQuery, type GeocodeProvider } from '@integrations/geocode/index.ts';
import { FormField, SegmentedControl } from '../../components/v2/index.ts';

export type SlicePlaneMode = 'bearing' | 'locator' | 'address';

export interface SlicePlaneResult {
  bearingDeg: number;
  distanceM: number;
}

export const DEFAULT_RANGE_M = 4_000_000;
const MIN_RANGE_KM = 100;
const MAX_RANGE_KM = 20_000;

const MODE_OPTIONS: { value: SlicePlaneMode; label: string }[] = [
  { value: 'bearing', label: 'Bearing' },
  { value: 'locator', label: 'Locator' },
  { value: 'address', label: 'Address' },
];

const GEOCODE_PROVIDER_OPTIONS: { value: GeocodeProvider; label: string }[] = [
  { value: 'mapbox', label: 'Mapbox' },
  { value: 'photon', label: 'Photon (OSM)' },
];

export function formatSlicePlaneReadout(result: SlicePlaneResult): string {
  const rounded = Math.round(result.bearingDeg);
  const padded = rounded.toString().padStart(3, '0');
  return `${padded}°T · ${compassOctant(result.bearingDeg)}, ${formatDistanceKmAndMi(result.distanceM)}`;
}

export function resolveSlicePlane(args: {
  mode: SlicePlaneMode;
  manualBearingDeg: number;
  manualRangeM: number;
  transmitterLocation: GeoPoint;
  toCoords: GeoPoint | null;
}): SlicePlaneResult {
  if (args.mode === 'bearing' || !args.toCoords) {
    return { bearingDeg: args.manualBearingDeg, distanceM: args.manualRangeM };
  }
  const metrics = pathMetricsBetween(args.transmitterLocation, args.toCoords);
  return { bearingDeg: metrics.bearingAB, distanceM: metrics.distanceM };
}

export interface SlicePlanePickerProps {
  transmitterLocation: GeoPoint;
  /** Antenna heading used as the initial bearing only. */
  defaultBearingDeg: number;
  onChange: (result: SlicePlaneResult) => void;
  mapboxToken?: string;
}

export default function SlicePlanePicker({
  transmitterLocation,
  defaultBearingDeg,
  onChange,
  mapboxToken = '',
}: SlicePlanePickerProps) {
  const hasMapboxToken = mapboxToken.trim().length > 0;
  const [mode, setMode] = useState<SlicePlaneMode>('bearing');
  const [bearingOverrideDeg, setBearingOverrideDeg] = useState<number | null>(null);
  const manualBearingDeg = bearingOverrideDeg ?? defaultBearingDeg;
  const [manualRangeM, setManualRangeM] = useState(DEFAULT_RANGE_M);
  const [toLocator, setToLocator] = useState('');
  const [addressQuery, setAddressQuery] = useState('');
  const [addressResolvedCoords, setAddressResolvedCoords] = useState<GeoPoint | null>(null);
  const [geocodeProvider, setGeocodeProvider] = useState<GeocodeProvider>(
    hasMapboxToken ? 'mapbox' : 'photon',
  );
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocodeLabel, setGeocodeLabel] = useState<string | null>(null);

  const toError = useMemo(() => {
    if (!toLocator.trim()) return null;
    if (!isValidLocator(toLocator)) {
      return 'Enter a valid locator (4, 6, 8, or 10 characters)';
    }
    return null;
  }, [toLocator]);

  const toCoordsFromLocator = useMemo(() => {
    if (mode !== 'locator' || !toLocator.trim() || !isValidLocator(toLocator)) return null;
    return locatorToCoords(toLocator);
  }, [mode, toLocator]);

  const toCoords = mode === 'locator' ? toCoordsFromLocator : addressResolvedCoords;

  const resolved: SlicePlaneResult = useMemo(
    () =>
      resolveSlicePlane({
        mode,
        manualBearingDeg,
        manualRangeM,
        transmitterLocation,
        toCoords,
      }),
    [mode, manualBearingDeg, manualRangeM, toCoords, transmitterLocation],
  );

  useEffect(() => {
    onChange(resolved);
  }, [onChange, resolved]);

  const handleGeocode = async () => {
    setGeocodeError(null);
    setGeocodeLabel(null);
    setGeocodeLoading(true);
    try {
      const result = await geocodeQuery(addressQuery, {
        mapboxToken,
        provider: geocodeProvider,
      });
      if (!result) {
        setGeocodeError('No results found');
        setAddressResolvedCoords(null);
        return;
      }
      setAddressResolvedCoords({ lat: result.lat, lon: result.lon });
      setGeocodeLabel(result.label);
    } catch (err) {
      setAddressResolvedCoords(null);
      setGeocodeError(err instanceof GeocodeError ? err.message : 'Look-up failed');
    } finally {
      setGeocodeLoading(false);
    }
  };

  const rangeKm = manualRangeM / 1000;

  return (
    <Stack gap="lg">
      <Text size="sm" fw={600} ff="monospace" data-testid="slice-plane-readout">
        {formatSlicePlaneReadout(resolved)}
      </Text>

      <FormField label="Mode">
        <SegmentedControl options={MODE_OPTIONS} value={mode} onChange={setMode} />
      </FormField>

      {mode === 'bearing' ? (
        <>
          <Input.Wrapper label={`Bearing — ${Math.round(manualBearingDeg)}°`}>
            <Slider
              aria-label="Slice-plane bearing"
              thumbLabel="Slice-plane bearing"
              value={manualBearingDeg}
              onChange={(value) => {
                setBearingOverrideDeg(value);
              }}
              min={0}
              max={359}
              step={1}
              mb={16}
            />
          </Input.Wrapper>
          <Input.Wrapper label={`Range — ${rangeKm.toFixed(0)} km`}>
            <Slider
              aria-label="Slice-plane range"
              thumbLabel="Slice-plane range"
              value={rangeKm}
              onChange={(value) => setManualRangeM(value * 1000)}
              min={MIN_RANGE_KM}
              max={MAX_RANGE_KM}
              step={50}
              mb={16}
            />
          </Input.Wrapper>
        </>
      ) : null}

      {mode === 'locator' ? (
        <TextInput
          label="To locator"
          placeholder="e.g. JO22ab"
          value={toLocator}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setToLocator(value);
            if (!value.trim() || !isValidLocator(value)) return;
            setToLocator(value.trim().toUpperCase().replace(/\s/g, ''));
          }}
          error={toError}
        />
      ) : null}

      {mode === 'address' ? (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            {hasMapboxToken
              ? 'Enter an address or postcode. Choose Mapbox or Photon (OpenStreetMap).'
              : 'Using Photon (OpenStreetMap). Set a Mapbox token in Settings for Mapbox.'}
          </Text>
          {hasMapboxToken ? (
            <SegmentedControl
              options={GEOCODE_PROVIDER_OPTIONS}
              value={geocodeProvider}
              onChange={setGeocodeProvider}
            />
          ) : null}
          <Group align="flex-end" grow>
            <TextInput
              label="Address or postcode"
              placeholder="e.g. G1 1XQ, Glasgow"
              value={addressQuery}
              onChange={(e) => setAddressQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleGeocode();
                }
              }}
            />
            <Button
              onClick={() => void handleGeocode()}
              loading={geocodeLoading}
              style={{ flexShrink: 0 }}
            >
              Look up
            </Button>
          </Group>
          {geocodeError ? (
            <Text size="sm" c="red" role="alert">
              {geocodeError}
            </Text>
          ) : null}
          {geocodeLabel ? (
            <Text size="sm" c="dimmed">
              {geocodeLabel}
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
