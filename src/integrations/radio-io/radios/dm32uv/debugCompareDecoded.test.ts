import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import { diffDecoded } from '../../debugCompare/index.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA_OFFSET } from './constants.ts';
import {
  compareDm32Evidence,
  dm32CompareAdapter,
  type Dm32CompareArchive,
} from './debugCompare.ts';
import { DM32_DEBUG_CAPTURE_PATH } from './debugCoverage.ts';
import { dm32DecodedSnapshot } from './debugCompareDecoded.ts';

const BASE = 0x1000;

/** Little-endian BCD of an 8-digit number. */
const bcd = (digits: string) =>
  digits
    .match(/../g)!
    .map((p) => parseInt(p, 16))
    .reverse();

function channelRecord(name: string, rx = '14500000'): Uint8Array {
  const r = new Uint8Array(48);
  r.set(new TextEncoder().encode(name), 0);
  r.set(bcd(rx), 0x10);
  r.set(bcd(rx), 0x14);
  r[0x19] = 0x80;
  return r;
}

function build(opts: { name?: string; rx?: string; password?: string; model?: string }) {
  const ch = new Uint8Array(DM32_BLOCK_SIZE).fill(0xff);
  ch[DM32_METADATA_OFFSET] = 0x12;
  ch[0] = 1;
  ch[1] = 0;
  ch.set(channelRecord(opts.name ?? 'SIMPLEX', opts.rx), 0x10);
  const settings = new Uint8Array(DM32_BLOCK_SIZE);
  settings[DM32_METADATA_OFFSET] = 0x04;
  settings.set(new TextEncoder().encode(opts.password ?? '1234'), 0x431);
  const pages: [number, Uint8Array][] = [
    [BASE, ch],
    [BASE + 0x1000, settings],
  ];
  const regions = pages.map(([address, data], i) => ({
    id: `sparse-${i}`,
    label: 'Sparse',
    address,
    byteLength: data.length,
    path: `regions/sparse-${i}.bin`,
    restoreRole: 'inspect-only' as const,
  }));
  const manifest = {
    format: 'radio-backup',
    version: 1,
    capturedAt: '2026-01-01T00:00:00.000Z',
    radioModelId: opts.model ?? 'DM-32UV',
    coverage: 'partial',
    addressBase: BASE,
    imageByteLength: 8 * 0x1000,
    regions,
  } as unknown as RadioBackupManifestV1;
  const archive: Dm32CompareArchive = {
    manifest,
    regions: Object.fromEntries(pages.map(([, d], i) => [`sparse-${i}`, d])),
    sidecars: {
      [DM32_DEBUG_CAPTURE_PATH]: new TextEncoder().encode(
        JSON.stringify({
          modelString: 'DP570UV',
          v0a: { start: BASE, end: BASE + 8 * 0x1000 - 1 },
          window: { start: BASE, end: BASE + 7 * 0x1000 },
          discovered: pages.map(([address, d]) => ({ address, tag: d[0xfff] })),
          channelCount: 1,
          extraReadTags: [],
          factory: { status: 'not-kept', reason: 'mismatch' },
        }),
      ),
    },
  };
  return archive;
}

const diff = (a: Dm32CompareArchive, b: Dm32CompareArchive, revealSensitive = false) =>
  diffDecoded(dm32DecodedSnapshot(a), dm32DecodedSnapshot(b), { revealSensitive });

describe('DM-32 decoded snapshot', () => {
  it('is hooked on the compare adapter and empty for another radio', () => {
    expect(dm32CompareAdapter.decoded).toBe(dm32DecodedSnapshot);
    expect(dm32DecodedSnapshot(build({ model: 'RT95' }))).toEqual([]);
  });

  it('matches compareDm32Evidence field for field', () => {
    const a = build({});
    const b = build({});
    const rows = compareDm32Evidence(a, b);
    const result = diff(a, b);
    const fields = result.records.filter((r) => r.domainId === 'evidence').flatMap((r) => r.fields);
    expect(fields.map((f) => f.id).sort()).toEqual(rows.map((r) => r.field).sort());
    for (const row of rows) {
      const f = fields.find((x) => x.id === row.field)!;
      expect(f.kind === 'incomparable', row.field).toBe(row.status === 'Unavailable');
      expect(f.kind === 'changed', row.field).toBe(row.status === 'Changed');
    }
  });

  it('reads one channel change as one record with the changed field', () => {
    const result = diff(build({}), build({ rx: '14600000' }));
    const changed = result.records.filter((r) => r.kind === 'changed' && r.domainId === 'channels');
    expect(changed).toHaveLength(1);
    expect(changed[0]!.key).toBe('slot-1');
    const fields = changed[0]!.fields.filter((f) => f.kind === 'changed');
    expect(fields.map((f) => f.id)).toEqual(['rx', 'tx']);
    expect(fields[0]).toMatchObject({ a: '145.00000 MHz', b: '146.00000 MHz' });
  });

  it('reads a password change as changed while masked, and shows values on reveal', () => {
    const a = build({ password: '1234' });
    const b = build({ password: '9876' });
    const masked = diff(a, b).records.find((r) => r.domainId === 'settings')!;
    const field = masked.fields.find((f) => f.id === 'power-on-password')!;
    expect(masked.kind).toBe('changed');
    expect(field).toMatchObject({ kind: 'changed', sensitive: true });
    expect(JSON.stringify(masked)).not.toMatch(/1234|9876/);
    expect(field.address).toEqual(expect.any(Number));
    const shown = diff(a, b, true).records.find((r) => r.domainId === 'settings')!;
    expect(shown.fields.find((f) => f.id === 'power-on-password')).toMatchObject({
      a: '1234',
      b: '9876',
    });
  });
});
