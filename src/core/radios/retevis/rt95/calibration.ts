/** Static MAIN V1.61 / head V1.41 trace; input is a captured prefix starting at 0x3B00. */
export const RT95_CALIBRATION_START = 0x3b00;
export const RT95_CALIBRATION_LENGTH = 0x4c0;
export type Rt95Availability = 'captured' | 'partial' | 'not-captured';
export interface Rt95Field {
  label: string;
  address: number;
  width: number;
  raw: Uint8Array;
  availability: Rt95Availability;
  layout: 'traced';
  meaning: 'traced' | 'partially-traced' | 'unknown';
  source: string;
  order: 'bytes' | 'assumed-little-endian';
  value?: number;
  referenceIndex?: number;
  powerCode?: number;
  corrections?: readonly (number | undefined)[];
}

export function decodeRt95Calibration(input?: Uint8Array): {
  fields: Rt95Field[];
  raw: Uint8Array;
} {
  const raw = (input ?? new Uint8Array()).slice(0, RT95_CALIBRATION_LENGTH);
  const fields: Rt95Field[] = [];
  const add = (
    label: string,
    address: number,
    width: number,
    meaning: Rt95Field['meaning'],
    source: string,
    extra: Partial<Rt95Field> = {},
  ) => {
    const offset = address - RT95_CALIBRATION_START;
    const bytes = raw.slice(offset, offset + width);
    const availability =
      bytes.length === width ? 'captured' : bytes.length ? 'partial' : 'not-captured';
    fields.push({
      label,
      address,
      width,
      raw: bytes,
      availability,
      layout: 'traced',
      meaning,
      source,
      order: 'bytes',
      ...extra,
      ...(availability === 'captured' && width === 1 ? { value: bytes[0] } : {}),
      ...(availability === 'captured' && extra.order === 'assumed-little-endian'
        ? { value: bytes[0]! | (bytes[1]! << 8) }
        : {}),
    });
  };
  add('Model check text', 0x3b00, 7, 'traced', 'MAIN 0x0800A872');
  add('Stored version text', 0x3b07, 4, 'traced', 'MAIN 0x0800A832; CPS trace');
  add('RF firmware field', 0x3b0b, 2, 'partially-traced', 'MAIN 0x080073BE; CPS trace');
  add('LCD firmware field', 0x3b0d, 2, 'partially-traced', 'MAIN 0x080073BE; CPS trace');
  add('Band code', 0x3b0f, 1, 'partially-traced', 'MAIN 0x08007400');
  add('Flags', 0x3b10, 1, 'partially-traced', 'MAIN 0x08007400');
  for (const address of [0x3b14, 0x3b1c])
    add('Unknown caption text', address, 4, 'unknown', 'CPS trace');
  add('Password comparison bytes', 0x3b18, 4, 'partially-traced', 'CPS trace');
  for (let i = 0; i < 8; i++)
    add(`Production text row ${i + 1}`, 0x3b20 + i * 16, 16, 'unknown', 'CPS trace');
  add('Description/dealer text area', 0x3ba0, 96, 'partially-traced', 'CPS trace');
  for (const [base, length, referenceIndex] of [
    [0x3cc0, 39, 19],
    [0x3d80, 91, 45],
  ] as const) {
    for (let powerCode = 0; powerCode < 3; powerCode++)
      add(
        `Frequency correction table · power code ${powerCode}`,
        base + powerCode * (length === 39 ? 0x40 : 0x80),
        length,
        'partially-traced',
        'MAIN 0x08008E06',
        { referenceIndex, powerCode },
      );
  }
  for (const address of [0x3f00, 0x3f10, 0x3f20, 0x3f30])
    add('Threshold increments', address, 9, 'partially-traced', 'MAIN 0x08007EE8 / 0x0800A9E8');
  for (const address of [0x3f40, 0x3f50, 0x3f60, 0x3f70])
    for (let i = 0; i < 3; i++)
      add(`Working record slice ${i}`, address + i * 4, 4, 'unknown', 'MAIN 0x08007BC4');
  for (const [base, length] of [
    [0x3f80, 19],
    [0x3fa0, 20],
  ] as const) {
    add('Base byte', base, 1, 'partially-traced', 'MAIN 0x08007F34');
    for (let i = 0; i < 3; i++)
      add(
        `Correction base · power code ${i}`,
        base + 1 + i,
        1,
        'partially-traced',
        'MAIN 0x08008E06',
        { powerCode: i },
      );
    add('Threshold base', base + 4, 1, 'partially-traced', 'MAIN 0x0800A9E8');
    add('Unknown byte', base + 5, 1, 'unknown', 'MAIN 0x08007400');
    for (let i = 0; i < 3; i++)
      add(`16-bit field ${i}`, base + 6 + i * 2, 2, 'partially-traced', 'MAIN 0x0800905A', {
        order: 'assumed-little-endian',
      });
    add('Selected bytes', base + 12, 6, 'partially-traced', 'MAIN 0x0800905A');
    add('Meter threshold base', base + 18, 1, 'partially-traced', 'MAIN 0x08007EE8');
    if (length === 20) add('Unknown byte', base + 19, 1, 'unknown', 'MAIN 0x08007400');
  }
  for (const field of fields) {
    if (field.referenceIndex === undefined || field.powerCode === undefined) continue;
    const baseAddress = (field.width === 39 ? 0x3f81 : 0x3fa1) + field.powerCode;
    const base = raw[baseAddress - RT95_CALIBRATION_START];
    const reference = field.raw[field.referenceIndex];
    field.corrections = Array.from({ length: field.width }, (_, i) => {
      const value = field.raw[i];
      return base === undefined || reference === undefined || value === undefined
        ? undefined
        : base + value - reference;
    });
  }
  return { fields, raw };
}
