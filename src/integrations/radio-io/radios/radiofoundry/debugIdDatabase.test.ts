import { describe, expect, it } from 'vitest';
import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import {
  DMR_ID_DATABASE_ADDRESS,
  DMR_ID_DATABASE_AREA1_RECORDS,
  DMR_ID_DATABASE_RECORD_BYTES,
  DMR_ID_DATABASE_SIZE_BYTE,
  encodeDmrIdDatabase,
  type DmrIdDatabaseRow,
} from './idDatabase.ts';
import { FLASH_IMAGE_START } from './constants.ts';
import {
  RADIOFOUNDRY_DEBUG_IDDB_SIDECAR,
  RADIOFOUNDRY_DEBUG_INFO_SIDECAR,
  RADIOFOUNDRY_REGION,
} from './debugCapture.ts';
import { MD9600_RADIOFOUNDRY_CABLE_BOARD } from './board.ts';
import { radioFoundryMemoryFixtureArchive } from './__fixtures__/debugMemoryArchive.ts';
import { parseIddbRadioReply, radioFoundryIdDatabaseView } from './debugIdDatabase.ts';

function row(digitalId: number, callsign: string, name = ''): DmrIdDatabaseRow {
  return { digitalId, callsign, name };
}

function rows(count: number): DmrIdDatabaseRow[] {
  return Array.from({ length: count }, (_, i) =>
    row(2_340_001 + i, `MM0A${String(i).padStart(2, '0')}`),
  );
}

function embedArea1(flash: Uint8Array, area1: Uint8Array) {
  flash.set(area1, DMR_ID_DATABASE_ADDRESS - FLASH_IMAGE_START);
}

function archiveWithFlash(
  flash: Uint8Array,
  extra: Partial<Parameters<typeof radioFoundryIdDatabaseView>[0]> = {},
) {
  const base = radioFoundryMemoryFixtureArchive();
  return {
    manifest: { ...base.manifest, radioModelId: 'MD-9600-RadioFoundry' },
    regions: { ...base.regions, [RADIOFOUNDRY_REGION.flash]: flash, ...extra.regions },
    sidecars: extra.sidecars ?? {},
  };
}

function iddbSidecar(format: number, records: number, found = 1): Uint8Array {
  const out = new Uint8Array(6);
  out[0] = format;
  out[1] = records & 0xff;
  out[2] = (records >> 8) & 0xff;
  out[3] = (records >> 16) & 0xff;
  out[4] = (records >>> 24) & 0xff;
  out[5] = found;
  return out;
}

function infoImageEnd(end: number): Uint8Array {
  const info = new Uint8Array(24);
  info[16] = end & 0xff;
  info[17] = (end >> 8) & 0xff;
  info[18] = (end >> 16) & 0xff;
  info[19] = (end >>> 24) & 0xff;
  return info;
}

