import { Checkbox, Input, Slider, Stack, Text } from '@mantine/core';
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import classes from './PercentLevelSlider.module.css';

export const PERCENT_LEVEL_STEP = 5;

/** Width of the extra-endpoint zone, as a share of the ordinary min–max span. */
const EXTRA_ZONE_SHARE = 0.13;

export const PERCENT_LEVEL_MARKS = [
  { value: 0, label: '0' },
  { value: 25, label: '25' },
  { value: 50, label: '50' },
  { value: 75, label: '75' },
  { value: 100, label: '100' },
] as const;

export function snapPercentToStep(value: number, step = PERCENT_LEVEL_STEP): number {
  return Math.min(100, Math.max(0, Math.round(value / step) * step));
}

export function formatPercentLevelLabel(
  value: number | null,
  options?: { zeroLabel?: string; defaultLabel?: string },
): string {
  const defaultLabel = options?.defaultLabel ?? 'Radio default';
  if (value == null) return defaultLabel;
  if (value === 0 && options?.zeroLabel) return options.zeroLabel;
  return `${value}%`;
}

export interface PercentLevelSliderProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  zeroLabel?: string;
  defaultLabel?: string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Adds a named final position above max. The position must align with min and step. */
  extraEndpoint?: { value: number; label: string };
  /**
   * When false, omit the `— {value}` suffix and hide the primary thumb.
   * Defaults to hiding when `value` is null (radio default).
   */
  showValue?: boolean;
  /** Radio-default checkbox. Hide when a parent gradient owns Default. Default true. */
  showDefaultCheckbox?: boolean;
  /** Bulk selection values shown as secondary dots. Nulls are drawn at 50. */
  previewValues?: readonly (number | null)[];
}

export default function PercentLevelSlider({
  label,
  value,
  onChange,
  zeroLabel,
  defaultLabel = 'Radio default',
  description,
  min = 0,
  max = 100,
  step = PERCENT_LEVEL_STEP,
  extraEndpoint,
  showValue,
  showDefaultCheckbox = true,
  previewValues,
}: PercentLevelSliderProps) {
  const useDefaultId = useId();
  const sliderId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const isDefault = value == null;
  // With an extra endpoint the track runs past max into a zone. Every position in the
  // zone means the endpoint; the thumb sits at the zone's far end when it is chosen.
  const zoneUnits = extraEndpoint ? Math.max(step, Math.round((max - min) * EXTRA_ZONE_SHARE)) : 0;
  const trackMax = max + zoneUnits;
  const isExtra = extraEndpoint != null && value === extraEndpoint.value;
  const snapOrdinary = (level: number) =>
    extraEndpoint
      ? Math.min(max, Math.max(min, min + Math.round((level - min) / step) * step))
      : snapPercentToStep(level, step);
  const toTrack = (level: number) =>
    extraEndpoint && level > max ? trackMax : snapOrdinary(level);
  const fromTrack = (position: number) =>
    extraEndpoint && position > max ? extraEndpoint.value : snapOrdinary(position);
  const committedValue =
    value == null ? Math.max(min, snapOrdinary(50)) : isExtra ? value : snapOrdinary(value);
  const formatValue = (level: number | null) =>
    extraEndpoint && level === extraEndpoint.value
      ? extraEndpoint.label
      : formatPercentLevelLabel(level, { zeroLabel, defaultLabel });
  const marks = extraEndpoint
    ? PERCENT_LEVEL_MARKS.filter((mark) => mark.value >= min && mark.value <= max)
    : [...PERCENT_LEVEL_MARKS];
  const displayValue = showValue ?? !isDefault;
  const hideThumb = !displayValue;
  const sliderValue = hideThumb ? min : toTrack(committedValue);
  const disabled = isDefault || hideThumb;

  // Mantine reports the zone's far end as aria-valuemax; the real maximum is the endpoint.
  useEffect(() => {
    if (!extraEndpoint) return;
    trackRef.current
      ?.querySelector('[role="slider"]')
      ?.setAttribute('aria-valuemax', String(extraEndpoint.value));
  });

  // Inside the zone, one step left must leave it rather than land elsewhere in it.
  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!extraEndpoint || disabled || !isExtra) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      onChange(max);
    }
  };

  const previewPercents = (previewValues ?? []).map((v) => (v == null ? 50 : v));
  const trackPercent = (level: number) =>
    ((Math.min(trackMax, Math.max(min, extraEndpoint && level > max ? trackMax : level)) - min) /
      (trackMax - min)) *
    100;

  return (
    <Input.Wrapper
      label={
        displayValue ? (
          <Text component="span" inherit>
            {label}{' '}
            <Text component="span" c="dimmed" inherit>
              — {formatValue(value)}
            </Text>
          </Text>
        ) : (
          label
        )
      }
      description={description}
    >
      <Stack gap="xs" mt={4}>
        {showDefaultCheckbox ? (
          <Checkbox
            id={useDefaultId}
            label={defaultLabel}
            checked={isDefault}
            onChange={(e) => {
              if (e.currentTarget.checked) {
                onChange(null);
              } else {
                onChange(committedValue);
              }
            }}
          />
        ) : null}
        <div className={classes.trackWrap} ref={trackRef} onKeyDownCapture={onKeyDownCapture}>
          <Slider
            id={sliderId}
            thumbLabel={label}
            thumbValueText={extraEndpoint ? formatValue : undefined}
            label={extraEndpoint ? formatValue : undefined}
            scale={extraEndpoint ? (v) => (v > max ? extraEndpoint.value : v) : undefined}
            color={isExtra && !hideThumb ? 'orange' : undefined}
            value={sliderValue}
            onChange={(v) => onChange(extraEndpoint ? fromTrack(v) : snapPercentToStep(v, step))}
            min={min}
            max={trackMax}
            step={step}
            marks={marks}
            disabled={disabled}
            mb={16}
            classNames={{
              thumb: hideThumb ? classes.thumbHidden : undefined,
              bar: hideThumb ? classes.barHidden : undefined,
            }}
          />
          {extraEndpoint ? (
            <div
              className={classes.extraZone}
              aria-hidden
              data-extra-zone=""
              data-active={isExtra && !hideThumb ? '' : undefined}
              data-disabled={disabled ? '' : undefined}
              style={{ ['--zone-start' as string]: trackPercent(max) }}
            />
          ) : null}
          {previewPercents.length > 0 ? (
            <div className={classes.previewLayer} aria-hidden data-preview-dots="">
              {previewPercents.map((percent, index) => (
                <span
                  key={`${percent}-${index}`}
                  className={classes.previewDot}
                  style={{ left: `${trackPercent(percent)}%` }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </Stack>
    </Input.Wrapper>
  );
}
