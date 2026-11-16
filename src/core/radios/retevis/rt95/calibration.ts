/**
 * Static MAIN V1.61 / head V1.41 / CPS 2.01 decode (radio-repo research F153-F161); input is a
 * captured prefix starting at 0x3B00. Every byte of 0x3B00-0x3FBF belongs to exactly one field.
 * Confidence vocabulary: traced (read in code), partially-traced (inferred or incomplete, see
 * `note`), unknown, unused (no reader). No calibration values live here, only shape and meaning.
 */
export const RT95_CALIBRATION_START = 0x3b00;
export const RT95_CALIBRATION_LENGTH = 0x4c0;
export const RT95_SIGNATURE_START = 0x3ff8;
export const RT95_SIGNATURE_END = 0x3fff;
/** Stored program password (CPS trace): masked on screen until the operator reveals it. */
export const RT95_PROGRAM_PASSWORD_ADDRESS = 0x3b18;
export const RT95_PROGRAM_PASSWORD_LENGTH = 4;
export type Rt95Availability = 'captured' | 'partial' | 'not-captured';
export interface Rt95Field {
  label: string;
  address: number;
  width: number;
  raw: Uint8Array;
  availability: Rt95Availability;
  layout: 'traced';
  /**
   * `unused` means nothing reads the bytes (MAIN, head or CPS): shown as "unused (no reader)",
   * not unknown. Squelch and S-meter dB scales, and the PC8/PC9 pin roles, are inferred.
   */
  meaning: 'traced' | 'partially-traced' | 'unknown' | 'unused';
  /** Evidence: function address or CPS control, plus the research ledger id where useful. */
  source: string;
  order: 'bytes' | 'little-endian';
  /** Units or encoding, where traced or inferred. */
  units?: string;
  /** Caveats, such as "inferred", that the bare confidence cannot carry. */
  note?: string;
  /** Read-only interpretation of the raw bytes (firmware version, BCD frequency). */
  decoded?: string;
  value?: number;
  text?: string;
  textField?: boolean;
  /** A secret (password bytes): the UI masks it until the operator reveals it. */
  sensitive?: boolean;
  referenceIndex?: number;
  powerCode?: number;
  corrections?: readonly (number | undefined)[];
}

/** Big-endian packed BCD (two digits per byte); undefined when a nibble is not a digit. */
function bcd(bytes: Uint8Array): number | undefined {
  let n = 0;
  for (const byte of bytes) {
    const hi = byte >> 4;
    const lo = byte & 0xf;
    if (hi > 9 || lo > 9) return undefined;
    n = n * 100 + hi * 10 + lo;
  }
  return n;
}

/** The firmware shows a version as `V<b0 & 0xF>.<b1 as two hex digits>`. */
function firmwareVersion(bytes: Uint8Array): string | undefined {
  return bytes.length === 2
    ? `V${bytes[0]! & 0xf}.${bytes[1]!.toString(16).padStart(2, '0')}`
    : undefined;
}

/** BCD in 10 Hz units (test-channel frequency or offset), shown in MHz. */
function bcdMhz(bytes: Uint8Array): string | undefined {
  const n = bcd(bytes);
  return n === undefined ? 'not valid BCD' : `${(n / 100000).toFixed(5)} MHz`;
}

