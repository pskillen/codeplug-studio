import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import { exportBuildSingleFile, exportBuildZip } from '@core/services/exportBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { verifyCodeplug } from '../src/verify.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = path.join(repoRoot, 'test-data/export-smoke/rich-project.yaml');

/** Profiles with a shipped cps-verify plugin — must exist on the fixture. */
const SMOKE_PROFILES = [
  { formatId: 'anytone', profileId: 'anytone-at-d890uv' },
  { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' },
  { formatId: 'opengd77', profileId: 'opengd77-1701' },
  { formatId: 'chirp', profileId: 'chirp-uv5r' },
] as const;

function libraryFromAggregate(aggregate: ProjectAggregate): LibrarySlice {
  return {
    channels: aggregate.channels,
    zones: aggregate.zones,
    talkGroups: aggregate.talkGroups,
    digitalContacts: aggregate.digitalContacts,
    analogContacts: aggregate.analogContacts,
    rxGroupLists: aggregate.rxGroupLists,
    scanLists: aggregate.scanLists,
    aprsConfiguration: aggregate.aprsConfiguration,
    channelDefaults: aggregate.channelDefaults,
    zoneDefaults: aggregate.zoneDefaults,
  };
}

function loadSmokeProject(): ProjectAggregate {
  return parseProjectDocument(readFileSync(fixturePath, 'utf8'));
}

describe('export-smoke: YAML → export → verify wire-valid', () => {
  it('fixture includes every smoke profile', () => {
    const project = loadSmokeProject();
    const profileIds = new Set(project.formatBuilds.map((b) => b.profileId));
    for (const { profileId } of SMOKE_PROFILES) {
      expect(profileIds.has(profileId), `missing formatBuild for ${profileId}`).toBe(true);
    }
  });

  it.each(SMOKE_PROFILES)(
    'exports $profileId and verifies wire-valid',
    async ({ formatId, profileId }) => {
      const project = loadSmokeProject();
      const build = project.formatBuilds.find((b) => b.profileId === profileId);
      expect(build, `formatBuild ${profileId}`).toBeDefined();
      const library = libraryFromAggregate(project);
      const options = {
        projectName: project.meta.name?.trim() || undefined,
      };

      const dir = mkdtempSync(path.join(tmpdir(), `cps-export-smoke-${profileId}-`));

      let verifyPath: string;
      if (formatId === 'chirp') {
        const result = exportBuildSingleFile({ build: build!, library, options });
        verifyPath = path.join(dir, result.fileName);
        writeFileSync(verifyPath, result.content, 'utf8');
      } else {
        const result = exportBuildZip({ build: build!, library, options });
        verifyPath = path.join(dir, `${profileId}.zip`);
        writeFileSync(verifyPath, result.zip);
      }

      const verified = await verifyCodeplug({
        format: formatId,
        profile: profileId,
        path: verifyPath,
      });
      expect(verified.diagnostics, JSON.stringify(verified.diagnostics, null, 2)).toEqual([]);
      expect(verified.ok).toBe(true);
    },
  );
});
