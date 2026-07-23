import { parse as parseYaml } from 'yaml';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NativeYamlImportError } from './errors.ts';
import { parseProjectDocument, parseProjectDocumentWithWarnings } from './parse.ts';
import {
  fullLibraryAggregate,
  minimalProjectAggregate,
  nestedZonesAggregate,
} from './testFixtures.ts';
import { serialiseProject } from './serialise.ts';
import { validateDocument } from './validate.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/import');

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

function aggregateEqual(
  actual: ReturnType<typeof parseProjectDocument>,
  expected: ReturnType<typeof minimalProjectAggregate>,
): void {
  expect(actual).toEqual(expected);
}

describe('native-yaml parse', () => {
  it('parses valid minimal fixture', () => {
    aggregateEqual(
      parseProjectDocument(readFixture('valid-minimal.yaml')),
      minimalProjectAggregate(),
    );
  });

  it('parses valid full library fixture', () => {
    aggregateEqual(parseProjectDocument(readFixture('valid-full.yaml')), fullLibraryAggregate());
  });

  it('parses nested zone members via serialised round-trip', () => {
    const aggregate = nestedZonesAggregate();
    aggregateEqual(parseProjectDocument(serialiseProject(aggregate)), aggregate);
  });

  it('parses channels with omitted nullable fields', () => {
    const aggregate = parseProjectDocument(readFixture('omitted-nullables.yaml'));
    expect(aggregate.channels).toHaveLength(1);
    const channel = aggregate.channels[0]!;
    expect(channel.maidenheadLocator).toBeNull();
    expect(channel.location).toBeNull();
    expect(channel.rxFrequency).toBeNull();
    expect(channel.txFrequency).toBeNull();
    expect(channel.power).toBeNull();
    expect(channel.scanInclusion).toBe('default');
    const fm = channel.modeProfiles[0];
    expect(fm?.mode).toBe('fm');
    if (fm?.mode === 'fm') {
      expect(fm.squelch).toBeNull();
      expect(fm.bandwidthKHz).toBeNull();
    }
    const dmr = channel.modeProfiles[1];
    expect(dmr?.mode).toBe('dmr');
    if (dmr?.mode === 'dmr') {
      expect(dmr.contactRef).toBeNull();
      expect(dmr.rxGroupListId).toBeNull();
      expect(dmr.timeslot).toBeNull();
      expect(dmr.colourCode).toBeNull();
      expect(dmr.dmrId).toBeNull();
    }
    const ysf = channel.modeProfiles[2];
    expect(ysf?.mode).toBe('ysf');
    if (ysf?.mode === 'ysf') {
      expect(ysf.wiresDtmfId).toBe('');
      expect(ysf.dgId).toBeNull();
    }
    expect(channel.hideFromInternalMap).toBeUndefined();
  });

  it('parses hideFromInternalMap when true', () => {
    const aggregate = fullLibraryAggregate();
    const withHidden = {
      ...aggregate,
      channels: aggregate.channels.map((ch, index) =>
        index === 0 ? { ...ch, hideFromInternalMap: true } : ch,
      ),
    };
    const parsed = parseProjectDocument(serialiseProject(withHidden));
    expect(parsed.channels[0]?.hideFromInternalMap).toBe(true);
  });

  it('rejects corrupt YAML', () => {
    expect(() => parseProjectDocument(readFixture('corrupt.yaml'))).toThrow(NativeYamlImportError);
    expect(() => parseProjectDocument(readFixture('corrupt.yaml'))).toThrow(/Invalid YAML syntax/);
  });

  it('defaults scanInclusion when omitted and migrates legacy scanSkip', () => {
    const omitted = parseProjectDocument(readFixture('omitted-nullables.yaml'));
    expect(omitted.channels[0]?.scanInclusion).toBe('default');

    const legacyYaml = readFixture('omitted-nullables.yaml').replace(
      'useLocation: false',
      'useLocation: false\n      scanSkip: true',
    );
    const legacy = parseProjectDocument(legacyYaml);
    expect(legacy.channels[0]?.scanInclusion).toBe('skip');
  });

  it('migrates legacy ssb-usb mode profile on import', () => {
    const yaml = readFixture('omitted-nullables.yaml').replace('mode: fm', 'mode: ssb-usb');
    const parsed = parseProjectDocument(yaml);
    const profile = parsed.channels[0]?.modeProfiles[0];
    expect(profile?.mode).toBe('ssb');
    if (profile?.mode === 'ssb') {
      expect(profile.ssbSideband).toBe('usb');
    }
  });

  it('parses ssb profile with explicit lsb sideband', () => {
    const yaml = readFixture('omitted-nullables.yaml')
      .replace('mode: fm', 'mode: ssb')
      .replace('rxTone: none', 'ssbSideband: lsb\n          rxTone: none');
    const parsed = parseProjectDocument(yaml);
    const profile = parsed.channels[0]?.modeProfiles[0];
    expect(profile).toMatchObject({ mode: 'ssb', ssbSideband: 'lsb' });
  });
});

describe('native-yaml validate', () => {
  it('rejects studioSchemaVersion mismatch', () => {
    expect(() => validateDocument(parseYamlTree(readFixture('version-mismatch.yaml')))).toThrow(
      /Unsupported studioSchemaVersion/,
    );
  });

  it('drops legacy formatBuilds with a warning instead of validating their FKs', () => {
    const { aggregate, warnings } = parseProjectDocumentWithWarnings(
      readFixture('broken-fk.yaml'),
    );
    expect(aggregate.radioBuilds).toEqual([]);
    expect(aggregate.egressPaths).toEqual([]);
    expect(warnings).toEqual([expect.stringContaining('Ignoring 1 legacy format build')]);
  });

  it('rejects broken build selection FK on new-style radioBuilds', () => {
    expect(() =>
      parseProjectDocument(readFixture('broken-fk-radio-build.yaml')),
    ).toThrow(/not found in library/);
  });

  it('soft-warns out-of-range APRS report slot index instead of hard-failing', () => {
    const project = parseProjectDocument(readFixture('aprs-broken-slot.yaml'));
    expect(project.channels[0]?.aprs?.reportSlotIndex).toBe(2);
    expect(project.aprsConfiguration?.channelSlots).toHaveLength(1);
  });

  it('parses empty APRS slots with orphan reportSlotIndex (Drive conflict preview)', () => {
    const project = parseProjectDocument(readFixture('aprs-empty-slots-orphan.yaml'));
    expect(project.channels[0]?.aprs?.reportSlotIndex).toBe(1);
    expect(project.aprsConfiguration?.channelSlots).toHaveLength(0);
  });

  it('keeps schema v17 singleton aprsConfiguration (Current Channel slot)', () => {
    const project = parseProjectDocument(readFixture('aprs-schema17-singleton.yaml'));
    expect(project.aprsConfiguration?.channelSlots).toHaveLength(1);
    expect(project.aprsConfiguration?.channelSlots[0]?.channelRef).toBeNull();
    expect(project.channels[0]?.aprs?.reportSlotIndex).toBe(1);
  });
});

function parseYamlTree(text: string): unknown {
  return parseYaml(text);
}
