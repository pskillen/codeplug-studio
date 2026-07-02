import { parse as parseYaml } from 'yaml';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { NativeYamlImportError } from './errors.ts';
import { parseProjectDocument } from './parse.ts';
import { fullLibraryAggregate, minimalProjectAggregate } from './testFixtures.ts';
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
