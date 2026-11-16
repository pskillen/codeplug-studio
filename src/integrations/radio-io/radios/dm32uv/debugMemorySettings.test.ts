import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import { DM32_DEBUG_CAPTURE_PATH } from './debugCoverage.ts';
import { buildDm32SparseCapture, type Dm32SparseCapture } from './debugMemory.ts';
import {
  DM32_SETTINGS_DOCUMENTED_RANGES,
  DM32_SETTINGS_FIELDS,
  DM32_SETTINGS_UNUSED,
  DM32_SETTINGS_LAYOUT_LENGTH,
  projectDm32Settings,
  type Dm32SettingFieldView,
} from './debugMemorySettings.ts';
import { dm32KeyFunctionLabel } from './retainPreview.ts';

const BASE = 0x1000;
const A = (n: number) => BASE + n * 0x1000;
const TE = new TextEncoder();

function page(tag: number, fill = 0x00): Uint8Array {
  const data = new Uint8Array(4096).fill(fill);
  data[0xfff] = tag;
  return data;
}

function archive(pages: Record<number, Uint8Array>): Dm32CompareArchive {
  const regions: RadioBackupRegionV1[] = [];
  const bytes: Record<string, Uint8Array> = {};
  for (const [addr, data] of Object.entries(pages)) {
    const id = `sparse-${Number(addr).toString(16)}`;
    regions.push({
      id,
      label: 'Sparse',
      address: Number(addr),
      byteLength: data.length,
      path: `regions/${id}.bin`,
      restoreRole: 'inspect-only',
    });
    bytes[id] = data;
  }
  const manifest = {
    format: 'radio-backup',
    version: 1,
    capturedAt: '2026-01-01T00:00:00.000Z',
    radioModelId: 'DM-32UV',
    coverage: 'partial',
    addressBase: BASE,
    imageByteLength: 12 * 0x1000,
    regions,
  } as unknown as RadioBackupManifestV1;
  return {
    manifest,
    regions: bytes,
    sidecars: {
      [DM32_DEBUG_CAPTURE_PATH]: TE.encode(
        JSON.stringify({
          modelString: 'DP570UV',
          v0a: { start: BASE, end: BASE + 12 * 0x1000 - 1 },
          window: { start: BASE, end: BASE + 11 * 0x1000 },
          discovered: Object.entries(pages).map(([a, d]) => ({
            address: Number(a),
            tag: d[0xfff],
          })),
          channelCount: 0,
          extraReadTags: [],
          factory: { status: 'not-kept', reason: 'mismatch' },
        }),
      ),
    },
  };
}

const settingsPage = (edit: (p: Uint8Array) => void = () => {}) => {
  const p = page(0x04);
  edit(p);
  return p;
};
const project = (pages: Record<number, Uint8Array>) =>
  projectDm32Settings(buildDm32SparseCapture(archive(pages)));

function captured(edit: (p: Uint8Array) => void) {
  const inv = project({ [A(0)]: settingsPage(edit) });
  if (inv.status !== 'captured') throw new Error('expected captured');
  return inv;
}
const get = (fields: Dm32SettingFieldView[], id: string) => fields.find((x) => x.id === id)!;

describe('projectDm32Settings states', () => {
  it('is not captured with no 0x04 page', () => {
    expect(project({ [A(0)]: page(0x12) }).status).toBe('not-captured');
  });

  it('lists several pages tagged 0x04 and decodes none', () => {
    const inv = project({ [A(0)]: settingsPage(), [A(3)]: settingsPage() });
    expect(inv).toMatchObject({ status: 'ambiguous', addresses: [A(0), A(3)] });
    expect((inv as { reason: string }).reason).toBe('Several pages tagged 0x04, not decoded.');
  });

  it('does not read the 0x10 emergency and key page', () => {
    const keys = page(0x10, 0xaa);
    expect(project({ [A(1)]: keys }).status).toBe('not-captured');
    const inv = project({ [A(0)]: settingsPage(), [A(1)]: keys });
    expect(JSON.stringify(inv)).not.toContain('170,170,170,170');
  });

  it('leaves a field not captured when its span is not covered', () => {
    const real = buildDm32SparseCapture(archive({ [A(0)]: settingsPage((p) => (p[0x1e] = 2)) }));
    const target = A(0) + 0x1e;
    const truncated: Dm32SparseCapture = {
      ...real,
      covers: (address, length) =>
        !(address <= target && address + length > target) && real.covers(address, length),
    };
    const inv = projectDm32Settings(truncated);
    if (inv.status !== 'captured') throw new Error('expected captured');
    expect(get(inv.fields, 'auto-power-off')).toMatchObject({ status: 'not-captured' });
    expect(get(inv.fields, 'auto-power-off').raw).toBeUndefined();
    expect(get(inv.fields, 'key-lock').status).toBe('captured');
    // the uncaptured byte is neither decoded nor counted as unknown
    expect(inv.unknown.some((u) => u.offset <= 0x1e && u.offset + u.raw.length > 0x1e)).toBe(false);
  });
});

