import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild, newZone } from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { reconcileBuildAfterFrequencyHideToggle } from './channelEligibilityReconcile.ts';
import { isZoneMemberOrderOverridden } from './zoneGroupingLayout.ts';

describe('reconcileBuildAfterFrequencyHideToggle', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';

  it('keeps library zone order when order was not overridden', () => {
    const inBand = withExportEligibleDefaults({ ...newChannel(projectId, 'In'), id: 'ch-in' });
    const outBand = withExportEligibleDefaults(
      { ...newChannel(projectId, 'Out'), id: 'ch-out' },
      500,
    );
    const zone = {
      ...newZone(projectId, 'Local'),
      id: 'zone-1',
      members: [
        { kind: 'channel' as const, channelId: 'ch-in' },
        { kind: 'channel' as const, channelId: 'ch-out' },
      ],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701'),
      exportSettings: { hideChannelsOutsideFrequencyRange: false },
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: 'zone-1', name: 'Local', channelIds: ['ch-in', 'ch-out'] }],
          },
        ],
      },
    };
    const library = {
      channels: [inBand, outBand],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const { build: next } = reconcileBuildAfterFrequencyHideToggle(build, library, true);
    const section = next.layout.sections.find((s) => s.kind === 'zoneGrouping');
    expect(section?.zones[0]?.channelIds).toEqual(['ch-in']);
    expect(
      isZoneMemberOrderOverridden(zone, library.zones, section?.zones[0]?.channelIds),
    ).toBe(false);
  });

  it('appends newly included channels when zone order was overridden', () => {
    const inBand = withExportEligibleDefaults({ ...newChannel(projectId, 'In'), id: 'ch-in' });
    const outBand = withExportEligibleDefaults(
      { ...newChannel(projectId, 'Out'), id: 'ch-out' },
      500,
    );
    const zone = {
      ...newZone(projectId, 'Local'),
      id: 'zone-1',
      members: [
        { kind: 'channel' as const, channelId: 'ch-out' },
        { kind: 'channel' as const, channelId: 'ch-in' },
      ],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701'),
      exportSettings: { hideChannelsOutsideFrequencyRange: true },
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: 'zone-1', name: 'Local', channelIds: ['ch-in', 'ch-out'] }],
          },
        ],
      },
    };
    const library = {
      channels: [inBand, outBand],
      zones: [zone],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    expect(isZoneMemberOrderOverridden(zone, library.zones, ['ch-in', 'ch-out'])).toBe(true);

    const { build: next, orderMayNeedRedo } = reconcileBuildAfterFrequencyHideToggle(
      build,
      library,
      false,
    );
    expect(orderMayNeedRedo).toBe(true);
    const section = next.layout.sections.find((s) => s.kind === 'zoneGrouping');
    expect(section?.zones[0]?.channelIds).toEqual(['ch-in', 'ch-out']);
  });
});
