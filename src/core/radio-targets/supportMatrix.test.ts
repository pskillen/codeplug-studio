import { describe, expect, it } from 'vitest';
import { modelIdForFirmwareRadio, type FirmwareRadioId } from '@core/firmware/index.ts';

const FLASHER_RADIOS: FirmwareRadioId[] = [
  'baofeng-dm32uv',
  'anytone-at-d890uv',
  'retevis-rt95-head',
];
import { RADIO_MODELS } from './models.ts';
import { RADIO_TARGETS } from './catalog.ts';
import { buildSupportMatrix, filterSupportMatrix, SUPPORT_COLUMNS } from './supportMatrix.ts';

function row(modelId: string, firmwareId: string, input = {}) {
  const model = buildSupportMatrix(input).find((m) => m.model.id === modelId)!;
  return model.firmware.find((f) => f.firmware.id === firmwareId)!;
}

describe('buildSupportMatrix', () => {
  it('lists every model with every firmware variant, stock included', () => {
    const matrix = buildSupportMatrix();
    expect(matrix.map((m) => m.model.id)).toEqual(Object.keys(RADIO_MODELS));
    for (const m of matrix) {
      expect(m.firmware.map((f) => f.firmware.id)).toEqual(m.model.firmware.map((f) => f.id));
      expect(m.firmware[0].firmware.kind).toBe('stock');
    }
  });

  it('marks stock with no target as entirely unsupported', () => {
    const stock = row('baofeng-dm1701', 'stock');
    expect(stock.supported).toBe(false);
    expect(stock.targetId).toBeUndefined();
    expect(Object.values(stock.cells).every((s) => s === 'unsupported')).toBe(true);
    expect(stock.score).toBe(0);
  });

  it('marks DMR columns not applicable on FM radios', () => {
    const uv5r = row('baofeng-uv5r-mini', 'stock');
    expect(uv5r.cells.talkGroups).toBe('na');
    expect(uv5r.cells.multiTalkGroup).toBe('na');
    expect(uv5r.cells.zones).toBe('unsupported');
  });

  it('shows per-channel scan flags as partial and zone-as-scan as full scan lists', () => {
    expect(row('baofeng-uv5r-mini', 'stock').cells.scanLists).toBe('partial');
    expect(row('baofeng-dm32uv', 'mm9pdy').cells.scanLists).toBe('supported');
    expect(row('baofeng-dm32uv', 'mm9pdy').cells.zoneIsScan).toBe('supported');
    expect(row('baofeng-dm32uv', 'stock').cells.scanLists).toBe('supported');
    expect(row('anytone-at-d890uv', 'stock').cells.scanLists).toBe('supported');
  });

  it('derives cable write, read-back and CPS file from the compatible egress', () => {
    const dm32Stock = row('baofeng-dm32uv', 'stock');
    expect(dm32Stock.cells.writeCable).toBe('supported');
    expect(dm32Stock.cells.cpsFile).toBe('supported');
    const mod = row('baofeng-dm32uv', 'mm9pdy');
    expect(mod.cells.writeCable).toBe('supported');
    expect(mod.cells.cpsFile).toBe('unsupported');
    expect(row('baofeng-dm32uv', 'radiofoundry').cells.cpsFile).toBe('supported');
  });

  it('derives multi-talk-group from the trait', () => {
    expect(row('baofeng-dm1701', 'opengd77').cells.multiTalkGroup).toBe('supported');
    expect(row('baofeng-dm32uv', 'stock').cells.multiTalkGroup).toBe('unsupported');
  });

  it('flash: stock n/a, MM9PDY on a flasher radio supported, open firmware unsupported', () => {
    expect(row('baofeng-dm32uv', 'stock').cells.flash).toBe('na');
    expect(row('baofeng-dm32uv', 'mm9pdy').cells.flash).toBe('supported');
    expect(row('baofeng-dm32uv', 'radiofoundry').cells.flash).toBe('unsupported');
    expect(row('baofeng-dm1701', 'opengd77').cells.flash).toBe('unsupported');
    expect(row('retevis-rt95', 'mm9pdy').cells.flash).toBe('supported');
  });

  it('respects injected site availability', () => {
    const availability = {
      cableWrite: () => false,
      cableRead: () => false,
      firmwareFlash: () => false,
    };
    const mod = row('baofeng-dm32uv', 'mm9pdy', { availability });
    expect(mod.cells.writeCable).toBe('unsupported');
    expect(mod.cells.readBack).toBe('unsupported');
    expect(mod.cells.flash).toBe('unsupported');
    expect(mod.cells.zones).toBe('supported');
  });

  it('picks the firmware with the most features as best', () => {
    const dm32 = buildSupportMatrix().find((m) => m.model.id === 'baofeng-dm32uv')!;
    const best = dm32.firmware.find((f) => f.firmware.id === dm32.bestFirmwareId)!;
    for (const f of dm32.firmware) expect(best.score).toBeGreaterThanOrEqual(f.score);
    const dm1701 = buildSupportMatrix().find((m) => m.model.id === 'baofeng-dm1701')!;
    expect(dm1701.bestFirmwareId).toBe('opengd77');
  });

  it('filters by radio class', () => {
    const matrix = buildSupportMatrix();
    expect(filterSupportMatrix(matrix, 'all')).toHaveLength(matrix.length);
    expect(filterSupportMatrix(matrix, 'fm').every((m) => m.model.radioClass === 'fm')).toBe(true);
    expect(filterSupportMatrix(matrix, 'dmr').every((m) => m.model.radioClass === 'dmr')).toBe(
      true,
    );
  });

  it('has a cell for every column on every row', () => {
    for (const m of buildSupportMatrix())
      for (const f of m.firmware)
        for (const c of SUPPORT_COLUMNS) expect(f.cells[c.id]).toBeDefined();
  });
});

describe('flasher radio mapping', () => {
  it('maps every flasher radio to a catalog model that has a mod target', () => {
    for (const radioId of FLASHER_RADIOS) {
      const modelId = modelIdForFirmwareRadio(radioId);
      const model = RADIO_MODELS[modelId];
      expect(model, modelId).toBeDefined();
      const mod = model.firmware.find((f) => f.kind === 'mod');
      expect(mod, modelId).toBeDefined();
      expect(
        Object.values(RADIO_TARGETS).some((t) => t.modelId === modelId && t.firmwareId === mod!.id),
      ).toBe(true);
    }
  });
});