describe('registry fields at distinct bytes', () => {
  const inv = captured((p) => {
    p[0x00] = 0x01;
    p.set(TE.encode('HELLO'), 0x01); // NUL after
    p.set(TE.encode('ABCDEFGHIJKLMN'), 0x0f); // fills 14, no NUL
    p[0x1d] = 0x03;
    p[0x1e] = 4;
    p[0x20] = 0xc1; // radio silent, key tone, start-up sound
    p[0x21] = 0xa0; // voice prompt, roger bits 5-4 = 2
    p[0x30] = 2;
    p[0x31] = 7;
    p[0x33] = 0x09; // time display + dd/mm/yyyy
    p[0x34] = 3;
    p[0x40] = 0x81; // GNSS on; bit 7 is not a field
    p[0x41] = 13;
    p[0x85] = 0x05; // bit 0 (switch) and bit 2 (guessed side-key lock)
    p[0x86] = 9;
    p.set([1, 2, 3, 4], 0x87);
    p.set([0x5a, 0x5b], 0x8b);
    p.set([20, 21, 42, 43], 0x8d);
    p[0x93] = 6;
    p[0x301] = 12;
    p[0x302] = 0xfe; // bit 0 clear
    p.set(TE.encode('5530.123'), 0x306);
    p[0x30f] = 0x53; // S
    p.set(TE.encode('00412.99'), 0x310);
    p[0x319] = 0x57; // W
    for (let i = 0; i < 8; i++) {
      p[0x320 + i * 2] = i === 0 ? 0 : i + 0x10;
      p[0x321 + i * 2] = i === 7 ? 0x01 : 0;
    }
    p[0x331] = 0x03;
    p.set([0x01, 0x02, 0x03], 0x332);
  });
  const v = (id: string) => get(inv.fields, id).value;

  it('decodes each documented field', () => {
    expect(v('power-on-interface')).toBe('Char String (the two lines below)');
    expect(v('power-on-line-1')).toBe('HELLO');
    expect(v('power-on-line-2')).toBe('ABCDEFGHIJKLMN');
    expect(v('allow-reset')).toBe('On');
    expect(v('radio-silent')).toBe('On');
    expect(v('key-tone')).toBe('On');
    expect(v('startup-sound')).toBe('On');
    expect(v('sms-prompt')).toBe('Off');
    expect(v('voice-prompt')).toBe('On');
    expect(v('ana-roger')).toBe('1200');
    expect(v('back-light')).toBe('Brightness 3');
    expect(v('light-time')).toBe('1 min');
    expect(v('time-display')).toBe('On');
    expect(v('date-format')).toBe('dd/mm/yyyy');
    expect(v('call-colour')).toBe('Red');
    expect(v('gps-enable')).toBe('On');
    expect(v('time-zone')).toBe('UTC+01:00');
    expect(v('key-lock')).toBe('On');
    expect(v('lock-flag-knob')).toBe('Off');
    expect(v('lock-flag-side-key')).toBe('On');
    expect(v('auto-lock-delay')).toMatch(/^14 /);
    expect(v('side-key-1-short')).toBe('Power Select (1)');
    expect(v('side-key-1-long')).toBe('Volt (2)');
    expect(v('side-key-2-short')).toBe('Talk Around (3)');
    expect(v('side-key-2-long')).toBe('Digital Encrypt (4)');
    expect(v('tk-key-short')).toBe(`${dm32KeyFunctionLabel(0x5a)} (90)`);
    expect(v('tk-key-long')).toBe(`${dm32KeyFunctionLabel(0x5b)} (91)`);
    expect(v('prog-key-1-short')).toBe('Previous Record (20)');
    expect(v('prog-key-1-long')).toBe('Next Record (21)');
    expect(v('prog-key-2-short')).toBe('Man Down Alarm (42)');
    expect(v('prog-key-2-long')).toBe('Function 43 (43)');
    expect(v('long-press')).toMatch(/^6 /);
    expect(v('aprs-scheduled-send')).toMatch(/^12 /);
    expect(v('aprs-fixed-beacon')).toBe('GPS Beacon');
    expect(v('aprs-latitude')).toBe('5530.123');
    expect(v('aprs-latitude-ns')).toBe('S');
    expect(v('aprs-longitude')).toBe('00412.99');
    expect(v('aprs-longitude-ew')).toBe('W');
    expect(v('aprs-report-channel-1')).toBe('0 (current channel)');
    expect(v('aprs-report-channel-2')).toBe('17');
    expect(v('aprs-report-channel-8')).toBe('279');
    expect(v('aprs-call-type')).toBe('Group call (polarity inferred)');
    expect(v('aprs-upload-id')).toBe(String(0x030201));
  });

  it('reports archive address, raw bytes and mask for every captured field', () => {
    const f = get(inv.fields, 'allow-reset');
    expect(f).toMatchObject({ offset: 0x1d, address: A(0) + 0x1d, mask: 0x01, raw: [0x03] });
    expect(inv.fields.every((x) => x.status === 'captured' && x.raw?.length === x.length)).toBe(
      true,
    );
    expect(inv.counts.registered).toBe(DM32_SETTINGS_FIELDS.length);
  });

  it('gives every field a confidence and an evidence source', () => {
    for (const f of inv.fields) {
      expect(['traced', 'partially-traced', 'unknown']).toContain(f.confidence);
      expect(f.source.length).toBeGreaterThan('settings.md: '.length);
    }
    const { traced, partiallyTraced, unknownConfidence, registered } = inv.counts;
    expect(traced + partiallyTraced + unknownConfidence).toBe(registered);
    expect(get(inv.fields, 'auto-power-off').confidence).toBe('traced');
    expect(get(inv.fields, 'dmr-retries').confidence).toBe('partially-traced');
    expect(get(inv.fields, 'dmr-timing-a').confidence).toBe('unknown');
    expect(get(inv.fields, 'lock-flag-forbid-lock-key').confidence).toBe('unknown');
  });

  it('labels guessed names as guessed and every inferred name as inferred', () => {
    for (const f of inv.fields.filter((x) => x.confidence === 'unknown'))
      expect(`${f.label} ${f.help ?? ''}`, f.id).toMatch(/guessed/i);
    for (const f of inv.fields.filter((x) => x.confidence === 'partially-traced'))
      expect(`${f.label} ${f.help ?? ''}`, f.id).toMatch(/inferred/i);
  });
});

