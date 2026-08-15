#!/usr/bin/env node
/**
 * Ensure version V / code C is on track T: upload the AAB only if Play does
 * not already hold the code, then patch the track and commit.
 *
 * Env:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
 *   BUILD_VERSION          release tag
 *   PLAY_TRACK             beta | production
 *   AAB_PATH               optional; required when the code is not on Play
 *   RELEASE_NOTES          optional GitHub release body
 *   PLAY_PACKAGE_NAME      optional
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  DEFAULT_PACKAGE_NAME,
  commitEdit,
  deleteEdit,
  getAccessToken,
  getTrack,
  insertEdit,
  listBundles,
  patchTrack,
  uploadBundle,
} from './client.mjs';
import {
  assertPlayTrackAllowed,
  decideEnsureAction,
  releaseNotesFor,
  trackHasCompletedCode,
} from './ensure-on-track-decision.mjs';
import { parsePlayVersion, versionCodeFor } from './version-code.mjs';

export async function runEnsureOnTrack() {
  const rawVersion = process.env.BUILD_VERSION;
  const track = process.env.PLAY_TRACK?.trim();
  if (!rawVersion || rawVersion.trim() === '') {
    throw new Error('BUILD_VERSION is required');
  }
  if (!track) {
    throw new Error('PLAY_TRACK is required');
  }

  assertPlayTrackAllowed(rawVersion, track);

  const parsed = parsePlayVersion(rawVersion);
  const versionCode = versionCodeFor(rawVersion);
  const versionName = parsed.versionName;
  const packageName = process.env.PLAY_PACKAGE_NAME?.trim() || DEFAULT_PACKAGE_NAME;
  const aabPath = process.env.AAB_PATH?.trim() || '';
  const notes = releaseNotesFor(process.env.RELEASE_NOTES, versionName);

  const token = await getAccessToken();
  const editId = await insertEdit(token, packageName);
  let committed = false;
  try {
    const bundles = await listBundles(token, packageName, editId);
    const bundlePresent = bundles.some((bundle) => bundle.versionCode === versionCode);
    const action = decideEnsureAction({ bundlePresent, aabPath: aabPath || undefined });
    if (action === 'missing-bundle') {
      throw new Error(
        `versionCode ${versionCode} (${versionName}) is not on Play. Publish a GitHub ${
          track === 'production' ? 'full release' : 'pre-release'
        } so CI can upload the AAB; this reconcile workflow does not build.`,
      );
    }

    if (action === 'upload') {
      const aabBytes = await readFile(aabPath);
      console.log(`Uploading ${aabPath} as versionCode ${versionCode} (${versionName})`);
      await uploadBundle(token, packageName, editId, aabBytes);
    }

    const existing = await getTrack(token, packageName, editId, track);
    if (action === 'patch' && trackHasCompletedCode(existing, versionCode)) {
      console.log(`versionCode ${versionCode} already completed on ${track}; skipping track patch`);
      return { skipped: true, versionCode, versionName, track };
    }

    await patchTrack(token, packageName, editId, track, {
      track,
      releases: [
        {
          name: versionName,
          status: 'completed',
          versionCodes: [String(versionCode)],
          releaseNotes: [{ language: 'en-US', text: notes }],
        },
      ],
    });
    await commitEdit(token, packageName, editId);
    committed = true;
    console.log(`Ensured ${versionName} (versionCode ${versionCode}) on ${track}`);
    return { skipped: false, versionCode, versionName, track };
  } finally {
    if (!committed) {
      try {
        await deleteEdit(token, packageName, editId);
      } catch (error) {
        console.error(
          `warning: failed to delete unused Play edit ${editId}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
}

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  runEnsureOnTrack().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
