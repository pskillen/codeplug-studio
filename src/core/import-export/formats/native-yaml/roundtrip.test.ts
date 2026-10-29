import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scratchWireKey } from '@core/import-export/channelExpansion/channelOverrideKey.ts';
import { expansionWireKey } from '@core/import-export/channelExpansion/modeExportSuffix.ts';
import { multiTalkGroupMemberWireKey } from '@core/import-export/channelExpansion/multiTalkGroup.ts';
import { isSingleFileProjectExportAdapter } from '../../exportAdapter.ts';
import { isSingleFileProjectImportAdapter } from '../../importAdapter.ts';
import { getExportAdapter, getImportAdapter } from '../../registry.ts';
import { parseProjectDocument } from './parse.ts';
import { serialiseProject } from './serialise.ts';
import {
  FIXTURE_CHANNEL_A_ID,
  FIXTURE_CHANNEL_B_ID,
  FIXTURE_CHILD_ZONE_ID,
  FIXTURE_PARENT_ZONE_ID,
  FIXTURE_PROJECT_ID,
  FIXTURE_APRS_CONFIG_ID,
  FIXTURE_DIGITAL_CONTACT_ID,
  FIXTURE_DMR_OWN_ID,
  FIXTURE_NXDN_OWN_ID,
  FIXTURE_RX_LIST_ID,
  FIXTURE_TG_ID,
  FIXTURE_TIMESTAMP,
  FIXTURE_ZONE_ID,
  glasgowPmrNestedAggregate,
  fullLibraryAggregate,
  minimalProjectAggregate,
  nestedZonesAggregate,
  projectWithRadioBuildAggregate,
} from './testFixtures.ts';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { initialRevision } from '@core/models/revision.ts';

