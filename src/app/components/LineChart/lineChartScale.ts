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

/** Round ticks covering [lo, hi], about `count` of them. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (hi <= lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(v);
  return out;
}
