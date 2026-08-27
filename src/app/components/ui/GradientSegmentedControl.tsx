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

/** Sentinel for bulk-edit idle / “No change”. Not a domain value. */
export const GRADIENT_SEGMENT_IDLE_VALUE = '__unchanged__';

export interface GradientSegmentedControlProps<T extends string = string> {
  label?: ReactNode;
  description?: ReactNode;
  value: T;
  onChange: (value: T) => void;
  data: readonly GradientSegmentOption<T>[];
  /**
   * Offset first button, visually separate from the gradient group but still one
   * control. Used for bulk-edit “No change”. Idle is treated as an extra neutral
   * (no palette colour). Channel editors should omit this.
   */
  idleOption?: GradientSegmentOption<T>;
  /**
   * Domain value shared by every item in a bulk selection. When idle, the primary
   * (filled) indicator sits on this option and the idle segment gets the outline.
   * When opted in, both sit on the chosen value. Visual only — Apply still uses
   * the parent’s opted-in patch.
   */
  sharedValue?: T;
  /** Named preset or explicit palette. Omit for a plain Mantine segmented control. */
  scheme?: GradientSegmentSchemeName | GradientSegmentScheme;
  /** Override segment colours — length should match `data` (not including `idleOption`). */
  segmentColors?: readonly string[];
  /**
   * Option values excluded from palette fitting and rendered with no colour override
   * (falls back to Mantine's default indicator). Default `['default']` — pass `[]` to
   * disable, or override for wrappers that spell their neutral option differently
   * (e.g. `['auto']`). Idle option values are always treated as extra neutrals.
   */
  neutralValues?: readonly string[];
  /**
   * `'stack'` (default) — label/description above a control that respects `fullWidth`.
   * `'row'` — label+description left, control right; stacks on mobile.
   * `'column'` — label, then intrinsic-width control, then description below (bulk edit).
   */
  layout?: 'stack' | 'row' | 'column';
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
  idleOption,
  sharedValue,
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
  const segments = useMemo(() => (idleOption ? [idleOption, ...data] : data), [idleOption, data]);
  const effectiveNeutralValues = useMemo(() => {
    if (!idleOption) return neutralValues;
    return [...neutralValues, idleOption.value];
  }, [idleOption, neutralValues]);

  const rawColors = useMemo((): (string | null)[] => {
    const domainColors = segmentColors
      ? [...segmentColors]
      : scheme
        ? segmentColorsForOptions(
            resolveScheme(scheme),
            data.map((item) => item.value),
            effectiveNeutralValues,
          )
        : [];
    if (!idleOption) return domainColors;
    return [null, ...domainColors];
  }, [segmentColors, scheme, data, effectiveNeutralValues, idleOption]);

  const resolvedColors = useMemo(
    () => rawColors.map((c) => (c == null ? null : resolveSegmentColor(c, theme))),
    [rawColors, theme],
  );

  const isIdle = Boolean(idleOption && value === idleOption.value);
  const invertShared = isIdle && sharedValue != null;
  const visualPrimaryIndex = invertShared
    ? segments.findIndex((item) => item.value === sharedValue)
    : segments.findIndex((item) => item.value === value);
  const visualPrimaryColor = visualPrimaryIndex >= 0 ? resolvedColors[visualPrimaryIndex] : null;

  const activeIndex = Math.max(
    0,
    segments.findIndex((item) => item.value === value),
  );
  const indicatorColor = resolvedColors[activeIndex];
  const showColorOverride = hasColorScheme && indicatorColor != null && !invertShared;

  const effectiveFullWidth =
    layout === 'row' ? isMobile : layout === 'column' ? Boolean(fullWidth) : fullWidth;

  const rootClass = [
    idleOption ? classes.withIdle : undefined,
    invertShared ? classes.hideIndicator : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  const control = (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as T)}
      data={segments.map((item) => {
        const isVisualPrimary = invertShared && item.value === sharedValue;
        const outlineIdle = invertShared && idleOption != null && item.value === idleOption.value;
        const outlineOptedIn = !isIdle && item.value === value;
        const className = [
          isVisualPrimary ? classes.sharedPrimary : undefined,
          outlineIdle || outlineOptedIn ? classes.sharedHint : undefined,
        ]
          .filter(Boolean)
          .join(' ');
        return {
          value: item.value,
          label: (
            <span
              className={className || undefined}
              style={
                isVisualPrimary && visualPrimaryColor
                  ? ({
                      backgroundColor: visualPrimaryColor,
                      color: 'var(--mantine-color-white)',
                    } as CSSProperties)
                  : undefined
              }
            >
              {item.label}
            </span>
          ),
          disabled: item.disabled,
        };
      })}
      fullWidth={effectiveFullWidth}
      disabled={disabled}
      size={size}
      autoContrast={hasColorScheme}
      classNames={{
        indicator: hasColorScheme ? classes.indicator : undefined,
        root: rootClass || undefined,
      }}
      styles={
        showColorOverride ? { root: { '--sc-color': indicatorColor } as CSSProperties } : undefined
      }
    />
  );

  if (layout === 'column' && (label != null || description != null)) {
    return (
      <div className={classes.column}>
        {label != null ? <div className={classes.rowLabel}>{label}</div> : null}
        <div className={classes.columnControl}>{control}</div>
        {description != null ? <div className={classes.rowDescription}>{description}</div> : null}
      </div>
    );
  }

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