describe('bit fields share a byte without disturbing each other', () => {
  it('decodes key lock from bit 0 only', () => {
    const lock = (b: number) => get(captured((p) => (p[0x85] = b)).fields, 'key-lock').value;
    expect(lock(0x00)).toBe('Off');
    expect(lock(0x01)).toBe('On');
    expect(lock(0x0e)).toBe('Off'); // other lock flags set, switch clear
    expect(lock(0xff)).toBe('On');
  });

  it('decodes multi-bit enums from their own bits', () => {
    const f = (id: string, off: number, b: number) =>
      get(captured((p) => (p[off] = b)).fields, id).value;
    expect(f('gnss-mode', 0x40, 0x04)).toBe('BDS');
    expect(f('gnss-mode', 0x40, 0x0c)).toBeUndefined();
    expect(f('gnss-display-format', 0x40, 0x40)).toBe('DMS');
    expect(f('dual-watch', 0x80, 0x40)).toBe('Double Wait');
    expect(f('dual-watch', 0x80, 0x00)).toBe('Single Mode');
    expect(f('main-channel', 0x80, 0x20)).toBe('B');
    expect(f('power-save', 0xa4, 0x20)).toBe('1:2');
    expect(f('tail', 0xa5, 0x03)).toBe('55 Hz');
    expect(f('tbst', 0xa5, 0x20)).toBe('1750 Hz');
    expect(f('sms-format', 0x65, 0x04)).toBe('D-SMS');
    expect(f('language', 0xa4, 0x02)).toBe('English');
    expect(f('language', 0xa4, 0x00)).toBe('Chinese');
  });
});

