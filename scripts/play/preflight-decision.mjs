/**
 * Decide whether CI should upload a new AAB, only patch the track, or refuse.
 *
 * @param {{
 *   bundles: Array<{ versionCode: number }>,
 *   releases: Array<{ name?: string, versionCodes?: Array<string | number> }>,
 *   versionCode: number,
 *   versionName: string,
 * }} input
 * @returns {{ action: 'upload' | 'reconcile' | 'fail', message?: string }}
 */
export function decidePreflight({ bundles, releases, versionCode, versionName }) {
  const present = bundles.some((bundle) => Number(bundle.versionCode) === versionCode);
  if (!present) {
    return { action: 'upload' };
  }

  const owners = releases.filter((release) =>
    (release.versionCodes ?? []).map(Number).includes(versionCode),
  );
  const intended = normaliseVersionName(versionName);
  const mismatch = owners.find((release) => {
    if (!release.name) {
      return false;
    }
    return normaliseVersionName(release.name) !== intended;
  });
  if (mismatch) {
    return {
      action: 'fail',
      message: `versionCode ${versionCode} on Play belongs to ${mismatch.name}, not ${versionName} — the numbering scheme has drifted; do not build.`,
    };
  }
  return { action: 'reconcile' };
}

/**
 * @param {string} value
 * @returns {string}
 */
export function normaliseVersionName(value) {
  return value.trim().replace(/^v/, '');
}

/**
 * Flatten track releases for the preflight decision.
 * @param {Array<{ releases?: Array<{ name?: string, versionCodes?: Array<string | number> }> }>} tracks
 */
export function flattenReleases(tracks) {
  return tracks.flatMap((track) => track.releases ?? []);
}
