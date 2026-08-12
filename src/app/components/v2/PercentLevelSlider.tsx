import { Checkbox, Input, Slider, Stack, Text } from '@mantine/core';
import { useId } from 'react';

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
}: PercentLevelSliderProps) {
  const useDefaultId = useId();
  const sliderId = useId();
  const isDefault = value == null;
  const sliderValue =
    value == null ? Math.max(min, snapPercentToStep(50, step)) : snapPercentToStep(value, step);
  const valueLabel = formatPercentLevelLabel(value, { zeroLabel, defaultLabel });

  return (
    <Input.Wrapper
      label={
        <Text component="span" inherit>
          {label}{' '}
          <Text component="span" c="dimmed" inherit>
            — {valueLabel}
          </Text>
        </Text>
      }
      description={description}
    >
      <Stack gap="xs" mt={4}>
        <Checkbox
          id={useDefaultId}
          label={defaultLabel}
          checked={isDefault}
          onChange={(e) => {
            if (e.currentTarget.checked) {
              onChange(null);
            } else {
              onChange(sliderValue);
            }
          }}
        />
        <Slider
          id={sliderId}
          aria-label={label}
          value={sliderValue}
          onChange={(v) => onChange(snapPercentToStep(v, step))}
          min={min}
          max={max}
          step={step}
          marks={[...PERCENT_LEVEL_MARKS]}
          disabled={isDefault}
          mb={16}
        />
      </Stack>
    </Input.Wrapper>
  );
}
