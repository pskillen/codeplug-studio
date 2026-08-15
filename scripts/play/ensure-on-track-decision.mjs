import { isRcVersion } from './version-code.mjs';

export const PLAY_NOTES_MAX = 500;

/**
 * RC binaries are staging-flavoured and must never land on Production.
 * @param {string} versionTag
 * @param {string} track
 */
export function assertPlayTrackAllowed(versionTag, track) {
  if (track === 'production' && isRcVersion(versionTag)) {
    throw new Error(
      `Refusing to put RC ${versionTag} on Production — that binary is staging-flavoured (wrong API origin and feature gates). Cut a full release instead.`,
    );
  }
}

/**
 * @param {unknown} trackResource
 * @param {number} versionCode
 * @returns {boolean}
 */
export function trackHasCompletedCode(trackResource, versionCode) {
  if (!trackResource || typeof trackResource !== 'object') {
    return false;
  }
  const releases =
    'releases' in trackResource && Array.isArray(trackResource.releases)
      ? trackResource.releases
      : [];
  return releases.some(
    (release) =>
      release?.status === 'completed' &&
      (release.versionCodes ?? []).map(Number).includes(versionCode),
  );
}

/**
 * @param {string | undefined} body
 * @param {string} versionName
 * @returns {string}
 */
export function releaseNotesFor(body, versionName) {
  const trimmed = (body ?? '').trim();
  const text = trimmed === '' ? `Codeplug Studio ${versionName}. See the GitHub release.` : trimmed;
  if (text.length <= PLAY_NOTES_MAX) {
    return text;
  }
  return `${text.slice(0, PLAY_NOTES_MAX - 1)}…`;
}

/**
 * @param {object} input
 * @param {boolean} input.bundlePresent
 * @param {string} [input.aabPath]
 * @returns {'upload' | 'patch' | 'missing-bundle'}
 */
export function decideEnsureAction({ bundlePresent, aabPath }) {
  if (bundlePresent) {
    return 'patch';
  }
  if (aabPath) {
    return 'upload';
  }
  return 'missing-bundle';
}
