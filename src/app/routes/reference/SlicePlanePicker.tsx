import { Input, Slider, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import {
  compassOctant,
  formatDistanceKmAndMi,
  pathMetricsBetween,
} from '@core/domain/geoDistance.ts';
import { isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import type { GeoPoint } from '@core/models/libraryTypes.ts';
import { FormField, SegmentedControl } from '../../components/v2/index.ts';

type SlicePlaneMode = 'bearing' | 'locator';

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
}

export default function SlicePlanePicker({
  transmitterLocation,
  defaultBearingDeg,
  onChange,
}: SlicePlanePickerProps) {
  const [mode, setMode] = useState<SlicePlaneMode>('bearing');
  const [bearingTouched, setBearingTouched] = useState(false);
  const [manualBearingDeg, setManualBearingDeg] = useState(defaultBearingDeg);
  const [manualRangeM, setManualRangeM] = useState(DEFAULT_RANGE_M);
  const [toLocator, setToLocator] = useState('');

  useEffect(() => {
    if (!bearingTouched) setManualBearingDeg(defaultBearingDeg);
  }, [defaultBearingDeg, bearingTouched]);

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

  const resolved: SlicePlaneResult = useMemo(
    () =>
      resolveSlicePlane({
        mode,
        manualBearingDeg,
        manualRangeM,
        transmitterLocation,
        toCoords: toCoordsFromLocator,
      }),
    [mode, manualBearingDeg, manualRangeM, toCoordsFromLocator, transmitterLocation],
  );

  useEffect(() => {
    onChange(resolved);
  }, [onChange, resolved]);

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
                setBearingTouched(true);
                setManualBearingDeg(value);
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
      ) : (
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
      )}
    </Stack>
  );
}
