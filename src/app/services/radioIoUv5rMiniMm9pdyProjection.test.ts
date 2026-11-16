import { describe, expect, it, vi } from 'vitest';
import * as miniScanSets from '@integrations/radio-io/radios/uv5r-mini/modData/scanSets.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { upsertOverride } from '@core/domain/formatBuildOverrides.ts';
import { seedZoneGroupingFromLibrary } from '@core/domain/zoneGroupingLayout.ts';
import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import type { Channel, Zone } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { assemble } from '@core/services/assemble.ts';
import type { RadioWriteOrganisation } from '@integrations/radio-io/radioWriteProjection.ts';
import { uv5rMiniZoneIntentFromOrganisation } from '@integrations/radio-io/radios/uv5r-mini/modDataIntent.ts';
import {
  decodeUv5rMiniZoneTable,
  encodeUv5rMiniZoneTable,
} from '@integrations/radio-io/radios/uv5r-mini/modData/index.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';
import {
  projectUv5rMiniMm9pdy,
  uv5rMiniMm9pdyZoneOrderedAssembled,
} from './radioIoUv5rMiniMm9pdyProjection.ts';

const firmwareNote =
  "Some zones scan only part of their channels. Firmware older than 1.1.0 uses each channel's Scan in All channels setting instead, or scans all channels if none are included.";

const MM = 'radio-io-uv5r-mini-mm9pdy';

function ch(id: string, name: string, mhz: number): Channel {
  return withExportEligibleDefaults({
    ...newChannel('p1', name, ''),
    id,
    rxFrequency: mhz * 1_000_000,
    txFrequency: mhz * 1_000_000,
  });
}

function zone(id: string, name: string, channelIds: string[]): Zone {
  return {
    ...newZone('p1', name),
    id,
    members: channelIds.map((channelId) => ({ kind: 'channel' as const, channelId })),
  };
}

function lib(channels: Channel[], zones: Zone[]): LibrarySlice {
  return {
    channels,
    zones,
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  };
}

function run(zones: { wireName: string; channelNumbers: number[] }[]) {
  const warnings: ExportWarning[] = [];
  const out = projectUv5rMiniMm9pdy({ zones, warnings });
  return { zones: out.zones, texts: warnings.map(formatExportWarning) };
}

