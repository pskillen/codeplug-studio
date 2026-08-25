import { Input, SegmentedControl, useMantineTheme, type MantineSize } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import classes from './GradientSegmentedControl.module.css';
import { resolveSegmentColor } from './gradientSegmentColors.ts';
import {
  type GradientSegmentScheme,
  type GradientSegmentSchemeName,
  resolveScheme,
  segmentColorsForOptions,
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
  /**
   * Option values excluded from palette fitting and rendered with no colour override
   * (falls back to Mantine's default indicator). Default `['default']` — pass `[]` to
   * disable, or override for wrappers that spell their neutral option differently
   * (e.g. `['auto']`).
   */
  neutralValues?: readonly string[];
  /**
   * `'stack'` (default) is today's layout — label/description above a control that
   * respects `fullWidth`. `'row'` puts label+description on the left and the control
   * on the right at its intrinsic width, collapsing to `'stack'`-like full-width
   * stacking below the app's shared mobile breakpoint.
   */
  layout?: 'stack' | 'row';
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
  neutralValues = ['default'],
  layout = 'stack',
  fullWidth,
  disabled,
  size,
}: GradientSegmentedControlProps<T>) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);
  const hasColorScheme = Boolean(scheme || segmentColors);

  const rawColors = useMemo((): (string | null)[] => {
    if (segmentColors) return [...segmentColors];
    if (!scheme) return [];
    return segmentColorsForOptions(
      resolveScheme(scheme),
      data.map((item) => item.value),
      neutralValues,
    );
  }, [segmentColors, scheme, data, neutralValues]);

  const resolvedColors = useMemo(
    () => rawColors.map((c) => (c == null ? null : resolveSegmentColor(c, theme))),
    [rawColors, theme],
  );

  const activeIndex = Math.max(
    0,
    data.findIndex((item) => item.value === value),
  );
  const indicatorColor = resolvedColors[activeIndex];
  const showColorOverride = hasColorScheme && indicatorColor != null;

  const effectiveFullWidth = layout === 'row' ? isMobile : fullWidth;

  const control = (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as T)}
      data={data.map((item) => ({
        value: item.value,
        label: item.label,
        disabled: item.disabled,
      }))}
      fullWidth={effectiveFullWidth}
      disabled={disabled}
      size={size}
      autoContrast={hasColorScheme}
      classNames={hasColorScheme ? { indicator: classes.indicator } : undefined}
      styles={
        showColorOverride ? { root: { '--sc-color': indicatorColor } as CSSProperties } : undefined
      }
    />
  );

  if (label != null && layout === 'row') {
    return (
      <div className={classes.row}>
        <div className={classes.rowCopy}>
          <div className={classes.rowLabel}>{label}</div>
          {description != null ? <div className={classes.rowDescription}>{description}</div> : null}
        </div>
        <div className={classes.rowControl}>{control}</div>
      </div>
    );
  }

  if (label != null) {
    return (
      <Input.Wrapper label={label} description={description}>
        {control}
      </Input.Wrapper>
    );
  }

  return control;
}
