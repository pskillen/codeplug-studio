import { describe, expect, it } from 'vitest';
import {
  OPENGD77_SETTINGS_ADDRESS,
  OPENGD77_SETTINGS_MEMBER_COUNT,
  OPENGD77_SETTINGS_SIZE,
  decodeOpenGd77CodeplugGeneral,
  decodeOpenGd77Settings,
} from './settings.ts';

/** A synthetic flash window [start, end) with planted bytes; reads succeed only inside it. */
function reader(start: number, end: number, plant: Record<number, number[]>) {
  const flash = new Uint8Array(0x10000).fill(0xff);
  for (const [abs, bytes] of Object.entries(plant)) flash.set(bytes, Number(abs));
  return (abs: number, length: number) =>
    abs >= start && abs + length <= end ? flash.slice(abs, abs + length) : undefined;
}

const BASE = OPENGD77_SETTINGS_ADDRESS;
const FULL_MAGIC = { [BASE]: [0x80, 0x47, 0x00, 0x00] };

describe('decodeOpenGd77Settings', () => {
  it('has 59 members on both models and the inferred struct sizes', () => {
    expect(OPENGD77_SETTINGS_MEMBER_COUNT).toBe(59);
    for (const [model, size, padding] of [
      ['dm-1701', 0x74, 3],
      ['md-9600', 0x70, 0],
    ] as const) {
      const d = decodeOpenGd77Settings(model, reader(0, 0x10000, FULL_MAGIC));
      if (d.status !== 'ok') throw new Error('expected ok');
      expect(d.members).toHaveLength(59);
      expect(d.size).toBe(size);
      expect(OPENGD77_SETTINGS_SIZE[model]).toBe(size);
      expect(d.paddingBytes).toBe(padding);
      expect(d.memberBytes + d.paddingBytes).toBe(size);
      expect(d.capturedBytes).toBe(d.memberBytes);
    }
  });

  it('decodes the 21 bytes today captures and shows the rest as not captured', () => {
    const read = reader(BASE, 0x6060, { ...FULL_MAGIC, [BASE + 0x0c]: [0x40 | 0x80, 0x03] });
    const d = decodeOpenGd77Settings('dm-1701', read);
    if (d.status !== 'ok') throw new Error('expected ok');
    const get = (id: string) => d.members.find((m) => m.id === id)!;
    expect(get('magicNumber').value).toBe('0x4780');
    expect(get('timezone').value).toBe('UTC+00:00, local time shown');
    expect(get('beepOptions').value).toBe('TX start, TX stop');
    expect(get('vfoScanLow').state).toBe('partly-captured');
    expect(get('vfoScanLow').value).toBeUndefined();
    expect(get('vfoScanLow').raw).toHaveLength(1);
    expect(get('vfoScanHigh').state).toBe('not-captured');
    expect(d.capturedBytes).toBe(0x60 - 0x4b);
    expect(d.provenance).toMatch(/last power-off or CPS save/);
  });

  it('decodes more when the capture holds more, per model', () => {
    const plant = { ...FULL_MAGIC, [BASE + 0x46]: [8], [BASE + 0x4b]: [2] };
    const dm = decodeOpenGd77Settings('dm-1701', reader(BASE, BASE + 0x74, plant));
    const md = decodeOpenGd77Settings('md-9600', reader(BASE, BASE + 0x70, plant));
    if (dm.status !== 'ok' || md.status !== 'ok') throw new Error('expected ok');
    expect(dm.members.find((m) => m.id === 'txPowerLevel')!.value).toBe('8 · 5 W');
    expect(md.members.find((m) => m.id === 'txPowerLevel')!.value).toBe('8 · 40 W');
    expect(md.provenance).toMatch(/backup SRAM/);
    expect(dm.members.find((m) => m.id === 'unused1')!.hasReader).toBe(false);
    expect(md.members.find((m) => m.id === 'unused1')!.hasReader).toBe(true);
    const offset = (d: typeof dm, id: string) => d.members.find((m) => m.id === id)!.offset;
    expect(offset(dm, 'ecoLevel')).toBe(0x69);
    expect(offset(md, 'ecoLevel')).toBe(0x68);
    expect(offset(dm, 'lastTalkerOnScreenTimer')).toBe(0x70);
    expect(offset(md, 'lastTalkerOnScreenTimer')).toBe(0x6f);
    expect(dm.members.find((m) => m.id === 'roaming')!.confidence).toBe('partly');
  });

  it('refuses a wrong magic and reports a missing one', () => {
    const wrong = decodeOpenGd77Settings(
      'md-9600',
      reader(0, 0x10000, { [BASE]: [0x76, 0x47, 0, 0] }),
    );
    expect(wrong).toMatchObject({ status: 'refused' });
    const none = decodeOpenGd77Settings('dm-1701', reader(0x80, 0x6000, {}));
    expect(none).toMatchObject({ status: 'not-captured' });
  });

  it('decodes location, scan edges and bit options', () => {
    // lat: sign 0, 55 degrees, decimal 12345 -> 55.12345
    const lat = (55 << 23) | 12345;
    const plant = {
      ...FULL_MAGIC,
      [BASE + 0x04]: [lat & 0xff, (lat >> 8) & 0xff, (lat >> 16) & 0xff, (lat >>> 24) & 0xff],
      [BASE + 0x08]: [0, 0, 0, 0x7f],
      [BASE + 0x14]: [0x40, 0x42, 0x0f, 0x00, 0, 0, 0, 0],
      [BASE + 0x24]: [0x11, 0, 0, 0],
    };
    const d = decodeOpenGd77Settings('dm-1701', reader(0, 0x10000, plant));
    if (d.status !== 'ok') throw new Error('expected ok');
    const get = (id: string) => d.members.find((m) => m.id === id)!;
    expect(get('location.lat').value).toBe('55.12345 degrees');
    expect(get('location.lon').value).toBe('not set (0x7F000000)');
    expect(get('vfoScanLow').value).toBe('A 10.00000 MHz; B unset (0)');
    expect(get('bitfieldOptions').value).toMatch(/inverse video.*settings updated/);
  });
});

describe('decodeOpenGd77CodeplugGeneral', () => {
  it('decodes band limits, callsign and DMR ID, and marks the rest unused', () => {
    const plant = {
      0x80: [0x00, 0x04],
      0xe0: [...new TextEncoder().encode('M0TEST'), 0xff, 0xff],
      0xe8: [0x00, 0x23, 0x45, 0x67],
    };
    const rows = decodeOpenGd77CodeplugGeneral(reader(0x80, 0x6060, plant));
    const get = (id: string) => rows.find((r) => r.id === id)!;
    expect(get('minUHFFreq').value).toBe('400 MHz');
    expect(get('radioName').value).toBe('M0TEST');
    expect(get('radioId').value).toBe('234567');
    expect(get('sn').hasReader).toBe(false);
    expect(rows.every((r) => r.captured)).toBe(true);
    const none = decodeOpenGd77CodeplugGeneral(reader(0x6000, 0x6060, {}));
    expect(none.every((r) => !r.captured)).toBe(true);
  });
});
