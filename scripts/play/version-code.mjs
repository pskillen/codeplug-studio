#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Deterministic Play `versionCode` from a release tag.
 *
 *   versionCode = major * 1_000_000 + minor * 10_000 + patch * 100 + prerelease
 *
 * `prerelease` is the RC ordinal (`-rc.4` → 4) or 99 for a final release so a
 * final always outranks every RC of the same version. Same tag → same code in
 * every workflow, on every re-run.
 *
 * Usage: node scripts/play/version-code.mjs 1.2.3-rc.4
 */
const FINAL_PRERELEASE = 99;
const MAX_MAJOR = 2100;
const MAX_MINOR = 99;
const MAX_PATCH = 99;
const MAX_RC = 98;

const TAG_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-rc\.(\d+))?$/;

/**
 * @typedef {{ major: number, minor: number, patch: number, rc: number | null, prerelease: number, versionName: string }} PlayVersion
 */

/**
 * @param {string} raw
 * @returns {PlayVersion}
 */
export function parsePlayVersion(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error('version tag is required');
  }
  const tag = raw.trim();
  const match = TAG_RE.exec(tag);
  if (!match) {
    throw new Error(
      `unrecognised version tag: ${tag} (expected 1.2.3 or 1.2.3-rc.N; optional v prefix)`,
    );
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  const rcToken = match[4];
  const rc = rcToken === undefined ? null : Number(rcToken);

  if (!Number.isInteger(major) || major < 0 || major > MAX_MAJOR) {
    throw new Error(`major ${major} is out of range (0–${MAX_MAJOR})`);
  }
  if (!Number.isInteger(minor) || minor < 0 || minor > MAX_MINOR) {
    throw new Error(`minor ${minor} is out of range (0–${MAX_MINOR})`);
  }
  if (!Number.isInteger(patch) || patch < 0 || patch > MAX_PATCH) {
    throw new Error(`patch ${patch} is out of range (0–${MAX_PATCH})`);
  }
  if (rc !== null && (!Number.isInteger(rc) || rc < 1 || rc > MAX_RC)) {
    throw new Error(
      `rc.${rcToken} is out of range (rc.1–rc.${MAX_RC}; rc.99 is the final release)`,
    );
  }

  const versionName = `${major}.${minor}.${patch}${rc === null ? '' : `-rc.${rc}`}`;
  return {
    major,
    minor,
    patch,
    rc,
    prerelease: rc === null ? FINAL_PRERELEASE : rc,
    versionName,
  };
}

/**
 * @param {string} tag
 * @returns {number}
 */
export function versionCodeFor(tag) {
  const parsed = parsePlayVersion(tag);
  return parsed.major * 1_000_000 + parsed.minor * 10_000 + parsed.patch * 100 + parsed.prerelease;
}

/**
 * @param {string} tag
 * @returns {boolean}
 */
export function isRcVersion(tag) {
  return parsePlayVersion(tag).rc !== null;
}

/**
 * Fixed track map: pre-release → Open testing (`beta`), final → Production.
 * @param {string} tag
 * @returns {'beta' | 'production'}
 */
export function playTrackFor(tag) {
  return isRcVersion(tag) ? 'beta' : 'production';
}

function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--track') {
    const tag = args[1];
    if (!tag) {
      console.error('Usage: node scripts/play/version-code.mjs --track <tag>');
      process.exit(1);
    }
    process.stdout.write(`${playTrackFor(tag)}\n`);
    return;
  }
  const tag = args[0];
  if (!tag) {
    console.error('Usage: node scripts/play/version-code.mjs <tag>');
    process.exit(1);
  }
  process.stdout.write(`${versionCodeFor(tag)}\n`);
}

const invokedDirectly =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
