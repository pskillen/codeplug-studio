import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import { assemble } from '@core/services/assemble.ts';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import { compareCsvRecords } from '../../../../test/csvRecordCompare.ts';
import { serialiseChannels, serialiseZones } from './serialise.ts';
import { collectOpenGd77ExportWarnings } from './warnings.ts';

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../native-yaml/__fixtures__/export',
);

describe('OpenGD77 export serialise', () => {
  function loadAssembled() {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };
    return assemble(build, library);
  }

  it('serialises channel wire names from assemble projection', () => {
    const assembled = loadAssembled();
    const csv = serialiseChannels(assembled);
    expect(csv).toContain('GB3DA Demo');
    expect(csv).toContain('GB7GL Scot');
    expect(csv).toContain('Channel Name');
    expect(csv).toContain('Analogue');
    expect(csv).toContain('Digital');
  });

  it('serialises zone members using build wire names', () => {
    const assembled = loadAssembled();
    const csv = serialiseZones(assembled);
    expect(csv).toContain('Edinburgh');
    expect(csv).toContain('GB3DA Demo');
    expect(csv).toContain('GB7GL Scot');
  });

  it('exportBuildAll returns all six CPS files', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
    };

    const result = exportBuildAll({ build, library });
    expect(Object.keys(result.files)).toEqual([
      'Channels.csv',
      'Zones.csv',
      'Contacts.csv',
      'TG_Lists.csv',
      'DTMF.csv',
      'APRS.csv',
    ]);
    expect(result.files['Channels.csv']).toContain('GB3DA Demo');
    expect(result.files['Contacts.csv']).toContain('Scotland');
    expect(result.files['TG_Lists.csv']).toContain('Scotland TG');
  });

  it('export warnings surface long wire names', () => {
    const assembled = loadAssembled();
    const longName = 'ThisNameIsWayTooLong';
    assembled.channels[0] = {
      ...assembled.channels[0]!,
      wireName: longName,
      entity: { ...assembled.channels[0]!.entity, name: longName },
    };
    const warnings = collectOpenGd77ExportWarnings(assembled);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('channels CSV is self-consistent when re-exported from same projection', () => {
    const assembled = loadAssembled();
    const first = serialiseChannels(assembled);
    const second = serialiseChannels(assembled);
    const comparison = compareCsvRecords(first, second, { nameColumn: 'Channel Name' });
    expect(comparison.ok).toBe(true);
  });
});