describe('enums, ASCII and edges', () => {
  const apo = (b: number) => get(captured((p) => (p[0x1e] = b)).fields, 'auto-power-off').value;
  it('maps Auto Power Off 4 to 240 minutes and 5 and above to 480', () => {
    expect(apo(0)).toBe('Off');
    expect(apo(1)).toBe('30 minutes');
    expect(apo(2)).toBe('60 minutes');
    expect(apo(3)).toBe('120 minutes');
    expect(apo(4)).toBe('240 minutes');
    expect(apo(5)).toBe('480 minutes');
    expect(apo(6)).toBe('480 minutes (value 6 reads as 5)');
    expect(apo(0xff)).toBe('480 minutes (value 255 reads as 5)');
  });

  it('stops ASCII at the first NUL even with text after it, and keeps spaces', () => {
    const line = (bytes: number[]) =>
      get(captured((p) => p.set(bytes, 0x01)).fields, 'power-on-line-1').value;
    expect(line([0x41, 0x00, 0x42, 0x43])).toBe('A');
    expect(line([0x00, 0x42])).toBe('');
    expect(line([0x41, 0x20])).toBe('A ');
  });

  it('keeps N/S and E/W raw when the byte is not a hemisphere letter', () => {
    const inv = captured((p) => {
      p[0x30f] = 0x01;
      p[0x319] = 0x45;
    });
    expect(get(inv.fields, 'aprs-latitude-ns')).toMatchObject({ value: undefined, raw: [1] });
    expect(get(inv.fields, 'aprs-longitude-ew').value).toBe('E');
  });

  it('renders key code 43 and 0xFF as Function N', () => {
    expect(dm32KeyFunctionLabel(43)).toBe('Function 43');
    expect(dm32KeyFunctionLabel(0xff)).toBe('Function 255');
    expect(get(captured((p) => (p[0x87] = 0xff)).fields, 'side-key-1-short').value).toBe(
      'Function 255 (255)',
    );
  });

  it('reads the upload ID little-endian', () => {
    const inv = captured((p) => p.set([0x78, 0x56, 0x34], 0x332));
    expect(get(inv.fields, 'aprs-upload-id').value).toBe(String(0x345678));
  });

  it('decodes the time zone, weather channels and mic tables', () => {
    const f = (id: string, off: number, b: number) =>
      get(captured((p) => (p[off] = b)).fields, id).value;
    expect(f('time-zone', 0x41, 12)).toBe('UTC');
    expect(f('time-zone', 0x41, 0)).toBe('UTC-12:00');
    expect(f('time-zone', 0x41, 25)).toBe('UTC+13:00');
    expect(f('time-zone', 0x41, 26)).toBeUndefined();
    expect(f('weather-channel-a', 0xa8, 1)).toBe('162.550 MHz');
    expect(f('weather-channel-b', 0xa9, 10)).toBe('163.275 MHz');
    expect(f('weather-channel-a', 0xa8, 0)).toBe('162.550 MHz (value 0 reads as 1)');
    expect(f('digi-mic-gain', 0xa7, 5)).toBe('5 (codec value 18)');
    expect(f('ana-mic-gain', 0xa6, 4)).toBe('Level 5');
    expect(f('vox-gain', 0xa2, 8)).toBe('8 (threshold 174)');
  });

  it('shows MM9PDY light mode and RX match as MM9PDY fields', () => {
    const inv = captured((p) => {
      p[0xb0] = 0x01;
      p[0xb1] = 0x01;
    });
    expect(get(inv.fields, 'mm9pdy-light-mode')).toMatchObject({
      value: 'Light',
      confidence: 'traced',
    });
    expect(get(inv.fields, 'mm9pdy-light-mode').label).toMatch(/^MM9PDY/);
    expect(get(inv.fields, 'mm9pdy-rx-match').value).toBe('Talk group');
  });

  it('shows the Fun+ range as 12 entries and the alias text as written-only', () => {
    const inv = captured((p) => {
      p[0x283] = 0x42;
      p.set(TE.encode('ALIAS'), 0x50);
    });
    const fun = inv.documented.find((d) => d.id === 'fun-plus')!;
    expect(fun).toMatchObject({ offset: 0x230, length: 84, status: 'captured' });
    expect(fun.raw![83]).toBe(0x42);
    expect(get(inv.fields, 'talker-alias-text').value).toBe('ALIAS');
  });
});

