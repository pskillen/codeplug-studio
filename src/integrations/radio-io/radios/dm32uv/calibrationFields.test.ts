import { describe, expect, it } from 'vitest';
import type { RadioBackupManifestV1, RadioBackupRegionV1 } from '../../backup/types.ts';
import { decodeDm32CalibrationPage, decodeDm32FactorySector } from './calibrationDecode.ts';
import {
  describeDm32CalibrationPage,
  describeDm32FactorySector,
  readDm32SidecarClaims,
  selectDm32LiveCalibration,
} from './calibrationFields.ts';
import { dm32ComparisonEvidence, type Dm32CompareArchive } from './debugCompare.ts';

const bcd = (digits: string) =>
  digits
    .match(/../g)!
    .map((pair) => parseInt(pair, 16))
    .reverse();

/** Synthetic page: distinct, valid bytes in every traced field; the rest follows a ramp. */
function goldenPage(seed = 0): Uint8Array {
  const page = Uint8Array.from({ length: 4096 }, (_, i) => (i * 7 + 3 + seed) & 0xff);
  page.set([...bcd('4000'), ...bcd('4700')], 0x000);
  page.set([...bcd('1360'), ...bcd('1740')], 0x0cc);
  [0x300, 0x314, 0x328, 0x33c].forEach((offset, band) =>
    ['40000000', '41750000', '43500000', '45250000', '47000000'].forEach((f, i) =>
      page.set(bcd(band < 2 ? f : f.replace(/^4/, '1')), offset + i * 4),
    ),
  );
  page.set([0x58, 0x02, 0x7c, 0x02], 0x00c);
  page[0xfff] = 0x02;
  return page;
}

function archive(
  regions: { id: string; address: number; bytes: Uint8Array }[],
  window: { start: number; size: number } = { start: 0x1000, size: 0x2000 },
  sidecars: Record<string, Uint8Array> = {},
): Dm32CompareArchive {
  const manifest: RadioBackupManifestV1 = {
    format: 'codeplug-studio-radio-backup',
    version: 1,
    capturedAt: '2026-01-01T00:00:00Z',
    capturedVia: 'file',
    app: { buildEnv: 'test', buildVersion: 'test' },
    radioModelId: 'DM-32UV',
    descriptorLabel: 'test',
    coverage: 'partial',
    addressBase: window.start,
    imageByteLength: window.size,
    regions: regions.map((r): RadioBackupRegionV1 => ({
      id: r.id,
      label: r.id,
      address: r.address,
      byteLength: r.bytes.length,
      path: `regions/${r.id}.bin`,
      restoreRole: 'inspect-only',
    })),
  };
  return {
    manifest,
    regions: Object.fromEntries(regions.map((r) => [r.id, r.bytes])),
    sidecars,
  };
}

