import { Checkbox, Input, Slider, Stack, Text } from '@mantine/core';
import { useId } from 'react';
import classes from './PercentLevelSlider.module.css';

export const PERCENT_LEVEL_STEP = 5;

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
  /**
   * When false, omit the `— {value}` suffix and hide the primary thumb.
   * Defaults to hiding when `value` is null (radio default).
   */
  showValue?: boolean;
  /** Radio-default checkbox. Hide when a parent gradient owns Default. Default true. */
  showDefaultCheckbox?: boolean;
  /** Numeric percents from a bulk selection — secondary dots on the track. Nulls omitted. */
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
  showValue,
  showDefaultCheckbox = true,
  previewValues,
}: PercentLevelSliderProps) {
  const useDefaultId = useId();
  const sliderId = useId();
  const isDefault = value == null;
  const committedValue =
    value == null ? Math.max(min, snapPercentToStep(50, step)) : snapPercentToStep(value, step);
  const valueLabel = formatPercentLevelLabel(value, { zeroLabel, defaultLabel });
  const displayValue = showValue ?? !isDefault;
  const hideThumb = !displayValue;
  const sliderValue = hideThumb ? min : committedValue;

  const previewPercents = (previewValues ?? []).map((v) => (v == null ? 50 : v));

  return (
    <Input.Wrapper
      label={
        displayValue ? (
          <Text component="span" inherit>
            {label}{' '}
            <Text component="span" c="dimmed" inherit>
              — {valueLabel}
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
        <div className={classes.trackWrap}>
          <Slider
            id={sliderId}
            aria-label={label}
            value={sliderValue}
            onChange={(v) => onChange(snapPercentToStep(v, step))}
            min={min}
            max={max}
            step={step}
            marks={[...PERCENT_LEVEL_MARKS]}
            disabled={isDefault || hideThumb}
            mb={16}
            classNames={{
              thumb: hideThumb ? classes.thumbHidden : undefined,
              bar: hideThumb ? classes.barHidden : undefined,
            }}
          />
          {previewPercents.length > 0 ? (
            <div className={classes.previewLayer} aria-hidden data-preview-dots="">
              {previewPercents.map((percent, index) => (
                <span
                  key={`${percent}-${index}`}
                  className={classes.previewDot}
                  style={{ left: `${((percent - min) / (max - min)) * 100}%` }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </Stack>
    </Input.Wrapper>
  );
}
