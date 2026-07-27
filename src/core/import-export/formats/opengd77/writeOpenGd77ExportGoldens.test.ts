import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { serialiseOpenGd77Files } from './serialise.ts';
import {
  assembleOpenGd77YamlGolden,
  loadOpenGd77YamlGoldenFixture,
} from './exportGoldenFixtures.ts';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/export');

/** Run once to refresh committed goldens: `npm run test -- writeOpenGd77ExportGoldens` */
describe('writeOpenGd77ExportGoldens', () => {
  it('writes golden CSV files from yaml fixture export', () => {
    const { build, library } = loadOpenGd77YamlGoldenFixture();
    const assembled = assembleOpenGd77YamlGolden(library, build);
    const files = serialiseOpenGd77Files(assembled, { profileId: 'opengd77-1701' });
    mkdirSync(fixtureDir, { recursive: true });
    for (const fileName of ['Channels.csv', 'Zones.csv', 'Contacts.csv', 'TG_Lists.csv'] as const) {
      writeFileSync(join(fixtureDir, fileName), files[fileName], 'utf8');
    }
  });
});
