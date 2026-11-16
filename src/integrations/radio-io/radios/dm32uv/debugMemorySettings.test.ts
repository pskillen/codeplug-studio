import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import { DM32_DEBUG_CAPTURE_PATH } from './debugCoverage.ts';
import { buildDm32SparseCapture, type Dm32SparseCapture } from './debugMemory.ts';
import {
  DM32_SETTINGS_DOCUMENTED_RANGES,
  DM32_SETTINGS_FIELDS,
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
    p[0x00] = 0x07;
    p.set(TE.encode('HELLO'), 0x01); // NUL after
    p.set(TE.encode('ABCDEFGHIJKLMN'), 0x0f); // fills 14, no NUL
    p[0x1d] = 0x03;
    p[0x1e] = 4;
    p[0x40] = 0x81;
    p.set([0x11, 0x22, 0x33, 0x44, 0x55], 0x41);
    p[0x85] = 1;
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
    p[0x330] = 3;
    p[0x331] = 0x03;
    p.set([0x01, 0x02, 0x03], 0x332);
  });
  const v = (id: string) => get(inv.fields, id).value;

  it('decodes each documented field', () => {
    expect(v('power-on-interface')).toBe('7');
    expect(v('power-on-line-1')).toBe('HELLO');
    expect(v('power-on-line-2')).toBe('ABCDEFGHIJKLMN');
    expect(v('allow-reset')).toBe('On');
    expect(v('gps-enable')).toBe('On');
    expect(get(inv.fields, 'gps-other').raw).toEqual([0x11, 0x22, 0x33, 0x44, 0x55]);
    expect(v('gps-other')).toBeUndefined();
    expect(v('key-lock')).toBe('On');
    expect(v('auto-lock-delay')).toBe('9');
    expect(v('side-key-1-short')).toBe('Power Select (1)');
    expect(v('side-key-1-long')).toBe('Volt (2)');
    expect(v('side-key-2-short')).toBe('Talk Around (3)');
    expect(v('side-key-2-long')).toBe('Digital Encrypt (4)');
    expect(get(inv.fields, 'key-function-8b-8c').raw).toEqual([0x5a, 0x5b]);
    expect(v('key-function-8b-8c')).toBeUndefined();
    expect(v('prog-key-1-short')).toBe('Previous Record (20)');
    expect(v('prog-key-1-long')).toBe('Next Record (21)');
    expect(v('prog-key-2-short')).toBe('Man Down Alarm (42)');
    expect(v('prog-key-2-long')).toBe('Function 43 (43)');
    expect(v('long-press')).toBe('6');
    expect(v('aprs-scheduled-send')).toBe('12');
    expect(v('aprs-fixed-beacon')).toBe('Off');
    expect(v('aprs-latitude')).toBe('5530.123');
    expect(v('aprs-latitude-ns')).toBe('S');
    expect(v('aprs-longitude')).toBe('00412.99');
    expect(v('aprs-longitude-ew')).toBe('W');
    expect(v('aprs-report-channel-1')).toBe('0 (current channel)');
    expect(v('aprs-report-channel-2')).toBe('17');
    expect(v('aprs-report-channel-8')).toBe('279');
    expect(v('aprs-repeater-delay')).toBe('3');
    expect(v('aprs-call-type')).toBe('Bit 0 = 1 (meaning not established)');
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
});

describe('enums, ASCII and edges', () => {
  const apo = (b: number) => get(captured((p) => (p[0x1e] = b)).fields, 'auto-power-off');
  it('maps 0-5 and leaves other values raw', () => {
    expect(apo(0).value).toBe('Off');
    expect(apo(1).value).toBe('30 minutes');
    expect(apo(5).value).toBe('4 hours');
    expect(apo(6)).toMatchObject({ value: undefined, raw: [6] });
    expect(apo(0xff)).toMatchObject({ value: undefined, raw: [0xff] });
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
});

describe('documented ranges and unknown bytes', () => {
  it('shows documented-not-decoded ranges raw', () => {
    const inv = captured((p) => (p[0x30] = 0x05));
    const r = inv.documented.find((d) => d.id === 'display-0x30')!;
    expect(r).toMatchObject({ status: 'captured', address: A(0) + 0x30, length: 12 });
    expect(r.raw![0]).toBe(5);
    expect(inv.documented).toHaveLength(DM32_SETTINGS_DOCUMENTED_RANGES.length);
  });

  it('counts captured bytes covered by nothing as unknown, with address and raw hex', () => {
    const inv = captured((p) => {
      p.fill(0xee, 0x94, 0x97);
      p[0x507] = 0x77; // inside menu flags: documented, not unknown
      p[0x508] = 0x99; // beyond layout: never counted
    });
    const run = inv.unknown.find((u) => u.offset === 0x94)!;
    expect(run).toMatchObject({ address: A(0) + 0x94 });
    expect(run.raw.slice(0, 3)).toEqual([0xee, 0xee, 0xee]);
    expect(inv.unknown.some((u) => u.offset >= 0x500)).toBe(false);
    const total = inv.unknown.reduce((n, u) => n + u.raw.length, 0);
    expect(inv.counts.unknownBytes).toBe(total);
    expect(total).toBeGreaterThan(3);
    expect(total).toBeLessThan(DM32_SETTINGS_LAYOUT_LENGTH);
  });

  it('partitions the layout into fields, documented ranges and unknown with no overlap', () => {
    const inv = captured(() => {});
    const seen = new Uint8Array(DM32_SETTINGS_LAYOUT_LENGTH);
    for (const f of inv.fields) seen.fill(1, f.offset, f.offset + f.length);
    for (const d of inv.documented) seen.fill(1, d.offset, d.offset + d.length);
    for (const u of inv.unknown)
      for (let i = 0; i < u.raw.length; i++) expect(seen[u.offset + i]).toBe(0);
    for (const u of inv.unknown) seen.fill(1, u.offset, u.offset + u.raw.length);
    expect(seen.every((x) => x === 1)).toBe(true);
  });
});
