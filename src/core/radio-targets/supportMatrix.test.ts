import { describe, expect, it } from 'vitest';
import { modelIdForFirmwareRadio, type FirmwareRadioId } from '@core/firmware/index.ts';

const FLASHER_RADIOS: FirmwareRadioId[] = [
  'baofeng-dm32uv',
  'anytone-at-d890uv',
  'retevis-rt95-head',
];
import { RADIO_MODELS } from './models.ts';
import { RADIO_TARGETS } from './catalog.ts';
import { RADIO_RF_CAPABILITIES } from './rfCapabilities.ts';
import { RADIOFOUNDRY_STUDIO_PIN } from '@core/radios/radiofoundry/firmware.ts';
import {
  buildSupportMatrix,
  filterSupportMatrix,
  listSupportModeColumns,
  SUPPORT_COLUMNS,
  SUPPORT_MODE_ORDER,
} from './supportMatrix.ts';
import { SUPPORT_FACTS } from './supportEvidence.ts';

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
    const rt84Stock = row('retevis-rt84', 'stock');
    expect(rt84Stock.supported).toBe(false);
    expect(rt84Stock.targetId).toBeUndefined();
    const rt90Stock = row('retevis-rt90', 'stock');
    expect(rt90Stock.supported).toBe(false);
    expect(rt90Stock.targetId).toBeUndefined();
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
    expect(row('baofeng-dm1701', 'radiofoundry').cells.cpsFile).toBe('supported');
    expect(row('retevis-rt84', 'radiofoundry').cells.cpsFile).toBe('supported');
    expect(row('tyt-md9600', 'radiofoundry').cells.cpsFile).toBe('supported');
    expect(row('retevis-rt90', 'radiofoundry').cells.cpsFile).toBe('supported');
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

  it('lists mode columns for the modes some target supports, in display order', () => {
    expect(
      listSupportModeColumns([{ supportedModes: ['dmr', 'fm'] }, { supportedModes: ['nxdn'] }]),
    ).toEqual(['fm', 'dmr', 'nxdn']);
    const fromCatalog = listSupportModeColumns();
    expect(fromCatalog).toContain('fm');
    expect(fromCatalog).toContain('dmr');
    expect(fromCatalog).toEqual(
      SUPPORT_MODE_ORDER.filter((m) =>
        Object.values(RADIO_RF_CAPABILITIES).some((r) => r.supportedModes.includes(m)),
      ),
    );
  });

  it("marks a mode supported where the target's RF row lists it", () => {
    const dm32 = row('baofeng-dm32uv', 'radiofoundry');
    expect(dm32.modes.fm?.state).toBe('supported');
    expect(dm32.modes.dmr?.state).toBe('supported');
    expect(dm32.modes.am?.state).toBe('unsupported');
    expect(row('anytone-at-d890uv', 'mm9pdy').modes.nxdn?.state).toBe('supported');
    expect(row('anytone-at-d890uv', 'mm9pdy').modes.nxdn?.note).toBeTruthy();
    expect(row('anytone-at-d890uv', 'stock').modes.nxdn?.state).toBe('unsupported');
  });

  it('marks digital modes not applicable on FM radios', () => {
    const uv5r = row('baofeng-uv5r-mini', 'stock');
    expect(uv5r.modes.dmr?.state).toBe('na');
    expect(uv5r.modes.nxdn?.state).toBe('na');
    expect(uv5r.modes.fm?.state).toBe('supported');
  });

  it('gives every mode unsupported without a target', () => {
    const stock = row('baofeng-dm1701', 'stock');
    for (const cell of Object.values(stock.modes)) {
      expect(cell?.state).toBe('unsupported');
      expect(cell?.paths).toEqual([]);
      expect(cell?.evidence).toBeUndefined();
    }
  });

  it('carries recorded evidence on RadioFoundry rows only', () => {
    const dm32 = row('baofeng-dm32uv', 'radiofoundry');
    expect(dm32.modes.fm?.evidence).toBe('bench');
    expect(dm32.modes.fm?.evidenceSource).toBeTruthy();
    const dm1701 = row('baofeng-dm1701', 'radiofoundry');
    expect(dm1701.modes.dmr?.evidence).toBe('on-air');
    expect(dm1701.modes.dmr?.evidenceSource).toBeTruthy();
    const md9600 = row('tyt-md9600', 'radiofoundry');
    expect(md9600.modes.dmr?.evidence).toBe('unverified');
    expect(md9600.modes.dmr?.evidenceSource).toBeTruthy();
    expect(row('anytone-at-d890uv', 'stock').modes.fm?.evidence).toBeUndefined();
  });

  it('lists the paths each mode travels', () => {
    expect(row('baofeng-dm32uv', 'radiofoundry').modes.fm?.paths).toEqual(['cable', 'file']);
    expect(row('baofeng-dm32uv', 'mm9pdy').modes.fm?.paths).toEqual(['cable']);
    expect(
      row('baofeng-dm32uv', 'radiofoundry', { availability: { cableWrite: () => false } }).modes.fm
        ?.paths,
    ).toEqual(['file']);
  });

  it("applies a fact's path restriction", () => {
    const restricted = {
      facts: {
        ...SUPPORT_FACTS,
        modes: {
          'baofeng-dm32uv-radiofoundry': { dmr: { paths: ['cable'] as const } },
        },
      },
    };
    const dm32 = row('baofeng-dm32uv', 'radiofoundry', restricted);
    expect(dm32.modes.dmr?.paths).toEqual(['cable']);
    expect(dm32.modes.fm?.paths).toEqual(['cable', 'file']);
  });

  it('names the checked build on RadioFoundry rows', () => {
    const dm32 = row('baofeng-dm32uv', 'radiofoundry');
    expect(dm32.build?.label).toContain(RADIOFOUNDRY_STUDIO_PIN.git);
    expect(dm32.build?.label).toContain(RADIOFOUNDRY_STUDIO_PIN.date);
    expect(row('baofeng-dm32uv', 'stock').build).toBeUndefined();
  });

  it('derives satellite keps from the injected hook, off by default', () => {
    for (const m of buildSupportMatrix())
      for (const f of m.firmware) expect(f.cells.satelliteKeps).not.toBe('supported');
    const availability = {
      satelliteKeps: (e: { profileId: string }) => e.profileId === 'radio-io-at-d890uv',
    };
    expect(row('anytone-at-d890uv', 'stock', { availability }).cells.satelliteKeps).toBe(
      'supported',
    );
    expect(row('baofeng-dm32uv', 'radiofoundry', { availability }).cells.satelliteKeps).toBe(
      'unsupported',
    );
  });

  it('notes that RadioFoundry satellite keps depend on the build', () => {
    const withKeps = {
      availability: { satelliteKeps: () => true },
    };
    for (const m of buildSupportMatrix(withKeps)) {
      for (const f of m.firmware) {
        if (f.firmware.id !== 'radiofoundry') continue;
        expect(f.notes.satelliteKeps?.length).toBeGreaterThan(0);
      }
    }
    expect(row('anytone-at-d890uv', 'stock').notes.satelliteKeps).toBeUndefined();
  });

  it('shows a feature note only on a supported cell', () => {
    const withKeps = {
      facts: {
        ...SUPPORT_FACTS,
        featureNotes: { radiofoundry: { satelliteKeps: 'x' } },
      },
      availability: { satelliteKeps: () => true },
    };
    expect(row('baofeng-dm32uv', 'radiofoundry', withKeps).notes.satelliteKeps).toBe('x');
    const off = {
      facts: withKeps.facts,
      availability: { satelliteKeps: () => false },
    };
    expect(row('baofeng-dm32uv', 'radiofoundry', off).notes.satelliteKeps).toBeUndefined();
  });

  it('scores feature columns only', () => {
    for (const m of buildSupportMatrix())
      for (const f of m.firmware) {
        const expected = SUPPORT_COLUMNS.reduce(
          (sum, c) =>
            sum + (f.cells[c.id] === 'supported' ? 1 : f.cells[c.id] === 'partial' ? 0.5 : 0),
          0,
        );
        expect(f.score).toBe(expected);
      }
  });

  it('has a mode cell for every mode column on every row', () => {
    const columns = listSupportModeColumns();
    for (const m of buildSupportMatrix())
      for (const f of m.firmware) for (const mode of columns) expect(f.modes[mode]).toBeDefined();
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
