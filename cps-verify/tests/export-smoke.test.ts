import { unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import { exportBuildSingleFile, exportBuildZip } from '@core/services/exportBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { getVerifier } from '../src/formats/registry.ts';
import type { BundleFile, CheckOutcome } from '../src/types.ts';
import { itEachCheckOutcome } from './assertCheckOutcomes.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = path.join(repoRoot, 'test-data/export-smoke/rich-project.yaml');

/** Profiles with a shipped cps-verify plugin — must exist on the fixture. */
const SMOKE_PROFILES = [
  { formatId: 'anytone', profileId: 'anytone-at-d890uv' },
  { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' },
  { formatId: 'opengd77', profileId: 'opengd77-1701' },
  { formatId: 'chirp', profileId: 'chirp-uv5r' },
  { formatId: 'chirp', profileId: 'chirp-uv21' },
  { formatId: 'chirp', profileId: 'chirp-rt95' },
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

function zipToBundleFiles(zip: Uint8Array): BundleFile[] {
  const unzipped = unzipSync(zip);
  const files: BundleFile[] = [];
  for (const [entryPath, data] of Object.entries(unzipped)) {
    if (entryPath.endsWith('/')) continue;
    const name = path.posix.basename(entryPath);
    files.push({
      path: entryPath.replace(/\\/g, '/'),
      name,
      text: new TextDecoder('utf8').decode(data),
    });
  }
  return files;
}

function exportSmokeOutcomes(formatId: string, profileId: string): CheckOutcome[] {
  const project = loadSmokeProject();
  const build = project.formatBuilds.find((b) => b.profileId === profileId);
  if (!build) {
    throw new Error(`Missing formatBuild for ${profileId}`);
  }
  const library = libraryFromAggregate(project);
  const options = { projectName: project.meta.name?.trim() || undefined };
  const verifier = getVerifier(formatId);
  if (!verifier) {
    throw new Error(`No verifier for ${formatId}`);
  }

  if (formatId === 'chirp') {
    const result = exportBuildSingleFile({ build, library, options });
    const files: BundleFile[] = [
      { path: result.fileName, name: result.fileName, text: result.content },
    ];
    return verifier.verifyDetailed(files, profileId);
  }

  const result = exportBuildZip({ build, library, options });
  return verifier.verifyDetailed(zipToBundleFiles(result.zip), profileId);
}

describe('export-smoke: YAML → export → verify wire-valid', () => {
  it('fixture includes every smoke profile', () => {
    const project = loadSmokeProject();
    const profileIds = new Set(project.formatBuilds.map((b) => b.profileId));
    for (const { profileId } of SMOKE_PROFILES) {
      expect(profileIds.has(profileId), `missing formatBuild for ${profileId}`).toBe(true);
    }
  });

  for (const { formatId, profileId } of SMOKE_PROFILES) {
    describe(profileId, () => {
      itEachCheckOutcome(exportSmokeOutcomes(formatId, profileId));
    });
  }
});
