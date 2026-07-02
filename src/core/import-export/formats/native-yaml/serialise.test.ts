import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { serialiseProject } from './serialise.ts';
import {
  fullLibraryAggregate,
  minimalProjectAggregate,
  projectWithFormatBuildAggregate,
} from './testFixtures.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/export');

function readGolden(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8').trimEnd();
}

describe('native-yaml serialise', () => {
  it('serialises minimal project', () => {
    expect(serialiseProject(minimalProjectAggregate())).toBe(
      readGolden('minimal-project.yaml'),
    );
  });

  it('serialises full library with FK refs', () => {
    expect(serialiseProject(fullLibraryAggregate())).toBe(readGolden('full-library.yaml'));
  });

  it('serialises format build with trait layout and selections', () => {
    expect(serialiseProject(projectWithFormatBuildAggregate())).toBe(
      readGolden('with-format-build.yaml'),
    );
  });
});