type AddExtra = Partial<Rt95Field> & { decode?: (bytes: Uint8Array) => string | undefined };

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
    extra: AddExtra = {},
  ) => {
    const { decode, ...rest } = extra;
    const offset = address - RT95_CALIBRATION_START;
    const bytes = raw.slice(offset, offset + width);
    const availability =
      bytes.length === width ? 'captured' : bytes.length ? 'partial' : 'not-captured';
    const decoded = availability === 'captured' && decode ? decode(bytes) : undefined;
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
      ...rest,
      ...(decoded === undefined ? {} : { decoded }),
      ...(rest.textField && bytes.length
        ? {
            text: Array.from(bytes, (byte) =>
              byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : '.',
            ).join(''),
          }
        : {}),
      ...(availability === 'captured' && width === 1 ? { value: bytes[0] } : {}),
      ...(availability === 'captured' && rest.order === 'little-endian'
        ? { value: bytes[0]! | (bytes[1]! << 8) }
        : {}),
    });
  };
  const unused = (address: number, width: number, source = 'address scan; no reader') =>
    add('Unused (no reader)', address, width, 'unused', source);
  const text = (label: string, address: number, width: number, source: string, note?: string) =>
    add(label, address, width, 'traced', source, {
      textField: true,
      units: 'ASCII',
      ...(note ? { note } : {}),
    });

  text('Radio Type', 0x3b00, 7, 'MAIN 0x0800A872; CPS Combo1(0)', 'Model check text.');
  text('Version', 0x3b07, 4, 'CPS 0x508780', 'Stored version text.');
  add('RF FW', 0x3b0b, 2, 'traced', 'head 0x0800E748; CPS Text1(5)', {
    units: 'V<b0 low nibble>.<b1 hex digits>',
    note: 'Main-board firmware version as written at the factory.',
    decode: firmwareVersion,
  });
  add('LCD FW', 0x3b0d, 2, 'traced', 'head 0x0800E748; CPS Text1(12)', {
    units: 'V<b0 low nibble>.<b1 hex digits>',
    note: 'Head firmware version as written at the factory.',
    decode: firmwareVersion,
  });
  add('Band ("Frequency")', 0x3b0f, 1, 'traced', 'MAIN 0x080073BE; F125', {
    units: 'enum 0, 1, 2; above 2 reads as 0',
    note: 'The factory test screen MODE shows this byte plus 1.',
  });
  add(
    'Flags',
    0x3b10,
    1,
    'partially-traced',
    'MAIN 0x0800625A, 0x080061D6, 0x08006144, 0x08007400',
    {
      units: 'bits',
      note: 'Bit 0 factory (all test items); bits 3 and 2 are two remote-lock states (stun vs kill naming inferred), mirrored to status byte 2 bits 6/7; bits 1 and 4-7 unread.',
    },
  );
  unused(0x3b11, 3);
  text('User Code (客户代码)', 0x3b14, 4, 'CPS Text1(7)', 'Customer code.');
  add(
    'Program password compare',
    RT95_PROGRAM_PASSWORD_ADDRESS,
    RT95_PROGRAM_PASSWORD_LENGTH,
    'partially-traced',
    'CPS trace; F119',
    { sensitive: true, note: 'CPS compares on Read/Write; purpose inferred.' },
  );
  text('Area Code (销售区号)', 0x3b1c, 4, 'CPS Text1(0)', 'Sales area code.');
  text('Serial Number', 0x3b20, 16, 'CPS Text1(1)', 'Shown in full, never masked.');
  text('Producted Date', 0x3b30, 16, 'CPS Text1(2)', 'Factory date.');
  text(
    'Manufacture Code (生产批号)',
    0x3b40,
    8,
    'CPS String*8, loop 0-7',
    'Production batch; the CPS reads 8 characters.',
  );
  unused(0x3b48, 8, 'CPS reads 8 characters; no reader');
  text('Maintained Date', 0x3b50, 16, 'CPS Text1(3)', 'Repair date.');
  text('Dealer Code', 0x3b60, 16, 'CPS Text1(8)', 'In the CPS Dealer Information frame.');
  text('Stock Date', 0x3b70, 16, 'CPS Text1(9)');
  text('Sell Date', 0x3b80, 16, 'CPS Text1(10)');
  text('Seller (经手人)', 0x3b90, 16, 'CPS Text1(11)', 'Handler.');
  add('Maintained / Description (维修原因)', 0x3ba0, 96, 'traced', 'CPS Text1(4)', {
    textField: true,
    units: 'ASCII, multi-line',
    note: 'Repair description, not dealer information.',
  });
  unused(0x3c00, 192, 'F119 + address scan; no reader');

  const powers = ['Low', 'Mid', 'High'] as const;
  for (const [band, base, stride, length, referenceIndex, note] of [
    ['VHF', 0x3cc0, 0x40, 39, 19, 'index i = MHz - 136; reference index 19 (155 MHz)'],
    ['UHF', 0x3d80, 0x80, 91, 45, 'index i = MHz - 400; reference index 45 (445 MHz)'],
  ] as const) {
    for (let powerCode = 0; powerCode < 3; powerCode++)
      add(
        `${band} power flatness ${powers[powerCode]}`,
        base + powerCode * stride,
        length,
        'traced',
        'MAIN 0x08008E06',
        {
          referenceIndex,
          powerCode,
          units: 'u8, PWM counts',
          note: `Per-MHz offset, ${note}; correction = row base + entry - entry at the reference index.`,
        },
      );
  }
  for (const [address, width] of [
    [0x3ce7, 25],
    [0x3d27, 25],
    [0x3d67, 25],
    [0x3ddb, 37],
    [0x3e5b, 37],
    [0x3edb, 37],
  ] as const)
    unused(address, width, 'exact-length loads MAIN 0x08007400; no reader');

  for (const [address, label, source] of [
    [0x3f00, 'S-meter steps VHF', 'MAIN 0x08007EE8'],
    [0x3f10, 'S-meter steps UHF', 'MAIN 0x08007F0E'],
  ] as const)
    add(label, address, 9, 'traced', source, {
      units: 'u8, RSSI register units (about 1 dB, inferred)',
      note: 'Entries 1-8 are cumulative on the row S-meter base (F137), giving 9 thresholds; entry 0 unused. The dB scale is inferred.',
    });
  for (const [address, label] of [
    [0x3f20, 'Squelch level steps VHF'],
    [0x3f30, 'Squelch level steps UHF'],
  ] as const)
    add(label, address, 9, 'traced', 'MAIN 0x0800A9E8', {
      units: 'u8, dB (inferred)',
      note: 'Entries 1 to L-1 are subtracted for squelch level L; entry 0 unused. The dB scale is inferred.',
    });
  for (const address of [0x3f09, 0x3f19, 0x3f29, 0x3f39]) unused(address, 7);

  for (const [band, freq, offset, items] of [
    ['VHF', 0x3f40, 0x3f50, 'items 6-0x15'],
    ['UHF', 0x3f60, 0x3f70, 'items 0x16-0x25'],
  ] as const) {
    for (let i = 0; i < 3; i++)
      add(
        `${band} test channel RX frequency, slice ${i}`,
        freq + i * 4,
        4,
        'traced',
        'MAIN 0x08007BC4; F155',
        {
          units: 'BCD big-endian, 10 Hz',
          note: `Factory test-mode channel (${items} use slice 0). Not a calibration step.`,
          decode: bcdMhz,
        },
      );
    unused(freq + 12, 4);
    for (let i = 0; i < 3; i++)
      add(
        `${band} test channel offset, slice ${i}`,
        offset + i * 4,
        4,
        'traced',
        'MAIN 0x08007BC4; F155',
        {
          units: 'BCD big-endian, 10 Hz',
          note: 'Duplex minus offset of the factory test channel.',
          decode: bcdMhz,
        },
      );
    unused(offset + 12, 4);
  }

  const widths = ['12.5', '20', '25'];
  const letters = ['N', 'M', 'W'];
  for (const [band, base] of [
    ['VHF', 0x3f80],
    ['UHF', 0x3fa0],
  ] as const) {
    add(`FQC ${band}`, base, 1, 'traced', 'MAIN 0x0800D5EA', {
      units: '8-bit PWM, TIMER2 CH3',
      note: 'Reference-oscillator trim, applied on every RX and TX tune (oscillator and PC9 inferred).',
    });
    for (let i = 0; i < 3; i++)
      add(
        `PA power ${powers[i]} ${band} (PA${'LMH'[i]})`,
        base + 1 + i,
        1,
        'traced',
        'MAIN 0x08008E06, 0x0800D5F8',
        {
          powerCode: i,
          units: '8-bit PWM, TIMER2 CH2, 187.5 kHz',
          note: 'Base at the reference frequency; the PA pin (PC8) is inferred.',
        },
      );
    add(`Squelch base (SQ) ${band}`, base + 4, 1, 'traced', 'MAIN 0x0800A9E8, 0x0800841C', {
      units: 'about -dBm (inferred); head range 60-135',
      note: 'Open threshold at squelch level 1: register 0x49 open = 137 - (base + width/frequency adjustment - steps), shut = open - 3.',
    });
    unused(base + 5, 1, 'no reader, no test item');
    for (let i = 0; i < 3; i++)
      add(
        `TX deviation ${widths[i]} kHz ${band} (MOD${letters[i]})`,
        base + 6 + i * 2,
        2,
        'traced',
        'MAIN 0x0800905A, 0x080088C6',
        {
          order: 'little-endian',
          units: '10-bit, 0-1023 (AT1846S reg 0x59 bits 15:6)',
          note: 'Width code is channel byte 10 bits 3:2.',
        },
      );
    for (const [kind, short, start, note] of [
      ['CTCSS', 'CTC', 12, 'Per-tone plus or minus 1.'],
      ['DCS', 'DCS', 15, 'Used when the tone mode is DCS.'],
    ] as const)
      for (let i = 0; i < 3; i++)
        add(
          `${kind} deviation ${widths[i]} kHz ${band} (${short}${letters[i]})`,
          base + start + i,
          1,
          'traced',
          'MAIN 0x0800905A, 0x080088C6',
          { units: '6-bit, 0-63 (AT1846S reg 0x59 bits 5:0)', note },
        );
    add(`RSSI reference ${band}`, base + 18, 1, 'traced', 'builder 0x0800BBC2 cases 0xA0/0xA1', {
      units: 'raw RSSI (AT1846S reg 0x1B high byte)',
      note: 'Captured at the factory signal; the test-mode RSSI value key overwrites it with live RSSI.',
    });
    if (band === 'VHF') unused(base + 19, 13);
    else unused(base + 19, 1, 'zeroed in RAM, never sent: MAIN 0x08007400');
  }
  unused(0x3fb4, 12);

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
