import { describe, expect, it } from 'vitest';
import { expansionWireKey } from '@core/import-export/channelExpansion/modeExportSuffix.ts';
import { multiTalkGroupMemberWireKey } from '@core/import-export/channelExpansion/multiTalkGroup.ts';
import { isSingleFileProjectExportAdapter } from '../../exportAdapter.ts';
import { isSingleFileProjectImportAdapter } from '../../importAdapter.ts';
import { getExportAdapter, getImportAdapter } from '../../registry.ts';
import { parseProjectDocument } from './parse.ts';
import { serialiseProject } from './serialise.ts';
import {
  FIXTURE_CHANNEL_B_ID,
  FIXTURE_CHILD_ZONE_ID,
  FIXTURE_PARENT_ZONE_ID,
  FIXTURE_PROJECT_ID,
  FIXTURE_APRS_CONFIG_ID,
  FIXTURE_TG_ID,
  FIXTURE_TIMESTAMP,
  FIXTURE_ZONE_ID,
  glasgowPmrNestedAggregate,
  fullLibraryAggregate,
  minimalProjectAggregate,
  nestedZonesAggregate,
  projectWithFormatBuildAggregate,
} from './testFixtures.ts';
import type { Channel } from '@core/models/library.ts';
import { initialRevision } from '@core/models/revision.ts';

