import { expect, it } from 'vitest';
import { emptyLibrary, newZone, newRadioBuild } from '@core/domain/factories.ts';
import { librarySliceFrom } from '@core/services/assemble.ts';
import { readZoneNameCandidates } from './readZoneNameCandidates.ts';
import { planReadZoneUpsert } from './upsertReadZones.ts';

it('creates ordered zones, resolves members and scan sets, and reports missing slots', () => {
  const plan = planReadZoneUpsert(
    emptyLibrary(),
    'p',
    [
      { wireName: ' A ', channelNumbers: [2, 1, 2, 3], scanChannelNumbers: [3, 1, 2] },
      { wireName: ' ', channelNumbers: [3] },
    ],
    new Map([
      [1, 'one'],
      [2, 'two'],
    ]),
  );
  expect(
    plan.entries.map(({ name, readIndex, channelIds, scanChannelIds }) => ({
      name,
      readIndex,
      channelIds,
      scanChannelIds,
    })),
  ).toEqual([
    { name: 'A', readIndex: 0, channelIds: ['two', 'one'], scanChannelIds: ['two', 'one'] },
    { name: 'Zone 2', readIndex: 1, channelIds: [], scanChannelIds: undefined },
  ]);
  expect(plan.creates).toHaveLength(2);
  expect(plan.warnings).toEqual([
    { kind: 'missing-member', zoneName: 'A', slot: 3 },
    { kind: 'missing-member', zoneName: 'Zone 2', slot: 3 },
  ]);
});

it('preserves retained settings and nested zones, claims once, and is unchanged on reread', () => {
  const zone = {
    ...newZone('p', 'A'),
    comment: 'keep',
    order: 7,
    members: [
      { kind: 'channel' as const, channelId: 'one', includeInScanList: 'skip' as const },
      { kind: 'zone' as const, zoneId: 'nested' },
    ],
  };
  const library = { ...emptyLibrary(), zones: [zone] };
  const snapshot = structuredClone(library);
  const read = { wireName: 'A', channelNumbers: [2, 1] };
  const slots = new Map([
    [1, 'one'],
    [2, 'two'],
  ]);
  const plan = planReadZoneUpsert(library, 'p', [read, read], slots);
  expect(plan.entries.map((entry) => entry.action)).toEqual(['update', 'create']);
  expect(plan.updates[0].after).toMatchObject({
    comment: 'keep',
    order: 7,
    members: [
      { kind: 'channel', channelId: 'two' },
      { kind: 'channel', channelId: 'one', includeInScanList: 'skip' },
      { kind: 'zone', zoneId: 'nested' },
    ],
  });
  expect(library).toEqual(snapshot);
  expect(
    planReadZoneUpsert({ zones: [plan.updates[0].after] }, 'p', [read], slots).entries[0].action,
  ).toBe('unchanged');
});

it('prefers exact names and claims derived names only once', () => {
  const a = newZone('p', 'X');
  const b = newZone('p', 'Long');
  const opts = { nameCandidatesByZoneId: new Map([[b.id, ['X', 'Y']]]) };
  const plan = planReadZoneUpsert(
    { zones: [b, a] },
    'p',
    [
      { wireName: 'X', channelNumbers: [] },
      { wireName: 'Y', channelNumbers: [] },
      { wireName: 'Y', channelNumbers: [] },
    ],
    new Map(),
    opts,
  );
  expect(plan.entries.map((e) => e.zoneId)).toEqual([a.id, b.id, plan.creates[0].id]);
  expect(
    planReadZoneUpsert({ zones: [b] }, 'p', [{ wireName: 'Y', channelNumbers: [] }], new Map())
      .creates,
  ).toHaveLength(1);
});

it('matches a real shortened radio name on reread', () => {
  const zone = newZone('p', 'Regional Repeaters North');
  const library = librarySliceFrom({ ...emptyLibrary(), zones: [zone] });
  const build = newRadioBuild('p', 'baofeng-uv5r-mini-mm9pdy');
  const candidates = readZoneNameCandidates(
    library,
    build,
    'radio-io',
    'radio-io-uv5r-mini-mm9pdy',
  );
  const read = { wireName: candidates.get(zone.id)![0], channelNumbers: [1] };
  const opts = { nameCandidatesByZoneId: candidates };
  const plan = planReadZoneUpsert(library, 'p', [read], new Map([[1, 'one']]), opts);
  expect(plan.entries[0]).toMatchObject({ zoneId: zone.id, action: 'update' });
  expect(
    planReadZoneUpsert({ zones: [plan.updates[0].after] }, 'p', [read], new Map([[1, 'one']]), opts)
      .entries[0].action,
  ).toBe('unchanged');
});
