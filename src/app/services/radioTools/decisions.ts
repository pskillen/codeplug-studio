/**
 * Owner decisions for Radio tools. One place to flip each. Interlocks never read this file.
 * Q7 lives in registry.ts (`prodDisabled`).
 */
export const RADIO_TOOLS_DECISIONS = {
  /** Q1: the area's name. */
  areaName: 'Radio tools',
  /** Q1: the fixed red strap under the title. */
  strap: "These change the radio itself. A Write can't undo them.",
} as const;
