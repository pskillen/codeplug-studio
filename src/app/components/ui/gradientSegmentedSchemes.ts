export interface GradientSegmentScheme {
  /** Mantine palette names or CSS colors — one per segment (left → right). */
  segmentColors: readonly string[];
}

/** Affirmative / inactive — generic boolean toggles. */
export const ON_OFF_SCHEME: GradientSegmentScheme = {
  segmentColors: ['teal', 'gray'],
};

/** Permit / restrict — channel transmit permission. */
export const ALLOW_FORBID_SCHEME: GradientSegmentScheme = {
  segmentColors: ['teal', 'orange'],
};

/** Three-segment cool → warm progression. */
export const THREE_SEGMENT_SCHEME: GradientSegmentScheme = {
  segmentColors: ['blue', 'yellow', 'orange'],
};

/** Four-segment progression. */
export const FOUR_SEGMENT_SCHEME: GradientSegmentScheme = {
  segmentColors: ['blue', 'cyan', 'lime', 'orange'],
};

/** Five-segment progression. */
export const FIVE_SEGMENT_SCHEME: GradientSegmentScheme = {
  segmentColors: ['blue', 'cyan', 'teal', 'lime', 'orange'],
};

export const GRADIENT_SEGMENT_SCHEMES = {
  onOff: ON_OFF_SCHEME,
  allowForbid: ALLOW_FORBID_SCHEME,
  three: THREE_SEGMENT_SCHEME,
  four: FOUR_SEGMENT_SCHEME,
  five: FIVE_SEGMENT_SCHEME,
} as const;

export type GradientSegmentSchemeName = keyof typeof GRADIENT_SEGMENT_SCHEMES;

export function resolveScheme(
  scheme?: GradientSegmentSchemeName | GradientSegmentScheme,
): GradientSegmentScheme {
  if (!scheme) return ON_OFF_SCHEME;
  if (typeof scheme === 'string') return GRADIENT_SEGMENT_SCHEMES[scheme];
  return scheme;
}

/** Fit a scheme palette to the segment count (truncate or pad with the last colour). */
export function segmentColorsForCount(scheme: GradientSegmentScheme, count: number): string[] {
  const { segmentColors } = scheme;
  if (count <= 0) return [];
  if (count <= segmentColors.length) return [...segmentColors.slice(0, count)];
  const out = [...segmentColors];
  const last = segmentColors[segmentColors.length - 1] ?? 'gray';
  while (out.length < count) out.push(last);
  return out;
}