describe('UV-5R Mini MM9PDY projection', () => {
  it('numbers channels in zone order, one position for a channel in two zones', () => {
    const library = lib(
      [ch('a', 'Alpha', 145.5), ch('b', 'Bravo', 145.6), ch('c', 'Charlie', 145.7)],
      [zone('z1', 'First', ['c', 'a']), zone('z2', 'Second', ['a', 'b'])],
    );
    const { build, egress } = newRadioBuildForProfile('p1', MM);
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const ordered = uv5rMiniMm9pdyZoneOrderedAssembled({
      ...assembled,
      zones: [
        { ...assembled.zones[0]!, zoneId: 'z1', memberChannelIds: ['c', 'a'] },
        { ...assembled.zones[0]!, zoneId: 'z2', memberChannelIds: ['a', 'b'] },
      ],
    });
    expect(ordered.channels.map((r) => r.entity.id)).toEqual(['c', 'a', 'b']);
  });

  it('keeps a pinned slot on the reordered row', () => {
    const library = lib([ch('a', 'Alpha', 145.5), ch('b', 'Bravo', 145.6)], []);
    const { build, egress } = newRadioBuildForProfile('p1', MM);
    build.channelOverrides = upsertOverride(build.channelOverrides, 'b', { orderOrSlot: 5 });
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const ordered = uv5rMiniMm9pdyZoneOrderedAssembled(assembled);
    expect(ordered.channels.find((r) => r.entity.id === 'b')?.orderOrSlot).toBe(5);
  });

  it('does not show a firmware note when every member scans', () => {
    const { zones, texts } = run([{ wireName: 'Local', channelNumbers: [1, 2, 3] }]);
    expect(zones).toEqual([{ wireName: 'Local', channelNumbers: [1, 2, 3] }]);
    expect(texts).toEqual([]);
  });

  it('drops an empty zone and says empty zones are skipped', () => {
    const { zones, texts } = run([
      { wireName: 'Local', channelNumbers: [1] },
      { wireName: 'Empty', channelNumbers: [] },
    ]);
    expect(zones.map((z) => z.wireName)).toEqual(['Local']);
    expect(
      texts.some((t) => t.includes('Zone "Empty"') && t.includes('empty zones are skipped')),
    ).toBe(true);
    expect(texts.some((t) => t.includes("won't scan"))).toBe(true);
  });

  it('cuts a 13-character name to 12 and warns', () => {
    const { zones, texts } = run([{ wireName: 'ABCDEFGHIJKLM', channelNumbers: [1] }]);
    expect(zones[0]?.wireName).toBe('ABCDEFGHIJKL');
    expect(texts.some((t) => t.includes('was shortened to "ABCDEFGHIJKL"'))).toBe(true);
  });

  it('folds non-ASCII text and warns once', () => {
    const { zones, texts } = run([{ wireName: 'Café ☎', channelNumbers: [1] }]);
    expect(zones[0]?.wireName).toBe('Cafe -');
    expect(texts.filter((t) => t.includes('replaced with "-"'))).toHaveLength(1);
  });

  it('keeps the first 24 of 25 zones and warns', () => {
    const input = Array.from({ length: 25 }, (_, i) => ({
      wireName: `Z${i}`,
      channelNumbers: [i + 1],
    }));
    const { zones, texts } = run(input);
    expect(zones).toHaveLength(24);
    expect(zones[23]?.wireName).toBe('Z23');
    expect(texts.some((t) => t.includes('1 zones were not written'))).toBe(true);
  });

  it('preserves a zone member order for the writer', () => {
    const warnings: ExportWarning[] = [];
    const { zones } = projectUv5rMiniMm9pdy({
      zones: [{ wireName: 'Back', channelNumbers: [3, 1] }],
      warnings,
    });
    expect(zones[0]?.channelNumbers).toEqual([3, 1]);
    expect(warnings.some((w) => w.kind === 'zone_order')).toBe(false);
  });

  it('names each order that does not fit and still tries a later small zone', () => {
    const warnings: ExportWarning[] = [];
    const large = Array.from({ length: 500 }, (_, i) => 500 - i);
    projectUv5rMiniMm9pdy({
      zones: [
        { wireName: 'Too large', channelNumbers: large },
        { wireName: 'Later', channelNumbers: [2, 1] },
      ],
      warnings,
    });
    expect(warnings.filter((w) => w.kind === 'zone_order')).toEqual([
      { kind: 'zone_order', severity: 'problem', zoneName: 'Too large' },
    ]);
  });

  it('accounts for scan sets when warning about zone orders that do not fit', () => {
    const members = Array.from({ length: 999 }, (_, i) => i + 1);
    const crowded = Array.from({ length: 4 }, (_, i) => ({
      wireName: `Set${i}`,
      channelNumbers: members,
      scanChannelNumbers: members.slice(1),
    }));
    const warnings: ExportWarning[] = [];
    projectUv5rMiniMm9pdy({
      zones: [
        ...crowded,
        { wireName: 'No room', channelNumbers: Array.from({ length: 50 }, (_, i) => 50 - i) },
        { wireName: 'Fits', channelNumbers: [2, 1] },
      ],
      warnings,
    });
    expect(warnings.filter((w) => w.kind === 'zone_order')).toEqual([
      { kind: 'zone_order', severity: 'problem', zoneName: 'No room' },
    ]);
    const noFallback: ExportWarning[] = [];
    projectUv5rMiniMm9pdy({
      zones: [...crowded, { wireName: 'Fits', channelNumbers: [2, 1] }],
      warnings: noFallback,
    });
    expect(noFallback.filter((w) => w.kind === 'zone_order')).toEqual([]);
  });

  it('leaves out channels past slot 999 and warns', () => {
    const { zones, texts } = run([{ wireName: 'Far', channelNumbers: [999, 1000] }]);
    expect(zones[0]?.channelNumbers).toEqual([999]);
    expect(texts.some((t) => t.includes('beyond 999'))).toBe(true);
  });

  it('names only zones that do not fit and still tries later zones', () => {
    const members = Array.from({ length: 999 }, (_, i) => i + 1);
    const warnings: ExportWarning[] = [];
    projectUv5rMiniMm9pdy({
      zones: [
        ...Array.from({ length: 5 }, (_, i) => ({
          wireName: `Z${i}`,
          channelNumbers: members,
          scanChannelNumbers: members.slice(1),
        })),
        { wireName: 'Later', channelNumbers: [1, 2, 3], scanChannelNumbers: [1, 2] },
      ],
      warnings,
    });
    const room = warnings.filter((w) => w.kind === 'zone_scan_set' && w.issue === 'room-exceeded');
    expect(room).toHaveLength(1);
    const message = formatExportWarning(room[0]!);
    expect(message).toContain('"Z4"');
    expect(message).not.toContain('"Later"');
  });

  it('does not count a capacity fallback as a skipped set', () => {
    // An isolated fallback is synthetic: real capacity overflow also needs earlier kind-1 zones.
    const fill = vi.spyOn(miniScanSets, 'fillMiniScanSets').mockReturnValue({
      bits: [],
      fallback: [0],
      kinds: [0],
      needed: 4433,
    });
    try {
      const warnings: ExportWarning[] = [];
      projectUv5rMiniMm9pdy({
        zones: [{ wireName: 'Fallback', channelNumbers: [1, 2, 3], scanChannelNumbers: [1, 2] }],
        warnings,
      });
      expect(warnings.some((w) => w.kind === 'zone_scan_set' && w.issue === 'room-exceeded')).toBe(
        true,
      );
      expect(warnings.map(formatExportWarning)).not.toContain(firmwareNote);
    } finally {
      fill.mockRestore();
    }
  });

  it('produces the empty-table intent for no zones, and null without the flag', () => {
    const org: RadioWriteOrganisation = { writeUv5rMiniZones: true };
    expect(uv5rMiniZoneIntentFromOrganisation(org)).toEqual({ writeScanSets: true, zones: [] });
    expect(uv5rMiniZoneIntentFromOrganisation({ zones: [] })).toBeNull();
    expect(uv5rMiniZoneIntentFromOrganisation(undefined)).toBeNull();
  });

  it('maps channel numbers to 0-based slots and feeds the encoder', () => {
    const { zones } = run([{ wireName: 'Local', channelNumbers: [1, 5] }]);
    const intent = uv5rMiniZoneIntentFromOrganisation({ writeUv5rMiniZones: true, zones });
    expect(intent).toEqual({
      writeScanSets: true,
      zones: [{ name: 'Local', slotIndexes: [0, 4], scanSlotIndexes: [0, 4] }],
    });
    const encoded = encodeUv5rMiniZoneTable(intent!);
    expect(encoded.sector).toHaveLength(4096);
    expect(encoded.generation).toBeGreaterThan(0);
  });
});

