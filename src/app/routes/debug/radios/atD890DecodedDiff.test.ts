import { describe, expect, it } from 'vitest';
import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupRegionV1,
} from '@integrations/radio-io/backup/index.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  receiveGroupAddress,
  talkgroupAddress,
  zoneChannelsAddress,
  zoneNameAddress,
} from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { openDebugArchive } from './captureArchive.ts';
import { diffAtD890Decoded, type AtD890DiffDomain } from './atD890DecodedDiff.ts';

type Entry = [RadioBackupRegionV1, Uint8Array];
const entry = (id: string, address: number, data: Uint8Array): Entry => [
  {
    id,
    label: id,
    address,
    byteLength: data.length,
    path: `regions/${id}.bin`,
    restoreRole: 'inspect-only',
  },
  data,
];
const sparse = (address: number, data: Uint8Array) =>
  entry(`sparse-${address.toString(16)}`, address, data);
const archive = (entries: readonly Entry[], capturedAt = '2026-01-01') =>
  openDebugArchive(
    packRadioBackupZip(
      {
        format: RADIO_BACKUP_FORMAT,
        version: RADIO_BACKUP_VERSION,
        capturedAt,
        capturedVia: 'file',
        app: { buildEnv: 'test', buildVersion: 'test' },
        radioModelId: 'AT-D890UV',
        descriptorLabel: 'synthetic',
        coverage: 'partial',
        imageByteLength: 0x5000000,
        regions: entries.map(([r]) => r),
      },
      Object.fromEntries(entries.map(([r, b]) => [r.id, b])),
    ),
    'AT-D890UV',
  );
const bitmap = (bytes: number, bits: number[]) => {
  const out = new Uint8Array(bytes);
  for (const b of bits) out[b >> 3]! |= 1 << (b & 7);
  return out;
};
const bcd = (digits: string) => Uint8Array.from(digits.match(/../g)!.map((p) => parseInt(p, 16)));
function wide(text: string, length: number) {
  const out = new Uint8Array(length);
  [...text].forEach((c, i) => {
    out[i * 2] = c.charCodeAt(0) & 0xff;
    out[i * 2 + 1] = c.charCodeAt(0) >> 8;
  });
  return out;
}
function channel(index: number, name: string, rx: string, halves: 'both' | 'primary' = 'both') {
  const rec = new Uint8Array(0x80);
  rec.set(bcd(rx), 0);
  rec[0x08] = 0x0c;
  rec.set(wide(name, 0x20), 0x44);
  return [
    sparse(channelPrimaryAddress(index), rec.slice(0, 0x40)),
    ...(halves === 'both' ? [sparse(channelSecondaryAddress(index), rec.slice(0x40))] : []),
  ];
}
const channelSet = (slots: number[]) => sparse(D890_MAP.ChannelSet, bitmap(0x200, slots));
const zoneSet = (bits: number[]) => sparse(D890_MAP.ZoneSet, bitmap(0x20, bits));
function members(indices: number[]) {
  const out = new Uint8Array(0x200).fill(0xff);
  indices.forEach((v, i) => {
    out[i * 2] = v & 0xff;
    out[i * 2 + 1] = v >> 8;
  });
  return out;
}
const zone = (index: number, name: string, list: number[]) => [
  sparse(zoneNameAddress(index), wide(name, 0x20)),
  sparse(zoneChannelsAddress(index), members(list)),
];
function tgSet(occupied: number[]) {
  const out = new Uint8Array(0x4f0).fill(0xff);
  for (const b of occupied) out[b >> 3]! &= ~(1 << (b & 7));
  return sparse(D890_MAP.TalkgroupSet, out);
}
function contact(index: number, name: string, id: string) {
  const r = new Uint8Array(0xc8);
  r[0] = 1;
  r.set(bcd(id), 2);
  r.set(wide(name, 0x20), 6);
  return sparse(talkgroupAddress(index), r);
}
const rxSet = (bits: number[]) => sparse(D890_MAP.ReceiveGroupSet, bitmap(0x20, bits));
function rxGroup(index: number, name: string, list: number[]) {
  const r = new Uint8Array(0x120).fill(0xff);
  list.forEach((m, i) => new DataView(r.buffer).setUint32(i * 4, m, true));
  r.set(wide(name, 0x20), 0x100);
  return sparse(receiveGroupAddress(index), r);
}
const SCAN_SET = 0x3482c60;
const scanSet = (bits: number[]) => sparse(SCAN_SET, bitmap(0x20, bits));
const scanAt = (i: number) => 0x2100000 + Math.floor(i / 32) * 0x80000 + (i % 32) * 0x200;
function scan(index: number, name: string, list: number[]) {
  const out = new Uint8Array(0x200).fill(0xff);
  out[0x01] = 0;
  out.fill(0, 0x0e, 0x2e);
  out.set(wide(name, 0x20), 0x0e);
  list.forEach((m, i) => {
    out[0x30 + i * 2] = m & 0xff;
    out[0x31 + i * 2] = m >> 8;
  });
  return sparse(scanAt(index), out);
}
const MAIN = 0x3500000;
const tune = (bytes: number[]) => entry('vital-tune-a', 0x04f00000, Uint8Array.from(bytes));

const rowsOf = (a: readonly Entry[], b: readonly Entry[]) =>
  diffAtD890Decoded(archive(a), archive(b))!;
