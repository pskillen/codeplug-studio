import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseCsv, stringifyCsv } from './csv.mjs';
import { convertAll, convertCountry, renderCountryModule } from './csv-to-dataset.mjs';
import { loadTemplateHeader } from './validate-dataset.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(__dirname, 'example.csv');
const HEADER = loadTemplateHeader();

function stagingDir(): { research: string; out: string } {
  const root = mkdtempSync(join(tmpdir(), 'public-services-convert-'));
  return { research: join(root, 'research'), out: join(root, 'out') };
}

describe('csv-to-dataset', () => {
  it('collapses dual-mode rows and omits unknown-encryption rows', () => {
    const { research, out } = stagingDir();
    const countryDir = join(research, 'zz');
    mkdirSync(countryDir, { recursive: true });

    const rows = parseCsv(readFileSync(EXAMPLE, 'utf8'));
    rows.push([
      'ZZ',
      '',
      '',
      'fire',
      'zz-northshire-fireground',
      'Northshire Fire & Rescue — fireground',
      'fg-secret',
      'NFRS SEC',
      'Encrypted',
      '449050000',
      '449050000',
      'dmr',
      'true',
      '',
      '',
      '',
      '',
      '',
      '',
      'unknown',
      'active',
      'low',
      'community',
      'https://example.org/wiki',
      'Wiki',
      '2020',
      '',
      '',
    ]);
    writeFileSync(join(countryDir, 'channels.csv'), stringifyCsv(rows), 'utf8');
    writeFileSync(
      join(countryDir, 'known-gaps.json'),
      JSON.stringify({
        countryLabel: 'Exampleland',
        datasetVersion: 'test-1',
        knownGaps: [
          {
            category: 'ambulance',
            summary: 'Encrypted national digital radio; nothing to monitor.',
            sourceUrl: 'https://example.org/gaps',
          },
        ],
      }),
    );

    const country = convertCountry('zz', research);
    expect(country.countryCode).toBe('ZZ');
    expect(country.countryLabel).toBe('Exampleland');
    expect(country.datasetVersion).toBe('test-1');
    expect(country.knownGaps).toHaveLength(1);
    expect(country.groups).toHaveLength(3);

    const fire = country.groups.find((group) => group.groupId === 'zz-northshire-fireground');
    expect(fire?.entries).toHaveLength(2);
    const fg1 = fire?.entries.find((entry) => entry.channelId === 'fg-1');
    expect(fg1?.modes).toHaveLength(2);
    expect(fg1?.modes.filter((mode) => mode.isPrimary)).toHaveLength(1);
    expect(fg1?.modes.find((mode) => mode.isPrimary)?.mode).toBe('dmr');
    expect(fg1?.modes.find((mode) => mode.mode === 'fm')?.bandwidthKHz).toBe(12.5);
    expect(fg1?.modes.find((mode) => mode.mode === 'fm')?.rxTone).toBe('77.0');
    expect(fire?.entries.some((entry) => entry.channelId === 'fg-secret')).toBe(false);

    const rescue = country.groups.find((group) => group.groupId === 'zz-mountain-rescue');
    expect(rescue?.entries[0]?.rxFrequencyHz).toBe(155_475_000);
    expect(rescue?.entries[0]?.txFrequencyHz).toBe(155_875_000);

    convertAll({ iso2: ['zz'], researchRoot: research, outDir: out });
    const moduleText = readFileSync(join(out, 'zz.ts'), 'utf8');
    expect(moduleText).toContain('Do not edit by hand');
    expect(moduleText).toContain('export default country');
    expect(renderCountryModule(country, 'zz')).toContain("import type { PublicServiceCountry }");
    const indexText = readFileSync(join(out, 'summaries.ts'), 'utf8');
    expect(indexText).toContain('PUBLIC_SERVICE_COUNTRY_SUMMARIES');
    expect(indexText).toContain('zz-northshire-fireground');
    expect(indexText).toContain('channelCount: 2');
    void HEADER;
  });
});