describe('passwords', () => {
  const inv = captured((p) => {
    p[0x430] = 0xa5;
    p.set(TE.encode('12345678'), 0x431);
    p.set([0x01, 0x01], 0x439);
    p.set(TE.encode('87654321'), 0x43b);
    p.set([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08], 0x443);
  });

  it('marks exactly the three password strings sensitive', () => {
    const sensitive = inv.fields.filter((f) => f.sensitive).map((f) => f.id);
    expect(sensitive).toEqual(['power-on-password', 'write-password', 'read-password']);
    expect(get(inv.fields, 'power-on-password')).toMatchObject({
      offset: 0x431,
      length: 8,
      value: '12345678',
    });
    expect(get(inv.fields, 'write-password')).toMatchObject({ offset: 0x43b, value: '87654321' });
    expect(get(inv.fields, 'read-password')).toMatchObject({
      offset: 0x443,
      value: '01 02 03 04 05 06 07 08',
    });
    expect(get(inv.fields, 'power-on-password-enable').value).toBe('On (0xA5)');
  });

  it('keeps the password bytes out of the unknown runs and unused ranges', () => {
    for (const u of inv.unknown)
      expect(u.offset + u.raw.length <= 0x430 || u.offset > 0x44a).toBe(true);
    for (const u of inv.unused) expect(u.offset + u.length <= 0x430 || u.offset > 0x44a).toBe(true);
  });
});

describe('documented ranges, unused bytes and unknown bytes', () => {
  it('shows documented-not-decoded ranges raw', () => {
    const inv = captured((p) => (p[0x200] = 0x05));
    const r = inv.documented.find((d) => d.id === 'one-touch-call')!;
    expect(r).toMatchObject({ status: 'captured', address: A(0) + 0x200, length: 25 });
    expect(r.raw![0]).toBe(5);
    expect(inv.documented).toHaveLength(DM32_SETTINGS_DOCUMENTED_RANGES.length);
  });

  it('classifies the previously unknown bytes as free, unused (no reader) or MM9PDY reserved', () => {
    const inv = captured(() => {});
    expect(inv.unused).toHaveLength(DM32_SETTINGS_UNUSED.length);
    const bytes = (kind: string) =>
      inv.unused.filter((u) => u.kind === kind).reduce((n, u) => n + u.length, 0);
    expect(bytes('free')).toBe(744); // ledger F222
    expect(bytes('unread')).toBe(13 + 3 + 3 + 23 + 125 + 3 + 6 + 1);
    expect(bytes('mm9pdy-reserved')).toBe(14);
    expect(inv.counts.unusedBytes).toBe(bytes('free') + bytes('unread') + bytes('mm9pdy-reserved'));
    expect(inv.unused.find((u) => u.offset === 0x160)).toMatchObject({ kind: 'free', length: 160 });
    expect(inv.unused.find((u) => u.offset === 0xb2)).toMatchObject({ kind: 'mm9pdy-reserved' });
  });

  it('leaves no byte of the layout unknown once every span is captured', () => {
    const inv = captured((p) => p.fill(0xee, 0x7f, 0x80));
    expect(inv.unknown).toEqual([]);
    expect(inv.counts.unknownBytes).toBe(0);
  });

  it('partitions the layout into fields, ranges and unused bytes with no overlap', () => {
    const inv = captured(() => {});
    const fieldBits = new Map<number, number>();
    for (const f of inv.fields)
      for (let i = f.offset; i < f.offset + f.length; i++) {
        const taken = fieldBits.get(i) ?? 0;
        const bits = f.mask ?? 0xff;
        expect(taken & bits, `${f.id} overlaps another field at 0x${i.toString(16)}`).toBe(0);
        fieldBits.set(i, taken | bits);
      }
    const seen = new Uint8Array(DM32_SETTINGS_LAYOUT_LENGTH);
    for (const d of [...inv.documented, ...inv.unused])
      for (let i = d.offset; i < d.offset + d.length; i++) {
        expect(fieldBits.has(i), `byte 0x${i.toString(16)} in a field and a range`).toBe(false);
        expect(seen[i], `byte 0x${i.toString(16)} in two ranges`).toBe(0);
        seen[i] = 1;
      }
    for (let i = 0; i < DM32_SETTINGS_LAYOUT_LENGTH; i++)
      expect(fieldBits.has(i) || seen[i] === 1, `byte 0x${i.toString(16)} unclaimed`).toBe(true);
  });
});
