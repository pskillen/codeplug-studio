import { formatHexDec, NOT_CAPTURED_TEXT, type TrimView } from '@integrations/radio-io/debugView';

export function neutralOf(chart: TrimView): number {
  return chart.scale.neutral ?? (chart.scale.min + chart.scale.max) / 2;
}

/** The ppm offset of a raw trim value, or undefined when the model has no ppm scale. */
export function trimPpm(chart: TrimView, raw: number): number | undefined {
  if (!chart.ppm) return undefined;
  return Math.round((raw - neutralOf(chart)) * chart.ppm.perStep * 1000) / 1000;
}

/** The value line: `0x0C (12), +2 ppm`; raw only when there is no ppm scale; "Not captured" when missing. */
export function trimValueText(chart: TrimView, raw: number | undefined): string {
  if (raw === undefined) return NOT_CAPTURED_TEXT;
  const ppm = trimPpm(chart, raw);
  if (ppm === undefined) return formatHexDec(raw);
  return `${formatHexDec(raw)}, ${ppm > 0 ? '+' : ''}${ppm} ppm`;
}