describe('native-yaml round-trip smoke', () => {
  it('serialise → parse preserves aggregate via adapters', () => {
    const aggregate = projectWithFormatBuildAggregate();
    const exportAdapter = getExportAdapter('native-yaml');
    const importAdapter = getImportAdapter('native-yaml');

    if (!isSingleFileProjectExportAdapter(exportAdapter)) {
      throw new Error('expected single-file export adapter');
    }
    if (!isSingleFileProjectImportAdapter(importAdapter)) {
      throw new Error('expected single-file import adapter');
    }

    const { content } = exportAdapter.serialise(aggregate);
    const { project } = importAdapter.parseDocument(content);

    expect(project).toEqual(aggregate);
  });

  it('serialise → parse via module functions', () => {
    const aggregate = projectWithFormatBuildAggregate();
    const yaml = serialiseProject(aggregate);
    expect(parseProjectDocument(yaml)).toEqual(aggregate);
  });

  it('preserves TalkGroup.abbreviation on round-trip', () => {
    const aggregate = projectWithFormatBuildAggregate();
    expect(aggregate.talkGroups[0]?.abbreviation).toBe('Sco');
    const yaml = serialiseProject(aggregate);
    const parsed = parseProjectDocument(yaml);
    expect(parsed.talkGroups[0]?.abbreviation).toBe('Sco');
  });

  it('preserves nested zone members on round-trip', () => {
    const aggregate = nestedZonesAggregate();
    const parsed = parseProjectDocument(serialiseProject(aggregate));
    const parent = parsed.zones.find((zone) => zone.id === FIXTURE_PARENT_ZONE_ID);
    expect(parent?.members).toEqual([
      { kind: 'zone', zoneId: FIXTURE_CHILD_ZONE_ID },
      { kind: 'channel', channelId: FIXTURE_CHANNEL_B_ID },
    ]);
  });

  it('preserves omitFromExport on round-trip', () => {
    const aggregate = glasgowPmrNestedAggregate();
    const parsed = parseProjectDocument(serialiseProject(aggregate));
    const pmr = parsed.zones.find((zone) => zone.id === FIXTURE_CHILD_ZONE_ID);
    expect(pmr?.omitFromExport).toBe(true);
    expect(pmr?.name).toBe('PMR446');
  });

  it('preserves hideFromInternalMap on round-trip', () => {
    const aggregate = fullLibraryAggregate();
    const channels = aggregate.channels.map((ch, index) =>
      index === 0 ? { ...ch, hideFromInternalMap: true } : ch,
    );
    const withHidden = { ...aggregate, channels };
    const parsed = parseProjectDocument(serialiseProject(withHidden));
    expect(parsed.channels[0]?.hideFromInternalMap).toBe(true);
  });

  it('preserves forceInclude on zone overrides round-trip', () => {
    const aggregate = projectWithFormatBuildAggregate();
    const build = aggregate.formatBuilds[0]!;
    const withForceInclude = {
      ...aggregate,
      formatBuilds: [
        {
          ...build,
          zoneOverrides: build.zoneOverrides.map((row) =>
            row.libraryEntityId === FIXTURE_ZONE_ID ? { ...row, forceInclude: true } : row,
          ),
        },
      ],
    };
    const parsed = parseProjectDocument(serialiseProject(withForceInclude));
    const parsedBuild = parsed.formatBuilds[0];
    expect(
      parsedBuild?.zoneOverrides.find((row) => row.libraryEntityId === FIXTURE_ZONE_ID)
        ?.forceInclude,
    ).toBe(true);
  });

  it('preserves composite channel override keys on round-trip', () => {
    const aggregate = projectWithFormatBuildAggregate();
    const build = aggregate.formatBuilds[0]!;
    const expansionKey = expansionWireKey(FIXTURE_CHANNEL_B_ID, 'dmr');
    const multiTalkGroupKey = multiTalkGroupMemberWireKey(FIXTURE_CHANNEL_B_ID, 'dmr', {
      kind: 'talkGroup',
      id: FIXTURE_TG_ID,
    });
    const withCompositeOverrides = {
      ...aggregate,
      formatBuilds: [
        {
          ...build,
          exportSettings: { ...build.exportSettings, expandModes: true },
          channelOverrides: [
            ...build.channelOverrides,
            { libraryEntityId: expansionKey, wireName: 'GB7GL-D' },
            { libraryEntityId: multiTalkGroupKey, wireName: 'GB7GL-Scot' },
          ],
        },
      ],
    };

    const parsed = parseProjectDocument(serialiseProject(withCompositeOverrides));
    const parsedBuild = parsed.formatBuilds[0];
    expect(
      parsedBuild?.channelOverrides.find((row) => row.libraryEntityId === expansionKey)?.wireName,
    ).toBe('GB7GL-D');
    expect(
      parsedBuild?.channelOverrides.find((row) => row.libraryEntityId === multiTalkGroupKey)
        ?.wireName,
    ).toBe('GB7GL-Scot');
  });

  it('serialises ssb mode with sideband on round-trip', () => {
    const ssbChannel: Channel = {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      projectId: FIXTURE_PROJECT_ID,
      revision: initialRevision(),
      updatedAt: FIXTURE_TIMESTAMP,
      name: 'HF SSB',
      callsign: 'G0SSB',
      rxFrequency: 14200000,
      txFrequency: 14200000,
      location: null,
      useLocation: false,
      maidenheadLocator: null,
      power: null,
      scanInclusion: 'default',
      forbidTransmit: false,
      comment: '',
      primaryMode: null,
      scanListId: undefined,
      modeProfiles: [
        {
          mode: 'ssb',
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: null,
          ssbSideband: 'lsb',
        },
      ],
    };
    const aggregate = { ...minimalProjectAggregate(), channels: [ssbChannel] };
    const yaml = serialiseProject(aggregate);
    expect(yaml).toContain('mode: ssb');
    expect(yaml).toContain('ssbSideband: lsb');
    expect(parseProjectDocument(yaml).channels[0]?.modeProfiles[0]).toMatchObject({
      mode: 'ssb',
      ssbSideband: 'lsb',
    });
  });

  it('preserves APRS configuration and channel binding on round-trip', () => {
    const aggregate = fullLibraryAggregate();
    const parsed = parseProjectDocument(serialiseProject(aggregate));
    expect(parsed.aprsConfigurations).toHaveLength(1);
    expect(parsed.aprsConfigurations[0]?.name).toBe('Home APRS');
    expect(parsed.channels.find((ch) => ch.id === FIXTURE_CHANNEL_B_ID)?.aprs?.reportType).toBe(
      'digital',
    );
    expect(parsed.aprsConfigurations[0]?.id).toBe(FIXTURE_APRS_CONFIG_ID);
  });
});
