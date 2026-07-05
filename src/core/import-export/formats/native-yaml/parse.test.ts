import { parse as parseYaml } from 'yaml';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NativeYamlImportError } from './errors.ts';
import { parseProjectDocument } from './parse.ts';
import { fullLibraryAggregate, minimalProjectAggregate, nestedZonesAggregate } from './testFixtures.ts';
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
  });

  it('rejects corrupt YAML', () => {
    expect(() => parseProjectDocument(readFixture('corrupt.yaml'))).toThrow(NativeYamlImportError);
    expect(() => parseProjectDocument(readFixture('corrupt.yaml'))).toThrow(/Invalid YAML syntax/);
  });
});

describe('native-yaml validate', () => {
  it('rejects studioSchemaVersion mismatch', () => {
    expect(() => validateDocument(parseYamlTree(readFixture('version-mismatch.yaml')))).toThrow(
      /Unsupported studioSchemaVersion/,
    );
  });

  it('rejects broken build selection FK', () => {
    expect(() => parseProjectDocument(readFixture('broken-fk.yaml'))).toThrow(
      /not found in library/,
    );
  });
});

function parseYamlTree(text: string): unknown {
  return parseYaml(text);
}
