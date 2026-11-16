/** Colour slots and tick maths for `LineChart` and the charts drawn next to it. */

/** Categorical slots 1–8, light and dark steps (validated for CVD separation on the chart surfaces). */
const SLOTS_LIGHT = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#6250d6',
  '#e34948',
];
const SLOTS_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
];

/** A slot's light or dark step. Slots run 0–7; callers fold anything beyond into fewer series. */
export function lineChartSlotColor(slot: number, scheme: 'light' | 'dark'): string {
  const slots = scheme === 'dark' ? SLOTS_DARK : SLOTS_LIGHT;
  return slots[slot % slots.length];
}

/**
 * Round ticks covering [lo, hi], about `count` of them. With `integer`, the step is at least 1, so a small integer
 * range (an all-zero series on 0–1) gets ticks 0 and 1, never repeated rounded labels.
 */
export function niceTicks(lo: number, hi: number, count = 5, integer = false): number[] {
  if (hi <= lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  let step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  if (integer) step = Math.max(1, step);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(v);
  return out;
}

/** The y range and ticks of a chart: fixed when given, else the data's range (always including 0 to 1) rounded to ticks. */
export function yAxisFor(
  values: readonly number[],
  fixed?: readonly [number, number],
): { lo: number; hi: number; ticks: number[] } {
  const integer = values.every(Number.isInteger) && (!fixed || fixed.every(Number.isInteger));
  let [lo, hi] = fixed ?? [Math.min(...values, 0), Math.max(...values, 1)];
  if (!fixed) {
    const ticks = niceTicks(lo, hi, 5, integer);
    const step = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
  }
  if (hi <= lo) hi = lo + 1;
  return { lo, hi, ticks: niceTicks(lo, hi, 5, integer) };
}
