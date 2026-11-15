import type { Dm32DebugCapture } from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';

/** A synthetic 4096-byte page whose last byte is `tag`. Nothing from a real radio. */
export function dm32Page(tag: number): Uint8Array {
  const data = new Uint8Array(4096);
  data[0xfff] = tag;
  return data;
}

const hexPairs = (digits: string) => digits.match(/../g)!.map((pair) => parseInt(pair, 16));
/** u32 little-endian BCD of an 8-digit number (10 Hz units). */
const bcd32 = (digits: string) => hexPairs(digits).reverse();
/** u16 little-endian BCD of a 4-digit number (100 kHz units). */
const bcd16 = (digits: string) => hexPairs(digits).reverse();

/**
 * A synthetic calibration page with a different, valid value in every traced field.
 * Unspecified bytes follow `(i * 7 + 3) & 0xFF`, so 0x00 and 0xFF appear as real values.
 */
export function dm32GoldenCalibrationPage(): Uint8Array {
  const page = Uint8Array.from({ length: 4096 }, (_, i) => (i * 7 + 3) & 0xff);
  const put = (offset: number, bytes: number[]) => page.set(bytes, offset);
  put(0x000, [...bcd16('4000'), ...bcd16('4700')]);
  put(0x0cc, [...bcd16('1360'), ...bcd16('1740')]);
  const uhf = ['40000000', '41750000', '43500000', '45250000', '47000000'];
  const vhf = ['13600000', '14550000', '15500000', '16450000', '17400000'];
  [0x300, 0x314].forEach((offset) => uhf.forEach((f, i) => put(offset + i * 4, bcd32(f))));
  [0x328, 0x33c].forEach((offset) => vhf.forEach((f, i) => put(offset + i * 4, bcd32(f))));
  put(0x00c, [0x58, 0x02]); // 600
  put(0x00e, [0x7c, 0x02]); // 636
  page[0xfff] = 0x02;
  return page;
}

/** A synthetic 4096-byte factory sector: GPS set, unrestricted region. */
export function dm32FactoryBytes(): Uint8Array {
  const data = Uint8Array.from({ length: 4096 }, (_, i) => (i * 5 + 1) & 0xff);
  data[0x80] = 0x9e;
  data[0xa1] = 0xa5;
  data.set([0xd1, 0xd2, 0xd3, 0xd4], 0x10c);
  return data;
}

/** A guarded capture of one channel-tagged block; override fields for the case under test. */
export function dm32Capture(overrides: Partial<Dm32DebugCapture> = {}): Dm32DebugCapture {
  return {
    capturedAt: '2026-01-01T00:00:00.000Z',
    modelString: 'DP570UV',
    factory: { status: 'not-kept', reason: 'mismatch' },
    vframes: [
      { id: 0x01, status: 'ok', payload: new TextEncoder().encode('DM32.SYN.001') },
      { id: 0x02, status: 'ok', payload: Uint8Array.from({ length: 12 }, (_, i) => i + 0xa0) },
      { id: 0x0a, status: 'ok', payload: new Uint8Array([0, 0x10, 0, 0, 0xff, 0x2f, 0, 0]) },
    ],
    rawRange: { start: 0x1000, end: 0x2fff },
    window: { start: 0x1000, end: 0x2000 },
    discovered: [
      { address: 0x1000, metadata: 0x12, type: 'channel' },
      { address: 0x2000, metadata: 0x03, type: 'unknown' },
    ],
    channelCount: 0,
    blocks: new Map([[0x1000, dm32Page(0x12)]]),
    ...overrides,
  };
}

/** The same capture plus a golden calibration page at `calibrationAddress` (default 0x2000, in window). */
export function dm32CalibrationCapture(
  overrides: Partial<Dm32DebugCapture> & { calibrationAddress?: number } = {},
): Dm32DebugCapture {
  const { calibrationAddress = 0x2000, ...rest } = overrides;
  return dm32Capture({
    discovered: [
      { address: 0x1000, metadata: 0x12, type: 'channel' },
      { address: calibrationAddress, metadata: 0x02, type: 'unknown' },
    ],
    blocks: new Map([
      [0x1000, dm32Page(0x12)],
      [calibrationAddress, dm32GoldenCalibrationPage()],
    ]),
    ...rest,
  });
}
