/** CTCSS index table — facts from CHIRP anytone778uv TONE_MAP (GPL cite only). */

export const RT95_CTCSS_VAL_TO_HZ: Readonly<Record<number, number>> = {
  0x00: 62.5,
  0x01: 67.0,
  0x02: 69.3,
  0x03: 71.9,
  0x04: 74.4,
  0x05: 77.0,
  0x06: 79.7,
  0x07: 82.5,
  0x08: 85.4,
  0x09: 88.5,
  0x0a: 91.5,
  0x0b: 94.8,
  0x0c: 97.4,
  0x0d: 100.0,
  0x0e: 103.5,
  0x0f: 107.2,
  0x10: 110.9,
  0x11: 114.8,
  0x12: 118.8,
  0x13: 123.0,
  0x14: 127.3,
  0x15: 131.8,
  0x16: 136.5,
  0x17: 141.3,
  0x18: 146.2,
  0x19: 151.4,
  0x1a: 156.7,
  0x1b: 159.8,
  0x1c: 162.2,
  0x1d: 165.5,
  0x1e: 167.9,
  0x1f: 171.3,
  0x20: 173.8,
  0x21: 177.3,
  0x22: 179.9,
  0x23: 183.5,
  0x24: 186.2,
  0x25: 189.9,
  0x26: 192.8,
  0x27: 196.6,
  0x28: 199.5,
  0x29: 203.5,
  0x2a: 206.5,
  0x2b: 210.7,
  0x2c: 218.1,
  0x2d: 225.7,
  0x2e: 229.1,
  0x2f: 233.6,
  0x30: 241.8,
  0x31: 250.3,
  0x32: 254.1,
};

const HZ_TO_VAL = new Map<number, number>(
  Object.entries(RT95_CTCSS_VAL_TO_HZ).map(([k, v]) => [v, Number(k)]),
);

export function ctcssIndexToHz(index: number): number | null {
  return RT95_CTCSS_VAL_TO_HZ[index] ?? null;
}

export function hzToCtcssIndex(hz: number): number | null {
  return HZ_TO_VAL.get(hz) ?? null;
}
