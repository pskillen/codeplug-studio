/**
 * Browser-local UI preferences (not project/library data). Stored in
 * `localStorage` so the app layer never touches the storage API directly,
 * keeping `localStorage` access on the integrations side of the boundary.
 */

const ACTIVE_PROJECT_KEY = 'codeplug-studio:activeProjectId';
const MAPBOX_TOKEN_KEY = 'codeplug-studio:mapboxToken';

export function loadActiveProjectId(): string | null {
  try {
    return globalThis.localStorage?.getItem(ACTIVE_PROJECT_KEY) ?? null;
  } catch {
    // localStorage may be unavailable (private mode, disabled). Fail soft.
    return null;
  }
}

export function saveActiveProjectId(projectId: string | null): void {
  try {
    if (projectId) {
      globalThis.localStorage?.setItem(ACTIVE_PROJECT_KEY, projectId);
    } else {
      globalThis.localStorage?.removeItem(ACTIVE_PROJECT_KEY);
    }
  } catch {
    // Ignore write failures (quota, disabled storage).
  }
}

export function loadMapboxToken(): string {
  try {
    return globalThis.localStorage?.getItem(MAPBOX_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveMapboxToken(token: string): void {
  try {
    const trimmed = token.trim();
    if (trimmed) {
      globalThis.localStorage?.setItem(MAPBOX_TOKEN_KEY, trimmed);
    } else {
      globalThis.localStorage?.removeItem(MAPBOX_TOKEN_KEY);
    }
  } catch {
    // Ignore write failures.
  }
}
