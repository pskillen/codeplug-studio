import { describe, expect, it } from 'vitest';
import { listRadioTargets, radioTargetFor } from './catalog.ts';
import {
  countBuildsByTarget,
  egressSummary,
  groupBuildsByRadio,
  groupRadioCatalog,
  manufacturerForRadioTarget,
  radioTargetDisplayLabel,
} from './grouping.ts';
import { firmwareVariantFor, listRadioModels, radioModelFor } from './models.ts';

const b = (radioTargetId: string, name: string) => ({ radioTargetId, name });

describe('radio model catalog', () => {
  it('every target references an existing model and firmware', () => {
    for (const target of listRadioTargets()) {
      expect(radioModelFor(target.modelId), target.id).toBeDefined();
      expect(firmwareVariantFor(target.modelId, target.firmwareId), target.id).toBeDefined();
    }
  });

  it('each (model, firmware) pair has at most one target', () => {
    const seen = new Set<string>();
    for (const target of listRadioTargets()) {
      const key = `${target.modelId}/${target.firmwareId}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it('lists stock first for every model', () => {
    for (const model of listRadioModels()) {
      expect(model.firmware[0]?.kind, model.id).toBe('stock');
    }
  });

  it('classifies firmware kinds', () => {
    expect(firmwareVariantFor('baofeng-dm32uv', 'mm9pdy')?.kind).toBe('mod');
    expect(firmwareVariantFor('baofeng-dm32uv', 'radiofoundry')?.kind).toBe('open');
    expect(firmwareVariantFor('baofeng-dm1701', 'opengd77')?.kind).toBe('open');
  });
});

describe('target labels', () => {
  it('builds display labels from manufacturer, model and firmware', () => {
    expect(radioTargetDisplayLabel('baofeng-dm32uv')).toBe('Baofeng DM-32UV');
    expect(radioTargetDisplayLabel('baofeng-dm32uv-mm9pdy')).toBe('Baofeng DM-32UV · MM9PDY');
    expect(radioTargetDisplayLabel('baofeng-dm1701')).toBe('Baofeng DM-1701 / RT-84 · OpenGD77');
    expect(radioTargetDisplayLabel('nope')).toBe('nope');
  });

  it('resolves manufacturer, with Other for unknown ids', () => {
    expect(manufacturerForRadioTarget('tyt-md9600')).toBe('TYT');
    expect(manufacturerForRadioTarget('nope')).toBe('Other');
  });

  it('summarises export routes', () => {
    expect(egressSummary(radioTargetFor('baofeng-dm32uv')!)).toBe(
      'Web Serial · NeonPlug · DM32 CSV',
    );
  });
});

describe('groupRadioCatalog', () => {
  it('groups manufacturer → model → firmware alphabetically', () => {
    const groups = groupRadioCatalog();
    expect(groups.map((g) => g.manufacturer)).toEqual(['Anytone', 'Baofeng', 'Retevis', 'TYT']);
    const baofeng = groups.find((g) => g.manufacturer === 'Baofeng')!;
    expect(baofeng.models.map((m) => m.model.label)).toEqual([
      'DM-1701 / RT-84',
      'DM-32UV',
      'UV-21Pro V2',
      'UV-5R Mini',
    ]);
    const dm32 = baofeng.models.find((m) => m.model.id === 'baofeng-dm32uv')!;
    expect(dm32.firmware.map((f) => f.firmware.id)).toEqual(['stock', 'mm9pdy', 'radiofoundry']);
    expect(dm32.firmware.every((f) => f.supported)).toBe(true);
  });

  it('shows unsupported stock for models without a stock target', () => {
    const groups = groupRadioCatalog();
    const baofeng = groups.find((g) => g.manufacturer === 'Baofeng')!;
    const dm1701 = baofeng.models.find((m) => m.model.id === 'baofeng-dm1701')!;
    expect(dm1701.firmware[0]).toMatchObject({ supported: false, target: undefined });
    expect(dm1701.firmware[0]?.firmware.kind).toBe('stock');
    expect(dm1701.firmware[1]?.target?.id).toBe('baofeng-dm1701');
    const tyt = groups.find((g) => g.manufacturer === 'TYT')!;
    expect(tyt.models[0]?.firmware[0]?.supported).toBe(false);
  });

  it('filters by radio class', () => {
    const fm = groupRadioCatalog({ radioClass: 'fm' });
    expect(fm.flatMap((g) => g.models.map((m) => m.model.label))).toEqual([
      'UV-21Pro V2',
      'UV-5R Mini',
      'RT95 VOX',
    ]);
    expect(groupRadioCatalog({ radioClass: 'dmr' }).map((g) => g.manufacturer)).toEqual([
      'Anytone',
      'Baofeng',
      'TYT',
    ]);
  });

  it('filters by firmware kind and drops emptied models', () => {
    const modded = groupRadioCatalog({ firmware: 'modded' });
    const moddedRows = modded.flatMap((g) => g.models.flatMap((m) => m.firmware));
    expect(moddedRows.every((r) => r.firmware.kind !== 'stock')).toBe(true);
    expect(modded.flatMap((g) => g.models.map((m) => m.model.id))).not.toContain('baofeng-uv21');
    const stockRows = groupRadioCatalog({ firmware: 'stock' }).flatMap((g) =>
      g.models.flatMap((m) => m.firmware),
    );
    expect(stockRows.every((r) => r.firmware.kind === 'stock')).toBe(true);
  });

  it('searches manufacturer, model and firmware text', () => {
    const dm32 = groupRadioCatalog({ query: 'dm-32' });
    expect(dm32).toHaveLength(1);
    expect(dm32[0]?.models[0]?.firmware).toHaveLength(3);
    const rf = groupRadioCatalog({ query: 'radiofoundry' });
    expect(rf.flatMap((g) => g.models.map((m) => m.model.id))).toEqual(['baofeng-dm32uv']);
    expect(rf[0]?.models[0]?.firmware.map((f) => f.firmware.id)).toEqual(['radiofoundry']);
    expect(groupRadioCatalog({ query: 'zzz' })).toEqual([]);
  });
});

describe('groupBuildsByRadio', () => {
  it('groups manufacturer → model → firmware with sorted builds and counts', () => {
    const groups = groupBuildsByRadio([
      b('baofeng-dm32uv-mm9pdy', 'Club B'),
      b('baofeng-dm32uv', 'Spare'),
      b('baofeng-dm32uv-mm9pdy', 'Club A'),
      b('anytone-at-d890uv-mm9pdy', 'Car'),
      b('baofeng-uv5r-mini', 'Mini'),
    ]);
    expect(groups.map((g) => [g.manufacturer, g.buildCount])).toEqual([
      ['Anytone', 1],
      ['Baofeng', 4],
    ]);
    const baofeng = groups[1]!;
    expect(baofeng.models.map((m) => m.label)).toEqual(['DM-32UV', 'UV-5R Mini']);
    const dm32 = baofeng.models[0]!;
    expect(dm32.buildCount).toBe(3);
    expect(dm32.firmware.map((f) => f.firmware.id)).toEqual(['stock', 'mm9pdy']);
    expect(dm32.firmware[1]?.builds.map((x) => x.name)).toEqual(['Club A', 'Club B']);
    expect(dm32.firmware[1]?.target?.id).toBe('baofeng-dm32uv-mm9pdy');
  });

  it('keeps several builds of one target together', () => {
    const groups = groupBuildsByRadio([b('baofeng-uv5r-mini', 'B'), b('baofeng-uv5r-mini', 'A')]);
    expect(groups[0]?.models[0]?.firmware[0]?.builds.map((x) => x.name)).toEqual(['A', 'B']);
  });

  it('puts unknown targets under Other', () => {
    const groups = groupBuildsByRadio([b('legacy-radio', 'Old')]);
    expect(groups[0]?.manufacturer).toBe('Other');
    expect(groups[0]?.models[0]?.label).toBe('legacy-radio');
    expect(groups[0]?.models[0]?.model).toBeUndefined();
  });

  it('returns nothing for no builds', () => {
    expect(groupBuildsByRadio([])).toEqual([]);
  });
});

describe('countBuildsByTarget', () => {
  it('counts per target id', () => {
    const counts = countBuildsByTarget([b('a', '1'), b('a', '2'), b('b', '3')]);
    expect(counts.get('a')).toBe(2);
    expect(counts.get('b')).toBe(1);
    expect(counts.get('c')).toBeUndefined();
  });
});
