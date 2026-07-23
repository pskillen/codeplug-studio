import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { serialiseProject } from './serialise.ts';
import {
  fullLibraryAggregate,
  minimalProjectAggregate,
  projectWithRadioBuildAggregate,
} from './testFixtures.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/export');

function readGolden(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8').trimEnd().replace(/\r\n/g, '\n');
}

function normaliseYamlEol(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

describe('native-yaml serialise', () => {
  it('serialises minimal project', () => {
    expect(normaliseYamlEol(serialiseProject(minimalProjectAggregate()))).toBe(
      readGolden('minimal-project.yaml'),
    );
  });

  it('serialises full library with FK refs', () => {
    expect(normaliseYamlEol(serialiseProject(fullLibraryAggregate()))).toBe(
      readGolden('full-library.yaml'),
    );
  });

  it('serialises radio build with trait layout, selections, and egress path', () => {
    expect(normaliseYamlEol(serialiseProject(projectWithRadioBuildAggregate()))).toBe(
      readGolden('with-radio-build.yaml'),
    );
  });
});