describe('radioFoundryIdDatabaseView', () => {
  it('decodes 300 rows in area 1 with lookup hit and miss', () => {
    const warnings: ExportWarning[] = [];
    const encoded = encodeDmrIdDatabase(rows(300), warnings)!;
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, encoded.area1);
    const view = radioFoundryIdDatabaseView(archiveWithFlash(flash));
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;
    expect(view.area2Records).toBe(0);
    expect(view.integrity.ascending).toBe(true);
    const hit = view.lookup(2_340_150);
    expect(hit).toEqual({ found: true, index: 149, text: expect.stringContaining('MM0A') });
    const miss = view.lookup(9_999_999);
    expect(miss).toEqual({ found: false, nearest: { index: 299, id: 2_340_300 } });
  });

  it('spills into area 2 and stays ascending across the join', () => {
    const count = DMR_ID_DATABASE_AREA1_RECORDS + 5;
    const warnings: ExportWarning[] = [];
    const encoded = encodeDmrIdDatabase(rows(count), warnings)!;
    expect(encoded.area2.length).toBeGreaterThan(0);
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, encoded.area1);
    const view = radioFoundryIdDatabaseView(
      archiveWithFlash(flash, { regions: { [RADIOFOUNDRY_REGION.area2]: encoded.area2 } }),
    );
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;
    expect(view.area2Records).toBe(5);
    expect(view.integrity.ascending).toBe(true);
  });

  it('reports notCaptured for lookup past area 1 when area 2 was not read', () => {
    const count = DMR_ID_DATABASE_AREA1_RECORDS + 5;
    const encoded = encodeDmrIdDatabase(rows(count), [])!;
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, encoded.area1);
    const view = radioFoundryIdDatabaseView(archiveWithFlash(flash));
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;
    expect(view.area2Records).toBe('not-captured');
    expect(view.lookup(2_340_001 + DMR_ID_DATABASE_AREA1_RECORDS)).toEqual({ notCaptured: true });
  });

  it('names a join break when area 2 is out of order', () => {
    const count = DMR_ID_DATABASE_AREA1_RECORDS + 2;
    const encoded = encodeDmrIdDatabase(rows(count), [])!;
    const area2 = encoded.area2.slice();
    const a = area2.subarray(0, DMR_ID_DATABASE_RECORD_BYTES);
    const b = area2.subarray(DMR_ID_DATABASE_RECORD_BYTES, DMR_ID_DATABASE_RECORD_BYTES * 2);
    area2.set(b, 0);
    area2.set(a, DMR_ID_DATABASE_RECORD_BYTES);
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, encoded.area1);
    const view = radioFoundryIdDatabaseView(
      archiveWithFlash(flash, { regions: { [RADIOFOUNDRY_REGION.area2]: area2 } }),
    );
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;
    expect(view.integrity.ascending).toBe(false);
    expect(view.integrity.firstBreak!.index).toBeGreaterThanOrEqual(DMR_ID_DATABASE_AREA1_RECORDS);
  });

  it('counts blank records the header claims among captured bytes', () => {
    const warnings: ExportWarning[] = [];
    const encoded = encodeDmrIdDatabase(rows(10), warnings)!;
    const area1 = encoded.area1.slice();
    const headerCount = 60;
    area1[8] = headerCount & 0xff;
    area1[9] = (headerCount >> 8) & 0xff;
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, area1);
    const view = radioFoundryIdDatabaseView(archiveWithFlash(flash));
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;
    expect(view.integrity.blankRecords).toBe(50);
  });

  it('says the radio does not read a database past the image ceiling', () => {
    const warnings: ExportWarning[] = [];
    const huge = rows(5000);
    const encoded = encodeDmrIdDatabase(huge, warnings)!;
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, encoded.area1);
    const lowEnd = DMR_ID_DATABASE_ADDRESS + DMR_ID_DATABASE_RECORD_BYTES * 20;
    const view = radioFoundryIdDatabaseView(
      archiveWithFlash(flash, {
        sidecars: { [RADIOFOUNDRY_DEBUG_INFO_SIDECAR]: infoImageEnd(lowEnd) },
      }),
    );
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;
    expect(view.radioReadsIt).toBe(false);
  });

  it('shows format n without decoding records', () => {
    const header = new Uint8Array(12);
    header.set([0x49, 0x64, 0x6e, DMR_ID_DATABASE_SIZE_BYTE, 0x30, 0x30, 0x31, 0x00, 100, 0, 0, 0]);
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, header);
    const view = radioFoundryIdDatabaseView(archiveWithFlash(flash));
    expect(view.status).toBe('voice-prompt-area2');
    if (view.status === 'voice-prompt-area2') {
      expect(view.area2Address).toBe(0xaf400);
      expect(view.headerCount).toBe(100);
    }
  });

  it('shows compact format C', () => {
    const header = new Uint8Array(12);
    header.set([0x49, 0x64, 0x43, 0x00, 0x30, 0x30, 0x31, 0x00, 1, 0, 0, 0]);
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, header);
    expect(radioFoundryIdDatabaseView(archiveWithFlash(flash)).status).toBe('compact');
  });

  it('shows none without Id magic', () => {
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    const area1 = new Uint8Array(12).fill(0xff);
    embedArea1(flash, area1);
    expect(radioFoundryIdDatabaseView(archiveWithFlash(flash)).status).toBe('none');
  });

  it('rejects an unexpected record size byte', () => {
    const header = new Uint8Array(12);
    header.set([0x49, 0x64, 0x4e, 0x66, 0x30, 0x30, 0x31, 0x00, 1, 0, 0, 0]);
    const flash = radioFoundryMemoryFixtureArchive().regions[RADIOFOUNDRY_REGION.flash]!.slice();
    embedArea1(flash, header);
    const view = radioFoundryIdDatabaseView(archiveWithFlash(flash));
    expect(view.status).toBe('unreadable');
  });

  it('parses debug/iddb.bin into radio reply', () => {
    const sidecars = { [RADIOFOUNDRY_DEBUG_IDDB_SIDECAR]: iddbSidecar(0x4e, 300) };
    expect(parseIddbRadioReply(sidecars)).toEqual({ format: 'N', records: 300 });
    expect(parseIddbRadioReply({})).toBeUndefined();
  });
});
