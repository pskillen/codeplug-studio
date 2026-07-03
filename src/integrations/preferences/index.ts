/**
 * Browser-local UI preferences (not project/library data). Stored in
 * `localStorage` so the app layer never touches the storage API directly,
 * keeping `localStorage` access on the integrations side of the boundary.
 */

import type { MaidenheadGridMode } from '@core/domain/maidenheadGrid.ts';

export const ACTIVE_PROJECT_KEY = 'codeplug-studio:activeProjectId';
export const MAPBOX_TOKEN_KEY = 'codeplug-studio:mapboxToken';
export const MAIDENHEAD_GRID_KEY = 'codeplug-studio:maidenheadGrid';
export const PREFERENCES_STORAGE_PREFIX = 'codeplug-studio:';

const MAIDENHEAD_GRID_MODES = new Set<MaidenheadGridMode>(['off', '4', '6', '8']);

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

export function loadMaidenheadGridMode(): MaidenheadGridMode {
  try {
    const raw = globalThis.localStorage?.getItem(MAIDENHEAD_GRID_KEY);
    if (raw && MAIDENHEAD_GRID_MODES.has(raw as MaidenheadGridMode)) {
      return raw as MaidenheadGridMode;
    }
  } catch {
    // localStorage may be unavailable.
  }
  return 'off';
}

export function saveMaidenheadGridMode(mode: MaidenheadGridMode): void {
  try {
    if (mode === 'off') {
      globalThis.localStorage?.removeItem(MAIDENHEAD_GRID_KEY);
    } else {
      globalThis.localStorage?.setItem(MAIDENHEAD_GRID_KEY, mode);
    }
  } catch {
    // Ignore write failures.
  }
}
