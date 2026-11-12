import { describe, expect, it } from 'vitest';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { upsertOverride } from '@core/domain/formatBuildOverrides.ts';
import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import type { Channel, Zone } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { assemble } from '@core/services/assemble.ts';
import type { RadioWriteOrganisation } from '@integrations/radio-io/radioWriteProjection.ts';
import { uv5rMiniZoneIntentFromOrganisation } from '@integrations/radio-io/radios/uv5r-mini/modDataIntent.ts';
import { encodeUv5rMiniZoneTable } from '@integrations/radio-io/radios/uv5r-mini/modData/index.ts';
import {
  projectUv5rMiniMm9pdy,
  uv5rMiniMm9pdyZoneOrderedAssembled,
} from './radioIoUv5rMiniMm9pdyProjection.ts';

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
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-rt95-mm9pdy');
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
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-rt95-mm9pdy');
    build.channelOverrides = upsertOverride(build.channelOverrides, 'b', { orderOrSlot: 5 });
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const ordered = uv5rMiniMm9pdyZoneOrderedAssembled(assembled);
    expect(ordered.channels.find((r) => r.entity.id === 'b')?.orderOrSlot).toBe(5);
  });

  it('passes a clean zone through with no warnings', () => {
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
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain('Zone "Empty"');
    expect(texts[0]).toContain('empty zones are skipped');
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

  it('gives an info warning for an order the radio cannot follow, and sorts', () => {
    const warnings: ExportWarning[] = [];
    const { zones } = projectUv5rMiniMm9pdy({
      zones: [{ wireName: 'Back', channelNumbers: [3, 1] }],
      warnings,
    });
    expect(zones[0]?.channelNumbers).toEqual([1, 3]);
    const texts = warnings.map(formatExportWarning);
    expect(texts.some((t) => t.includes('channel-number order'))).toBe(true);
  });

  it('leaves out channels past slot 999 and warns', () => {
    const { zones, texts } = run([{ wireName: 'Far', channelNumbers: [999, 1000] }]);
    expect(zones[0]?.channelNumbers).toEqual([999]);
    expect(texts.some((t) => t.includes('beyond 999'))).toBe(true);
  });

  it('produces the empty-table intent for no zones, and null without the flag', () => {
    const org: RadioWriteOrganisation = { writeUv5rMiniZones: true };
    expect(uv5rMiniZoneIntentFromOrganisation(org)).toEqual({ zones: [] });
    expect(uv5rMiniZoneIntentFromOrganisation({ zones: [] })).toBeNull();
    expect(uv5rMiniZoneIntentFromOrganisation(undefined)).toBeNull();
  });

  it('maps channel numbers to 0-based slots and feeds the encoder', () => {
    const { zones } = run([{ wireName: 'Local', channelNumbers: [1, 5] }]);
    const intent = uv5rMiniZoneIntentFromOrganisation({ writeUv5rMiniZones: true, zones });
    expect(intent).toEqual({ zones: [{ name: 'Local', slotIndexes: [0, 4] }] });
    const encoded = encodeUv5rMiniZoneTable(intent!);
    expect(encoded.sector).toHaveLength(4096);
    expect(encoded.generation).toBeGreaterThan(0);
  });
});
