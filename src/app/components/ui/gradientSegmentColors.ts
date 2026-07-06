import type { MantineTheme } from '@mantine/core';

/** Mantine palette name (e.g. `teal`) or raw CSS color. */
export type SegmentColor = string;

export function resolveSegmentColor(color: SegmentColor, theme: MantineTheme): string {
  if (/^(#|rgb|hsl|var\()/i.test(color)) return color;
  const palette = theme.colors[color];
  if (palette) {
    const shade = theme.primaryShade;
    const idx = typeof shade === 'number' ? shade : shade.dark;
    return palette[idx] ?? palette[6];
  }
  return color;
}

/** Horizontal band gradient — one solid band per segment. */
export function buildTrackGradient(colors: string[]): string {
  if (colors.length === 0) return 'var(--mantine-color-default)';
  if (colors.length === 1) return colors[0];
  const stops: string[] = [];
  colors.forEach((color, i) => {
    const start = (i / colors.length) * 100;
    const end = ((i + 1) / colors.length) * 100;
    stops.push(`${color} ${start}%`, `${color} ${end}%`);
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}
