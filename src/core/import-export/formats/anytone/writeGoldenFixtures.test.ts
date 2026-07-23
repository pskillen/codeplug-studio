import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import {
  anytoneExportEgress,
  minimalAnytoneExportBuild,
  minimalAnytoneExportLibrary,
} from './exportGoldenFixtures.ts';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/export');

/** Run manually to refresh golden fixtures: npm run test -- writeGoldenFixtures */
describe.skip('writeGoldenFixtures', () => {
  it('writes export golden CSV files', () => {
    const library = minimalAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const result = exportBuildAll({ build, egress: anytoneExportEgress(), library });
    mkdirSync(fixtureDir, { recursive: true });
    for (const name of ['Channel.CSV', 'DMRZone.CSV', 'ScanList.CSV', 'APRS.CSV']) {
      writeFileSync(join(fixtureDir, name), result.files[name] ?? '', 'utf8');
    }
  });
});
