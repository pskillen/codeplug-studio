import { portableSyncedAt } from '@core/services/interchangeMeta.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import type { StatusDotTone } from '../components/v2/StatusDot.tsx';

export interface ProjectChipStatus {
  tone: StatusDotTone;
  /** Secondary label after the project name; omitted when saved & synced (quiet). */
  label: string | null;
}

export interface UseProjectChipStatusOptions {
  project: ProjectMeta | null | undefined;
  hasActiveProject: boolean;
  dirty: boolean;
  saving: boolean;
  driveUpdateAvailable: boolean;
  driveSessionExpired: boolean;
  driveLinked: boolean;
}

/**
 * Derives mk2 S2 chip tone + label from project save/sync state.
 * Warning tone for Drive drift and disconnected — never destructive red.
 */
export function useProjectChipStatus({
  project,
  hasActiveProject,
  dirty,
  saving,
  driveUpdateAvailable,
  driveSessionExpired,
  driveLinked,
}: UseProjectChipStatusOptions): ProjectChipStatus {
  if (!hasActiveProject || !project) {
    return { tone: 'neutral', label: null };
  }

  if (saving) {
    return { tone: 'accent', label: 'Saving…' };
  }

  if (driveUpdateAvailable) {
    return { tone: 'warning', label: 'Google Drive update' };
  }

  if (driveLinked && driveSessionExpired) {
    return { tone: 'warning', label: 'Google Drive disconnected' };
  }

  if (dirty || !portableSyncedAt(project)) {
    return { tone: 'neutral', label: 'Unsaved changes' };
  }

  return { tone: 'success', label: null };
}