describe('describeDm32CalibrationPage', () => {
  const page = goldenPage();
  const rows = describeDm32CalibrationPage(page, 0x2000);
  const byId = (id: string) => rows.find((r) => r.id === id)!;

  it('keeps raw bytes exactly as stored at each offset and width', () => {
    for (const row of rows) {
      expect([...row.raw]).toEqual([...page.subarray(row.offset, row.offset + row.length)]);
    }
  });

  it('decodes the traced fields', () => {
    expect(byId('uhf-band').decoded).toBe('400 – 470 MHz');
    expect(byId('vhf-band').decoded).toBe('136 – 174 MHz');
    expect(byId('points-uhf-rx').decoded).toBe(
      '400.00000, 417.50000, 435.00000, 452.50000, 470.00000 MHz',
    );
    expect(byId('scalar-00c').decoded).toBe('600');
    expect(byId('scalar-00e').decoded).toBe('636');
    expect(byId('scalar-00c').reason).toBeUndefined();
    expect(byId('boot-027').decoded).toBe(String(page[0x027]! | (page[0x028]! << 8)));
    expect(byId('adc-channel-1').decoded).toBe(String(page[0x07a]! | (page[0x07b]! << 8)));
    expect(byId('adc-channel-1-b').decoded).toBe(String(page[0x07c]! | (page[0x07d]! << 8)));
  });

  it('equals decodeDm32CalibrationPage so the two cannot drift', () => {
    const d = decodeDm32CalibrationPage(page, 0x2000);
    expect(byId('uhf-band').value).toEqual(d.uhfBand);
    expect(byId('vhf-band').value).toEqual(d.vhfBand);
    expect(byId('points-uhf-rx').value).toEqual(d.frequencyPointsHz.uhfRx);
    expect(byId('points-uhf-tx').value).toEqual(d.frequencyPointsHz.uhfTx);
    expect(byId('points-vhf-rx').value).toEqual(d.frequencyPointsHz.vhfRx);
    expect(byId('points-vhf-tx').value).toEqual(d.frequencyPointsHz.vhfTx);
    for (const level of ['low', 'mid', 'high'] as const) {
      expect(byId(`power-uhf-${level}`).value).toEqual(d.uhfPower[level]);
      expect(byId(`power-vhf-${level}`).value).toEqual(d.vhfPower[level]);
    }
    expect(byId('level-uhf-0-level1').value).toEqual(d.levels.uhf[0]!.level1);
    expect(byId('level-uhf-0-level9').value).toEqual(d.levels.uhf[0]!.level9);
    expect(byId('level-uhf-1-level1').value).toEqual(d.levels.uhf[1]!.level1);
    expect(byId('level-uhf-1-level9').value).toEqual(d.levels.uhf[1]!.level9);
    expect(byId('level-vhf-0-level1').value).toEqual(d.levels.vhf[0]!.level1);
    expect(byId('level-vhf-1-level9').value).toEqual(d.levels.vhf[1]!.level9);
    expect(byId('level-air-level1').value).toEqual(d.levels.airband.level1);
    expect(byId('level-air-level9').value).toEqual(d.levels.airband.level9);
    expect(byId('scalar-00c').value).toEqual(d.battery.thresholdRaw);
    expect(byId('scalar-00e').value).toEqual({
      scale: d.battery.scale,
      scaleValid: d.battery.scaleValid,
    });
    expect(byId('boot-027').value).toEqual(d.words.at0x027);
    // Rows the decoder reports only as raw spans must match it byte for byte.
    for (const span of [...d.bootScalars, ...d.unknownRows]) {
      const row = rows.find((r) => r.offset === span.offset && r.length === span.length);
      expect(row, `row at +0x${span.offset.toString(16)}`).toBeDefined();
      expect([...row!.raw].map((b) => b.toString(16).padStart(2, '0')).join('')).toBe(span.hex);
    }
  });

  it('assigns confidence without upgrading beyond the firmware notes', () => {
    expect([byId('uhf-band').layoutConfidence, byId('uhf-band').meaningConfidence]).toEqual([
      'traced',
      'traced',
    ]);
    expect(byId('power-uhf-low').meaningConfidence).toBe('traced');
    expect(byId('level-air-level1').meaningConfidence).toBe('traced');
    expect(byId('boot-201').meaningConfidence).toBe('traced');
    expect(byId('boot-203').meaningConfidence).toBe('unknown');
    expect(byId('table5-vhf').meaningConfidence).toBe('traced');
    expect(byId('table3-uhf').meaningConfidence).toBe('traced');
    expect(byId('adc-channel-1').meaningConfidence).toBe('partially-traced');
    expect(byId('adjust-uhf').meaningConfidence).toBe('unknown');
    expect(byId('adjust-uhf').source).toMatch(/No reader in 048/);
    expect(byId('adjust-uhf').source).not.toMatch(/0x03029A3C \(PCTESTM/);
    expect(byId('audio-level-analog').offset).toBe(0x20a);
    expect(byId('audio-level-digital').offset).toBe(0x20b);
    expect(byId('adjust-uhf').decoded).toBeUndefined();
    expect(byId('unknown-0c0').layoutConfidence).toBe('unknown');
    expect(rows.every((r) => r.source.length > 0)).toBe(true);
  });

  it('shows invalid BCD as such with raw bytes, never as zero', () => {
    const bad = goldenPage();
    bad[0x001] = 0x4a;
    bad.set([0xaa, 0x00, 0x00, 0x40], 0x300);
    const badRows = describeDm32CalibrationPage(bad, 0x2000);
    const bandRow = badRows.find((r) => r.id === 'uhf-band')!;
    expect(bandRow.decoded).toContain('invalid BCD');
    expect(bandRow.reason).toMatch(/not BCD/);
    expect(bandRow.raw[1]).toBe(0x4a);
    const points = badRows.find((r) => r.id === 'points-uhf-rx')!;
    expect(points.decoded!.split(',')[0]).toBe('invalid BCD');
    expect(points.reason).toMatch(/Point 1/);
  });

  it('flags the +0x00E scale outside 1-1000, keeps +0x00C raw, and treats 00 and FF as real values', () => {
    const zero = goldenPage();
    zero.set([0x00, 0x00, 0x00, 0xf0], 0x00c); // +0x00C raw 0; +0x00E masked 0
    const zeroRows = describeDm32CalibrationPage(zero, 0x2000);
    expect(zeroRows.find((r) => r.id === 'scalar-00e')!.reason).toMatch(/outside 1–1000/);
    expect(zeroRows.find((r) => r.id === 'scalar-00c')!.reason).toBeUndefined();
    const high = goldenPage();
    high.set([0x34, 0xf2], 0x00c); // bits 12-15 set: raw, not masked
    expect(
      describeDm32CalibrationPage(high, 0x2000).find((r) => r.id === 'scalar-00c')!.decoded,
    ).toBe(String(0xf234));
    const ff = new Uint8Array(4096).fill(0xff);
    const ffRows = describeDm32CalibrationPage(ff, 0x2000);
    expect(ffRows.find((r) => r.id === 'scalar-00c')!.decoded).toBe('65535');
    expect(ffRows.find((r) => r.id === 'scalar-00c')!.reason).toBeUndefined();
    expect(ffRows.find((r) => r.id === 'scalar-00e')!.decoded).toBe('4095');
    expect(ffRows.find((r) => r.id === 'scalar-00e')!.reason).toBeDefined();
    expect(ffRows.find((r) => r.id === 'power-uhf-low')!.decoded).toBe('255 255 255 255 255');
    const zeros = describeDm32CalibrationPage(new Uint8Array(4096), 0x2000);
    expect(zeros.find((r) => r.id === 'power-uhf-low')!.decoded).toBe('0 0 0 0 0');
    expect(zeros.find((r) => r.id === 'uhf-band')!.decoded).toBe('0 – 0 MHz');
  });
});

describe('describeDm32FactorySector', () => {
  it('decodes options and the TX region but never the anti-clone key', () => {
    const sector = Uint8Array.from({ length: 4096 }, (_, i) => (i * 5 + 1) & 0xff);
    sector[0x80] = 0x9e;
    sector[0xa1] = 0xa5;
    sector[0xa0] = 0xa3;
    sector.set([0xd1, 0xd2, 0xd3, 0xd4], 0x10c);
    const rows = describeDm32FactorySector(sector);
    const decode = decodeDm32FactorySector(sector);
    expect(rows.filter((r) => r.id.startsWith('factory-option')).map((r) => r.offset)).toEqual(
      decode.optionBytes.map((o) => o.offset),
    );
    expect(rows.find((r) => r.id === 'factory-gps')!.decoded).toBe('Set');
    expect(rows.find((r) => r.id === 'factory-tx-region')!.decoded).toContain('0xA5');
    expect(rows.some((r) => r.offset === 0x10c)).toBe(false);
    expect(rows.find((r) => r.id === 'factory-option-a0')!.decoded).toBe('0xA3: forces English UI');
    expect(rows.find((r) => r.id === 'factory-option-a0')!.meaningConfidence).toBe('traced');
  });
});

describe('selectDm32LiveCalibration', () => {
  const sparse = (pages: [number, Uint8Array][]) => {
    const start = Math.min(...pages.map(([a]) => a));
    const end = Math.max(...pages.map(([a]) => a)) + 4096;
    const bytes = new Uint8Array(end - start);
    for (const [a, p] of pages) bytes.set(p, a - start);
    return { id: 'sparse', address: start, bytes };
  };
  const chan = () => {
    const p = new Uint8Array(4096);
    p[0xfff] = 0x12;
    return p;
  };

  it('picks the lowest in-window tag 0x02 page at its relocated address', () => {
    const live = goldenPage(0);
    const sel = selectDm32LiveCalibration(
      archive([
        sparse([
          [0x1000, chan()],
          [0x2000, live],
        ]),
      ]),
    );
    expect(sel.address).toBe(0x2000);
    expect([...sel.page!]).toEqual([...live]);
    expect(sel.duplicates).toEqual([]);
    expect(sel.refused).toEqual([]);
  });

  it('lists a higher duplicate and does not decode it as live', () => {
    const live = goldenPage(0);
    const dup = goldenPage(1);
    const sel = selectDm32LiveCalibration(
      archive([
        sparse([
          [0x1000, live],
          [0x2000, dup],
        ]),
      ]),
    );
    expect(sel.address).toBe(0x1000);
    expect(sel.duplicates.map((d) => d.address)).toEqual([0x2000]);
    expect([...sel.duplicates[0]!.page]).toEqual([...dup]);
  });

  it('never treats tag 0x02 outside the window as calibration, and says why', () => {
    const sel = selectDm32LiveCalibration(
      archive([{ id: 'far', address: 0x8000, bytes: goldenPage() }]),
    );
    expect(sel.page).toBeUndefined();
    expect(sel.refused).toHaveLength(1);
    expect(sel.refused[0]!.reason).toMatch(/not calibration/);
  });

  it('refuses a region that is not whole blocks or whose stored length differs', () => {
    const partial = { id: 'half', address: 0x1000, bytes: new Uint8Array(6000) };
    const sel = selectDm32LiveCalibration(archive([partial]));
    expect(sel.page).toBeUndefined();
    expect(sel.refused[0]!.reason).toBe('Not whole 4 KiB blocks');

    const a = archive([{ id: 'short', address: 0x1000, bytes: goldenPage() }]);
    a.manifest.regions[0]!.byteLength = 8192;
    expect(selectDm32LiveCalibration(a).refused[0]!.reason).toMatch(/do not match the manifest/);
  });

  it('selects nothing when the archive states no window', () => {
    const a = archive([{ id: 's', address: 0x1000, bytes: goldenPage() }]);
    delete a.manifest.addressBase;
    const sel = selectDm32LiveCalibration(a);
    expect(sel.page).toBeUndefined();
    expect(sel.coverage.window).toBeUndefined();
    expect(sel.refused[0]!.reason).toMatch(/valid configuration window/);
  });

  it('returns the factory sector only from the validated factory-sector region', () => {
    const sector = new Uint8Array(4096).fill(7);
    const withFactory = archive([
      { id: 'factory-sector', address: 0x0300b000, bytes: sector },
      sparse([[0x1000, goldenPage()]]),
    ]);
    expect(selectDm32LiveCalibration(withFactory).factory?.address).toBe(0x0300b000);
    const wrongAddress = archive([{ id: 'factory-sector', address: 0x0300c000, bytes: sector }]);
    expect(selectDm32LiveCalibration(wrongAddress).factory).toBeUndefined();
  });

  it('is the page Compare decodes', () => {
    const live = goldenPage(3);
    const a = archive([
      sparse([
        [0x1000, chan()],
        [0x2000, live],
      ]),
    ]);
    const sel = selectDm32LiveCalibration(a);
    const d = decodeDm32CalibrationPage(sel.page!, sel.address!);
    const evidence = dm32ComparisonEvidence(a);
    d.uhfPower.low.forEach((byte, i) =>
      expect(evidence[`Calibration / uhfPower / low / ${i}`]).toBe(byte),
    );
    d.levels.airband.level9.forEach((byte, i) =>
      expect(evidence[`Calibration / levels / airband / level9 / ${i}`]).toBe(byte),
    );
  });
});

describe('readDm32SidecarClaims', () => {
  const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
  it('reads only well-formed claims', () => {
    expect(
      readDm32SidecarClaims({
        'calibration.json': enc({ sha256: 'ab', liveAddress: 4096 }),
        'factory-sector.json': enc({ kept: false, reason: 'mismatch' }),
      }),
    ).toEqual({
      calibration: { sha256: 'ab', liveAddress: 4096 },
      factory: { kept: false, reason: 'mismatch' },
    });
    expect(
      readDm32SidecarClaims({
        'calibration.json': enc({ sha256: 5 }),
        'factory-sector.json': new TextEncoder().encode('not json'),
      }),
    ).toEqual({});
  });
});
