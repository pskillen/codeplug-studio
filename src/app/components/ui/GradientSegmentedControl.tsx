import { Input, SegmentedControl, useMantineTheme, type MantineSize } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import classes from './GradientSegmentedControl.module.css';
import { resolveSegmentColor } from './gradientSegmentColors.ts';
import {
  type GradientSegmentScheme,
  type GradientSegmentSchemeName,
  resolveScheme,
  segmentColorsForCount,
} from './gradientSegmentedSchemes.ts';

export interface GradientSegmentOption<T extends string = string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface GradientSegmentedControlProps<T extends string = string> {
  label?: ReactNode;
  description?: ReactNode;
  value: T;
  onChange: (value: T) => void;
  data: readonly GradientSegmentOption<T>[];
  /** Named preset or explicit palette. Omit for a plain Mantine segmented control. */
  scheme?: GradientSegmentSchemeName | GradientSegmentScheme;
  /** Override segment colours — length should match `data`. */
  segmentColors?: readonly string[];
  fullWidth?: boolean;
  disabled?: boolean;
  size?: MantineSize;
}

export default function GradientSegmentedControl<T extends string>({
  label,
  description,
  value,
  onChange,
  data,
  scheme,
  segmentColors,
  fullWidth,
  disabled,
  size,
}: GradientSegmentedControlProps<T>) {
  const theme = useMantineTheme();
  const hasColorScheme = Boolean(scheme || segmentColors);

  const rawColors = useMemo(() => {
    if (segmentColors) return [...segmentColors];
    if (!scheme) return [];
    return segmentColorsForCount(resolveScheme(scheme), data.length);
  }, [segmentColors, scheme, data.length]);

  const resolvedColors = useMemo(
    () => rawColors.map((c) => resolveSegmentColor(c, theme)),
    [rawColors, theme],
  );

  const activeIndex = Math.max(
    0,
    data.findIndex((item) => item.value === value),
  );
  const indicatorColor = resolvedColors[activeIndex] ?? resolvedColors[0];

  const control = (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as T)}
      data={data.map((item) => ({
        value: item.value,
        label: item.label,
        disabled: item.disabled,
      }))}
      fullWidth={fullWidth}
      disabled={disabled}
      size={size}
      autoContrast={hasColorScheme}
      classNames={hasColorScheme ? { indicator: classes.indicator } : undefined}
      styles={
        hasColorScheme ? { root: { '--sc-color': indicatorColor } as CSSProperties } : undefined
      }
    />
  );

  if (label != null) {
    return (
      <Input.Wrapper label={label} description={description}>
        {control}
      </Input.Wrapper>
    );
  }

  return control;
}
