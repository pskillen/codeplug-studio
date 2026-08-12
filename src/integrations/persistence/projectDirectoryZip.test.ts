import { describe, expect, it } from 'vitest';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { serialiseDirectoryInterchangeYaml } from './digitalIdDirectoryInterchange.ts';
import { buildProjectWithDirectoryZip, readZipTextEntries } from './projectDirectoryZip.ts';

describe('projectDirectoryZip', () => {
  it('contains exactly project YAML and directory file with expected names', () => {
    const projectYaml = 'schemaVersion: 1\nproject:\n  name: Demo\n';
    const entries: DigitalIdDirectoryEntry[] = [
      {
        projectId: 'p1',
        digitalId: 1,
        mode: 'dmr',
        callsign: 'M0',
        name: 'One',
        city: '',
        state: '',
        country: '',
      },
    ];
    const directoryYaml = serialiseDirectoryInterchangeYaml(entries);
    const { zipBytes, projectFileName, directoryFileName } = buildProjectWithDirectoryZip({
      projectName: 'Demo',
      projectYaml,
      directoryContent: directoryYaml,
      directoryFormat: 'yaml',
    });

    const files = readZipTextEntries(zipBytes);
    expect(Object.keys(files).sort()).toEqual([directoryFileName, projectFileName].sort());
    expect(files[projectFileName]).toBe(projectYaml);
    expect(files[directoryFileName]).toBe(directoryYaml);
  });
});
