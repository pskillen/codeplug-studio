/**
 * Browser-local UI preferences (not project/library data). Stored in
 * `localStorage` so the app layer never touches the storage API directly,
 * keeping `localStorage` access on the integrations side of the boundary.
 */

const ACTIVE_PROJECT_KEY = 'codeplug-studio:activeProjectId';

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
