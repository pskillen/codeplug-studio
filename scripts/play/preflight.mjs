#!/usr/bin/env node
/**
 * Query Play for the intended versionCode and write GITHUB_OUTPUT.
 *
 * Env:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
 *   BUILD_VERSION (release tag)
 *   PLAY_PACKAGE_NAME (optional)
 *   GITHUB_OUTPUT (Actions; optional — prints key=value when unset)
 */
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  DEFAULT_PACKAGE_NAME,
  deleteEdit,
  getAccessToken,
  insertEdit,
  listBundles,
  listTracks,
} from './client.mjs';
import { decidePreflight, flattenReleases } from './preflight-decision.mjs';
import { parsePlayVersion, versionCodeFor } from './version-code.mjs';

/**
 * @param {string} name
 * @param {string | number} value
 */
function writeOutput(name, value) {
  const line = `${name}=${value}\n`;
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, line);
  } else {
    process.stdout.write(line);
  }
}

export async function runPreflight() {
  const rawVersion = process.env.BUILD_VERSION;
  if (!rawVersion || rawVersion.trim() === '') {
    throw new Error('BUILD_VERSION is required for Play preflight');
  }
  const parsed = parsePlayVersion(rawVersion);
  const versionCode = versionCodeFor(rawVersion);
  const versionName = parsed.versionName;
  const packageName = process.env.PLAY_PACKAGE_NAME?.trim() || DEFAULT_PACKAGE_NAME;

  const token = await getAccessToken();
  const editId = await insertEdit(token, packageName);
  try {
    const [bundles, tracks] = await Promise.all([
      listBundles(token, packageName, editId),
      listTracks(token, packageName, editId),
    ]);
    const decision = decidePreflight({
      bundles,
      releases: flattenReleases(tracks),
      versionCode,
      versionName,
    });
    if (decision.action === 'fail') {
      throw new Error(decision.message ?? 'Play preflight refused this versionCode');
    }
    writeOutput('action', decision.action);
    writeOutput('version_code', versionCode);
    writeOutput('version_name', versionName);
    return decision;
  } finally {
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

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  runPreflight().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