describe('native-yaml round-trip smoke', () => {
  it('serialise → parse preserves aggregate via adapters', () => {
    const aggregate = projectWithRadioBuildAggregate();
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
    const aggregate = projectWithRadioBuildAggregate();
    const yaml = serialiseProject(aggregate);
    expect(parseProjectDocument(yaml)).toEqual(aggregate);
  });

  it('preserves TalkGroup.abbreviation on round-trip', () => {
    const aggregate = projectWithRadioBuildAggregate();
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
    const aggregate = projectWithRadioBuildAggregate();
    const build = aggregate.radioBuilds[0]!;
    const withForceInclude = {
      ...aggregate,
      radioBuilds: [
        {
          ...build,
          zoneOverrides: build.zoneOverrides.map((row) =>
            row.libraryEntityId === FIXTURE_ZONE_ID ? { ...row, forceInclude: true } : row,
          ),
        },
      ],
    };
    const parsed = parseProjectDocument(serialiseProject(withForceInclude));
    const parsedBuild = parsed.radioBuilds[0];
    expect(
      parsedBuild?.zoneOverrides.find((row) => row.libraryEntityId === FIXTURE_ZONE_ID)
        ?.forceInclude,
    ).toBe(true);
  });

  it('preserves cpsWireHydration on egress path round-trip', () => {
    const aggregate = projectWithRadioBuildAggregate();
    const egressPath = aggregate.egressPaths[0]!;
    const withHydration = {
      ...aggregate,
      egressPaths: [
        {
          ...egressPath,
          hydration: {
            formatId: 'neonplug' as const,
            sourceFileName: 'radio.neonplug',
            capturedAt: '2026-07-20T12:00:00.000Z',
            retain: {
              radioIds: [
                {
                  index: 0,
                  dmrId: '2350001',
                  dmrIdValue: 2350001,
                  dmrIdBytes: [1, 0, 0],
                  name: 'Op',
                },
              ],
              quickContacts: [],
              messages: [{ text: 'CQ' }],
              digitalEmergencies: [],
              analogEmergencies: [],
              encryptionKeys: [{ id: 1, key: 'SECRET' }],
              digitalEmergencyConfig: { countIndex: 2 },
              radioSettings: { powerOnDisplayLine1: 'KEEP', beep: true },
              radioInfo: { model: 'DP570UV', firmware: '1.0' },
            },
          },
        },
      ],
    };
    const parsed = parseProjectDocument(serialiseProject(withHydration));
    expect(parsed.egressPaths[0]?.hydration).toEqual(withHydration.egressPaths[0]!.hydration);
  });

  it('preserves composite channel override keys on round-trip', () => {
    const aggregate = projectWithRadioBuildAggregate();
    const build = aggregate.radioBuilds[0]!;
    const expansionKey = expansionWireKey(FIXTURE_CHANNEL_B_ID, 'dmr');
    const multiTalkGroupKey = multiTalkGroupMemberWireKey(FIXTURE_CHANNEL_B_ID, 'dmr', {
      kind: 'talkGroup',
      id: FIXTURE_TG_ID,
    });
    const scratchKey = scratchWireKey(FIXTURE_CHANNEL_B_ID);
    const withCompositeOverrides = {
      ...aggregate,
      radioBuilds: [
        {
          ...build,
          exportSettings: { ...build.exportSettings, expandModes: true },
          channelOverrides: [
            ...build.channelOverrides,
            { libraryEntityId: expansionKey, wireName: 'GB7GL-D' },
            { libraryEntityId: multiTalkGroupKey, wireName: 'GB7GL-Scot' },
            { libraryEntityId: scratchKey, wireName: 'GB7GL Scratch' },
          ],
        },
      ],
    };

    const parsed = parseProjectDocument(serialiseProject(withCompositeOverrides));
    const parsedBuild = parsed.radioBuilds[0];
    expect(
      parsedBuild?.channelOverrides.find((row) => row.libraryEntityId === expansionKey)?.wireName,
    ).toBe('GB7GL-D');
    expect(
      parsedBuild?.channelOverrides.find((row) => row.libraryEntityId === multiTalkGroupKey)
        ?.wireName,
    ).toBe('GB7GL-Scot');
    expect(
      parsedBuild?.channelOverrides.find((row) => row.libraryEntityId === scratchKey)?.wireName,
    ).toBe('GB7GL Scratch');
  });

  it('preserves satelliteBankSlot on satelliteOverrides round-trip', () => {
    const aggregate = projectWithRadioBuildAggregate();
    const build = aggregate.radioBuilds[0]!;
    const withSlot = {
      ...aggregate,
      radioBuilds: [
        {
          ...build,
          satelliteOverrides: [{ libraryEntityId: 'tx-fm-2', satelliteBankSlot: 'fm' as const }],
        },
      ],
    };
    const parsed = parseProjectDocument(serialiseProject(withSlot));
    expect(parsed.radioBuilds[0]?.satelliteOverrides).toEqual([
      { libraryEntityId: 'tx-fm-2', satelliteBankSlot: 'fm' },
    ]);
  });

  it('preserves wireDescription (including an explicit empty string) on channelOverrides', () => {
    const aggregate = projectWithRadioBuildAggregate();
    const build = aggregate.radioBuilds[0]!;
    const withDescriptions = {
      ...aggregate,
      radioBuilds: [
        {
          ...build,
          channelOverrides: [
            { libraryEntityId: FIXTURE_CHANNEL_A_ID, wireDescription: 'Calling ch' },
            { libraryEntityId: FIXTURE_CHANNEL_B_ID, wireDescription: '' },
          ],
        },
      ],
    };
    const parsed = parseProjectDocument(serialiseProject(withDescriptions));
    expect(parsed.radioBuilds[0]?.channelOverrides).toEqual([
      { libraryEntityId: FIXTURE_CHANNEL_A_ID, wireDescription: 'Calling ch' },
      { libraryEntityId: FIXTURE_CHANNEL_B_ID, wireDescription: '' },
    ]);
  });

  it('serialises ssb mode with sideband on round-trip', () => {
    const ssbChannel: Channel = {
      ...newChannel(FIXTURE_PROJECT_ID, 'HF SSB', 'G0SSB'),
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      revision: initialRevision(),
      updatedAt: FIXTURE_TIMESTAMP,
      rxFrequency: 14200000,
      txFrequency: 14200000,
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
    expect(parsed.aprsConfiguration?.name).toBe('Home APRS');
    expect(parsed.channels.find((ch) => ch.id === FIXTURE_CHANNEL_B_ID)?.aprs?.reportType).toBe(
      'digital',
    );
    expect(parsed.aprsConfiguration?.id).toBe(FIXTURE_APRS_CONFIG_ID);
  });
});

describe('assignMm9pdyStepKeys on an AT-D890 build (#1393)', () => {
  it('still validates, round-trips and loads: old D890 files carry it, and it is simply ignored', () => {
    const aggregate = projectWithRadioBuildAggregate();
    const build = aggregate.radioBuilds[0]!;
    const withKey = {
      ...aggregate,
      radioBuilds: [
        {
          ...build,
          radioTargetId: 'anytone-at-d890uv-mm9pdy',
          exportSettings: { ...build.exportSettings, assignMm9pdyStepKeys: true },
        },
      ],
    };
    const parsed = parseProjectDocument(serialiseProject(withKey));
    expect(parsed.radioBuilds[0]?.exportSettings?.assignMm9pdyStepKeys).toBe(true);
    expect(parsed.radioBuilds[0]?.radioTargetId).toBe('anytone-at-d890uv-mm9pdy');
  });
});

describe('native-yaml NXDN profile', () => {
  function nxdnAggregate(profile: Record<string, unknown>) {
    const aggregate = fullLibraryAggregate();
    const channel: Channel = {
      ...newChannel(FIXTURE_PROJECT_ID, 'NXDN ch'),
      modeProfiles: [{ mode: 'nxdn', ...profile } as Channel['modeProfiles'][number]],
    };
    return { ...aggregate, channels: [...aggregate.channels, channel] };
  }

  it('round-trips rate, call, RX group list and Digital ID', () => {
    const aggregate = nxdnAggregate({
      rxRan: 3,
      txRan: 4,
      ownDigitalIdId: FIXTURE_NXDN_OWN_ID,
      contactRef: { kind: 'digitalContact', id: FIXTURE_DIGITAL_CONTACT_ID },
      rxGroupListId: FIXTURE_RX_LIST_ID,
      nxdnRate: 'nxdn96',
    });
    const yaml = serialiseProject(aggregate);
    expect(yaml).toContain('contactRef');
    expect(yaml).not.toContain('talkGroupRef');
    const parsed = parseProjectDocument(yaml);
    expect(parsed.channels.at(-1)?.modeProfiles[0]).toEqual({
      mode: 'nxdn',
      rxRan: 3,
      txRan: 4,
      ownDigitalIdId: FIXTURE_NXDN_OWN_ID,
      contactRef: { kind: 'digitalContact', id: FIXTURE_DIGITAL_CONTACT_ID },
      rxGroupListId: FIXTURE_RX_LIST_ID,
      nxdnRate: 'nxdn96',
    });
  });

  it('loads a legacy talkGroupRef as contactRef', () => {
    const yaml = serialiseProject(
      nxdnAggregate({
        rxRan: null,
        txRan: null,
        ownDigitalIdId: null,
        contactRef: { kind: 'talkGroup', id: FIXTURE_TG_ID },
      }),
    ).replace('contactRef:', 'talkGroupRef:');
    expect(yaml).toContain('talkGroupRef:');
    const profile = parseProjectDocument(yaml).channels.at(-1)?.modeProfiles[0];
    expect(profile).toMatchObject({
      mode: 'nxdn',
      contactRef: { kind: 'talkGroup', id: FIXTURE_TG_ID },
      rxGroupListId: null,
      nxdnRate: null,
    });
    expect(profile && 'talkGroupRef' in profile).toBe(false);
  });

  it('rejects a dangling NXDN call or RX group list', () => {
    const dangling = serialiseProject(
      nxdnAggregate({
        rxRan: null,
        txRan: null,
        ownDigitalIdId: null,
        contactRef: { kind: 'digitalContact', id: 'missing' },
      }),
    );
    expect(() => parseProjectDocument(dangling)).toThrow(/not found/);
    const danglingList = serialiseProject(
      nxdnAggregate({ rxRan: null, txRan: null, ownDigitalIdId: null, rxGroupListId: 'missing' }),
    );
    expect(() => parseProjectDocument(danglingList)).toThrow(/not found/);
  });
});

describe('native-yaml Digital IDs', () => {
  const importFixture = (name: string) =>
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/import', name),
      'utf8',
    );

  it('round-trips a default per protocol and the channel choice', () => {
    const aggregate = fullLibraryAggregate();
    const parsed = parseProjectDocument(serialiseProject(aggregate));
    expect(parsed.ownDigitalIds).toEqual(aggregate.ownDigitalIds);
    expect(parsed.ownDigitalIds.filter((row) => row.isDefault).map((row) => row.protocol)).toEqual([
      'dmr',
      'nxdn',
    ]);
    const dmr = parsed.channels
      .flatMap((channel) => channel.modeProfiles)
      .find((profile) => profile.mode === 'dmr');
    expect(dmr).toMatchObject({ ownDigitalIdId: FIXTURE_DMR_OWN_ID });
  });

  it('loads a schema 29 file with a typed DMR ID as an unnamed Digital ID with no default', () => {
    const parsed = parseProjectDocument(importFixture('own-ids-schema29.yaml'));
    expect(parsed.ownDigitalIds).toHaveLength(1);
    const [row] = parsed.ownDigitalIds;
    expect(row).toMatchObject({ name: '', protocol: 'dmr', number: 2351123, isDefault: false });
    const dmr = parsed.channels
      .flatMap((channel) => channel.modeProfiles)
      .find((profile) => profile.mode === 'dmr');
    expect(dmr).toMatchObject({ ownDigitalIdId: row!.id });
    expect(dmr).not.toHaveProperty('dmrId');
    // Idempotent: saving and loading again keeps the same row.
    const again = parseProjectDocument(serialiseProject(parsed));
    expect(again.ownDigitalIds).toEqual(parsed.ownDigitalIds);
  });

  it('loads a schema 29 NXDN unitId as an NXDN Digital ID', () => {
    const yaml = serialiseProject(
      (() => {
        const aggregate = fullLibraryAggregate();
        const channel: Channel = {
          ...newChannel(FIXTURE_PROJECT_ID, 'NXDN ch'),
          modeProfiles: [
            {
              mode: 'nxdn',
              rxRan: null,
              txRan: null,
              ownDigitalIdId: FIXTURE_NXDN_OWN_ID,
              contactRef: null,
            },
          ],
        };
        return { ...aggregate, channels: [...aggregate.channels, channel] };
      })(),
    )
      .replace('studioSchemaVersion: 30', 'studioSchemaVersion: 29')
      .replace(`ownDigitalIdId: ${FIXTURE_NXDN_OWN_ID}`, 'unitId: 77');
    const parsed = parseProjectDocument(yaml);
    expect(parsed.ownDigitalIds.some((row) => row.protocol === 'nxdn' && row.number === 77)).toBe(
      true,
    );
  });

  it('rejects the same protocol and number twice, and several defaults in a protocol', () => {
    const aggregate = fullLibraryAggregate();
    const dmrRow = aggregate.ownDigitalIds!.find((row) => row.protocol === 'dmr')!;
    const twin = { ...dmrRow, id: '11111111-1111-4111-8111-111111111111', isDefault: false };
    expect(() =>
      parseProjectDocument(
        serialiseProject({ ...aggregate, ownDigitalIds: [...aggregate.ownDigitalIds!, twin] }),
      ),
    ).toThrow(/more than once/);
    const otherNumber = { ...twin, number: dmrRow.number + 1, isDefault: true };
    expect(() =>
      parseProjectDocument(
        serialiseProject({
          ...aggregate,
          ownDigitalIds: [...aggregate.ownDigitalIds!, otherNumber],
        }),
      ),
    ).toThrow(/more than one default/);
  });

  it('rejects a channel that names a Digital ID that does not exist', () => {
    const yaml = serialiseProject(fullLibraryAggregate()).replace(
      `ownDigitalIdId: ${FIXTURE_DMR_OWN_ID}`,
      'ownDigitalIdId: 99999999-9999-4999-8999-999999999999',
    );
    expect(() => parseProjectDocument(yaml)).toThrow(/not a DMR Digital ID/);
  });

  it('rejects a DMR channel that names an NXDN Digital ID', () => {
    const yaml = serialiseProject(fullLibraryAggregate()).replace(
      `ownDigitalIdId: ${FIXTURE_DMR_OWN_ID}`,
      `ownDigitalIdId: ${FIXTURE_NXDN_OWN_ID}`,
    );
    expect(() => parseProjectDocument(yaml)).toThrow(/not a DMR Digital ID/);
  });

  it('rejects the old dmrId field in a schema 30 file', () => {
    const yaml = serialiseProject(fullLibraryAggregate()).replace(
      `ownDigitalIdId: ${FIXTURE_DMR_OWN_ID}`,
      'dmrId: 2351123',
    );
    expect(() => parseProjectDocument(yaml)).toThrow(
      /dmrId is replaced by ownDigitalIdId in schema 30/,
    );
  });
});

describe('rt95ZoneKey export setting', () => {
  it('round-trips and rejects out-of-range values', () => {
    const aggregate = projectWithRadioBuildAggregate();
    const build = aggregate.radioBuilds[0]!;
    const withKey = {
      ...aggregate,
      radioBuilds: [
        {
          ...build,
          exportSettings: { ...build.exportSettings, rt95ZoneKey: { group: 2, key: 3 } },
        },
      ],
    };
    const text = serialiseProject(withKey as typeof aggregate);
    expect(parseProjectDocument(text).radioBuilds[0]?.exportSettings?.rt95ZoneKey).toEqual({
      group: 2,
      key: 3,
    });
    expect(() => parseProjectDocument(text.replace(/key: 3/, 'key: 9'))).toThrow();
  });
});