/** The whole Write wiring: assemble, number, project, flag, intent, encode. */
function writeProjection(
  library: LibrarySlice,
  tweak?: (b: ReturnType<typeof newRadioBuildForProfile>['build']) => void,
) {
  const { build, egress } = newRadioBuildForProfile('p1', MM);
  build.layout = { sections: [seedZoneGroupingFromLibrary(library)] };
  tweak?.(build);
  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  const projection = buildRadioWriteProjection(assembled, build, library, egress);
  const intent = uv5rMiniZoneIntentFromOrganisation(projection.organisation);
  return {
    projection,
    intent,
    encoded: intent ? encodeUv5rMiniZoneTable(intent) : null,
    texts: projection.warnings.map(formatExportWarning),
  };
}

describe('UV-5R Mini MM9PDY Write projection wiring', () => {
  it('numbers channels in zone order, sets the flag, and encodes zones at those numbers', () => {
    const library = lib(
      [ch('a', 'Alpha', 145.5), ch('b', 'Bravo', 145.6), ch('c', 'Charlie', 145.7)],
      [zone('z1', 'First', ['c', 'a']), zone('z2', 'Second', ['a', 'b'])],
    );
    const { projection, intent, encoded } = writeProjection(library);
    expect(projection.numbersBySourceChannelId.get('c')).toEqual([1]);
    expect(projection.numbersBySourceChannelId.get('a')).toEqual([2]);
    expect(projection.numbersBySourceChannelId.get('b')).toEqual([3]);
    expect(projection.organisation.writeUv5rMiniZones).toBe(true);
    // Every member is in its zone's scan set by default.
    expect(projection.organisation.zones).toEqual([
      { wireName: 'First', channelNumbers: [1, 2], scanChannelNumbers: [1, 2] },
      { wireName: 'Second', channelNumbers: [2, 3], scanChannelNumbers: [2, 3] },
    ]);
    expect(intent).toEqual({
      writeScanSets: true,
      zones: [
        { name: 'First', slotIndexes: [0, 1], scanSlotIndexes: [0, 1] },
        { name: 'Second', slotIndexes: [1, 2], scanSlotIndexes: [1, 2] },
      ],
    });
    const decoded = decodeUv5rMiniZoneTable(encoded!.sector);
    expect('zones' in decoded && decoded.zones).toEqual(
      intent!.zones.map(({ name, slotIndexes }) => ({ name, slotIndexes })),
    );
  });

  it('keeps a pinned channel at its slot and points the zone at the pinned number', () => {
    const library = lib(
      [ch('a', 'Alpha', 145.5), ch('b', 'Bravo', 145.6)],
      [zone('z1', 'Pinned', ['a', 'b'])],
    );
    const { projection, intent } = writeProjection(library, (build) => {
      build.channelOverrides = upsertOverride(build.channelOverrides, 'b', { orderOrSlot: 7 });
    });
    expect(projection.numbersBySourceChannelId.get('b')).toEqual([7]);
    const a = projection.numbersBySourceChannelId.get('a')![0]!;
    const numbers = [a, 7];
    expect(projection.organisation.zones).toEqual([
      { wireName: 'Pinned', channelNumbers: numbers, scanChannelNumbers: numbers },
    ]);
    expect(intent?.zones[0]?.slotIndexes).toContain(6);
  });

  it('drops a zone with no channels on the radio and still encodes the rest', () => {
    // 50 MHz is outside the Mini's bands, so the zone has nothing on the radio.
    const library = lib(
      [ch('a', 'Alpha', 145.5), ch('x', 'SixMetre', 50.5)],
      [zone('z1', 'Local', ['a']), zone('z2', 'Empty', ['x'])],
    );
    const { projection, intent, encoded } = writeProjection(library);
    expect(projection.organisation.zones?.map((z) => z.wireName)).toEqual(['Local']);
    expect(intent?.zones).toEqual([{ name: 'Local', slotIndexes: [0], scanSlotIndexes: [0] }]);
    // Header, one name frame, the zone's two bitmap frames.
    expect(encoded?.frames.map((f) => f.address)).toEqual([0xc000, 0xc200, 0xc400, 0xc440, 0xc040]);
  });

  it('writes an empty table (an intent with no zones) when the build has no zones', () => {
    const { projection, intent, encoded } = writeProjection(lib([ch('a', 'Alpha', 145.5)], []));
    expect(projection.organisation.writeUv5rMiniZones).toBe(true);
    expect(intent).toEqual({ writeScanSets: true, zones: [] });
    expect(encoded?.frames.map((f) => f.address)).toEqual([0xc000, 0xc040]);
  });

  it('writes each zone scan set independently of the MMZ1 table', () => {
    const channels = [ch('a', 'Alpha', 145.5), ch('b', 'Bravo', 145.6), ch('c', 'Charlie', 145.7)];
    const plain = writeProjection(lib(channels, [zone('z1', 'Local', ['a', 'b', 'c'])]));
    // A member skip in the library, and this build's per-zone skip of another member.
    const skipping = writeProjection(
      lib(channels, [
        {
          ...zone('z1', 'Local', []),
          members: [
            { kind: 'channel', channelId: 'a' },
            { kind: 'channel', channelId: 'b', includeInScanList: 'skip' },
            { kind: 'channel', channelId: 'c' },
          ],
        },
      ]),
      (build) => {
        const section = build.layout.sections[0];
        if (section?.kind === 'zoneGrouping') {
          section.zones[0]!.scanMemberInclusion = { c: 'skip' };
        }
      },
    );
    expect(skipping.projection.organisation.zones).toEqual([
      { wireName: 'Local', channelNumbers: [1, 2, 3], scanChannelNumbers: [1] },
    ]);
    expect(skipping.intent?.zones[0]?.scanSlotIndexes).toEqual([0]);
    expect(skipping.encoded?.frames.slice(0, -1)).toEqual(plain.encoded?.frames.slice(0, -1));
    expect(skipping.encoded?.frames.at(-1)).not.toEqual(plain.encoded?.frames.at(-1));
    expect(skipping.texts.some((t) => t.includes("won't scan"))).toBe(true);
    expect(skipping.projection.warnings).toContainEqual({
      kind: 'general',
      severity: 'info',
      message: firmwareNote,
    });
  });

  it('stock Mini projection carries no zones and no flag', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const library = lib([ch('a', 'Alpha', 145.5)], [zone('z1', 'Local', ['a'])]);
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.organisation.writeUv5rMiniZones).toBeUndefined();
    expect(uv5rMiniZoneIntentFromOrganisation(projection.organisation)).toBeNull();
  });
});
