/**
 * Google Play Android Publisher v3 REST client.
 * Auth: service-account JWT from GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (same secret as before).
 */
import { JWT } from 'google-auth-library';

export const DEFAULT_PACKAGE_NAME = 'net.mm9pdy.codeplugstudio';
const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD_API = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

/**
 * @returns {Promise<string>}
 */
export async function getAccessToken() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw || raw.trim() === '') {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set');
  }
  /** @type {{ client_email?: string, private_key?: string }} */
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  if (!json.client_email || !json.private_key) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is missing client_email or private_key');
  }
  const client = new JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: [SCOPE],
  });
  const token = await client.authorize();
  if (!token.access_token) {
    throw new Error('Play service account did not return an access token');
  }
  return token.access_token;
}

/**
 * @param {string} token
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<unknown>}
 */
export async function playRequest(token, url, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof Uint8Array) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(url, { ...init, headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Play API ${init.method ?? 'GET'} ${url} → ${response.status}: ${text}`);
  }
  if (text.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * @param {string} token
 * @param {string} packageName
 * @returns {Promise<string>}
 */
export async function insertEdit(token, packageName) {
  const body = await playRequest(token, `${API}/applications/${packageName}/edits`, {
    method: 'POST',
    body: '{}',
  });
  const id = body && typeof body === 'object' && 'id' in body ? String(body.id) : '';
  if (!id) {
    throw new Error('Play edits.insert did not return an edit id');
  }
  return id;
}

/**
 * @param {string} token
 * @param {string} packageName
 * @param {string} editId
 */
export async function deleteEdit(token, packageName, editId) {
  await playRequest(token, `${API}/applications/${packageName}/edits/${editId}`, {
    method: 'DELETE',
  });
}

/**
 * @param {string} token
 * @param {string} packageName
 * @param {string} editId
 */
export async function commitEdit(token, packageName, editId) {
  await playRequest(token, `${API}/applications/${packageName}/edits/${editId}:commit`, {
    method: 'POST',
  });
}

/**
 * @param {string} token
 * @param {string} packageName
 * @param {string} editId
 * @returns {Promise<Array<{ versionCode: number }>>}
 */
export async function listBundles(token, packageName, editId) {
  const body = await playRequest(
    token,
    `${API}/applications/${packageName}/edits/${editId}/bundles`,
  );
  const bundles =
    body && typeof body === 'object' && 'bundle' in body
      ? body.bundle
      : body && typeof body === 'object' && 'bundles' in body
        ? body.bundles
        : [];
  if (!Array.isArray(bundles)) {
    return [];
  }
  return bundles.map((item) => ({
    versionCode: Number(item?.versionCode),
  }));
}

/**
 * @param {string} token
 * @param {string} packageName
 * @param {string} editId
 * @returns {Promise<Array<{ track: string, releases: Array<{ name?: string, status?: string, versionCodes?: Array<string | number> }> }>>}
 */
export async function listTracks(token, packageName, editId) {
  const body = await playRequest(
    token,
    `${API}/applications/${packageName}/edits/${editId}/tracks`,
  );
  const tracks =
    body && typeof body === 'object' && 'tracks' in body && Array.isArray(body.tracks)
      ? body.tracks
      : [];
  return tracks.map((track) => ({
    track: String(track.track ?? ''),
    releases: Array.isArray(track.releases) ? track.releases : [],
  }));
}

/**
 * @param {string} token
 * @param {string} packageName
 * @param {string} editId
 * @param {string} track
 */
export async function getTrack(token, packageName, editId, track) {
  return playRequest(token, `${API}/applications/${packageName}/edits/${editId}/tracks/${track}`);
}

/**
 * @param {string} token
 * @param {string} packageName
 * @param {string} editId
 * @param {string} track
 * @param {unknown} resource
 */
export async function patchTrack(token, packageName, editId, track, resource) {
  return playRequest(token, `${API}/applications/${packageName}/edits/${editId}/tracks/${track}`, {
    method: 'PATCH',
    body: JSON.stringify(resource),
  });
}

/**
 * @param {string} token
 * @param {string} packageName
 * @param {string} editId
 * @param {Uint8Array} aabBytes
 */
export async function uploadBundle(token, packageName, editId, aabBytes) {
  return playRequest(
    token,
    `${UPLOAD_API}/applications/${packageName}/edits/${editId}/bundles?uploadType=media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: aabBytes,
    },
  );
}