const inDomain = (d: ReturnType<typeof rowsOf>, domain: AtD890DiffDomain) =>
  d.rows.filter((r) => r.domain === domain);

describe('D890 decoded differences', () => {
  it('refuses another model', () => {
    const a = archive([zoneSet([])]);
    expect(
      diffAtD890Decoded({ ...a, manifest: { ...a.manifest, radioModelId: 'RT95' } }, a),
    ).toBeUndefined();
  });

  it('reports a field change in each decoded domain', () => {
    const before = [
      channelSet([0]),
      ...channel(0, 'GB3ED', '14550000'),
      zoneSet([0]),
      ...zone(0, 'Local', [0]),
      tgSet([0]),
      contact(0, 'Parrot', '00000091'),
      rxSet([0]),
      rxGroup(0, 'Net', [0]),
      scanSet([0]),
      scan(0, 'Scan', [0]),
      sparse(MAIN + 0x26, Uint8Array.of(1)),
      tune([0xd0, 0x07, 1]),
    ];
    const after = [
      channelSet([0]),
      ...channel(0, 'GB3ED', '14560000'),
      zoneSet([0]),
      ...zone(0, 'Local2', [0]),
      tgSet([0]),
      contact(0, 'Parrot', '00000092'),
      rxSet([0]),
      rxGroup(0, 'Net', [0, 0]),
      scanSet([0]),
      scan(0, 'Scan', [0, 3]),
      sparse(MAIN + 0x26, Uint8Array.of(2)),
      tune([0xd1, 0x07, 1]),
    ];
    const d = rowsOf(before, after);
    const fields = (domain: AtD890DiffDomain) =>
      inDomain(d, domain)
        .filter((r) => r.kind === 'changed')
        .flatMap((r) => r.changes.map((c) => c.field));
    expect(fields('channel').length).toBeGreaterThan(0);
    expect(fields('zone')).toEqual(['name']);
    expect(fields('contact')).toContain('dmrId');
    expect(fields('rx-group')).toEqual(['members']);
    expect(fields('scan-list')).toEqual(['members']);
    expect(inDomain(d, 'setting').find((r) => r.key === 'backlightLevel')?.changes).toEqual([
      { field: 'value', before: expect.any(String), after: expect.any(String) },
      { field: 'raw', before: '01', after: '02' },
    ]);
    expect(inDomain(d, 'calibration').find((r) => r.key === 'trim')?.changes).toEqual([
      { field: 'value', before: '2000', after: '2001' },
    ]);
  });

  it('keeps ordered membership including duplicates', () => {
    const d = rowsOf(
      [zoneSet([0]), ...zone(0, 'Z', [1, 2, 1])],
      [zoneSet([0]), ...zone(0, 'Z', [2, 1, 1])],
    );
    expect(inDomain(d, 'zone')[0]!.changes).toEqual([
      { field: 'members', before: '1:1, 2:2, 3:1', after: '1:2, 2:1, 3:1' },
    ]);
  });

  it('reports additions and removals only with both occupancy bitmaps', () => {
    const both = rowsOf(
      [channelSet([0, 1]), ...channel(0, 'A', '14550000'), ...channel(1, 'B', '14560000')],
      [channelSet([1, 2]), ...channel(1, 'B', '14560000'), ...channel(2, 'C', '14570000')],
    );
    expect(inDomain(both, 'channel').map((r) => [r.key, r.kind])).toEqual([
      ['1', 'removed'],
      ['3', 'added'],
    ]);
    const missing = rowsOf(
      [channelSet([0]), ...channel(0, 'A', '14550000')],
      [...channel(0, 'A', '14550000'), ...channel(5, 'F', '14580000')],
    );
    expect(inDomain(missing, 'channel').map((r) => [r.key, r.kind])).toEqual([
      ['1', 'incomparable'],
    ]);
    expect(missing.domains.find((x) => x.domain === 'channel')?.occupancyComparable).toBe(false);
  });

  it('treats a half-captured record as unavailable, not as a change or zero', () => {
    const d = rowsOf(
      [channelSet([0]), ...channel(0, 'A', '14550000')],
      [channelSet([0]), ...channel(0, 'A', '14550000', 'primary')],
    );
    const row = inDomain(d, 'channel')[0]!;
    expect(row.kind).toBe('incomparable');
    expect(row.changes).toEqual([]);
    expect(row.unavailable).toContain('state');
  });

  it('does not call uncaptured settings or calibration a change', () => {
    const d = rowsOf(
      [sparse(MAIN + 0x26, Uint8Array.of(1))],
      [sparse(MAIN + 0x27, Uint8Array.of(1))],
    );
    expect(inDomain(d, 'setting').every((r) => r.kind === 'incomparable')).toBe(true);
    expect(d.domains.find((x) => x.domain === 'calibration')?.note).toMatch(/tune A/);
  });

  it('keeps unsupported setting values raw', () => {
    const d = rowsOf(
      [sparse(MAIN + 0x05, Uint8Array.of(7))],
      [sparse(MAIN + 0x05, Uint8Array.of(8))],
    );
    const row = inDomain(d, 'setting').find((r) => r.key === 'language')!;
    expect(row.changes).toContainEqual({ field: 'raw', before: '07', after: '08' });
  });
});
