import { isRemotePortableNewer, type ProjectSyncDiff } from './projectSyncSummary.ts';

export type DriveSaveConflictKind = 'remoteNewer' | 'projectIdMismatch';

export interface DriveSaveConflict {
  kinds: DriveSaveConflictKind[];
  localProjectId: string;
  remoteProjectId: string;
  remoteModifiedAt: string;
  localSyncedAt: string | null;
  diff: ProjectSyncDiff;
  remoteYaml: string;
}

export interface DriveSaveAssessment {
  conflict: DriveSaveConflict | null;
}

export interface EvaluateDriveSaveConflictInput {
  localProjectId: string;
  localSyncedAt: string | null | undefined;
  remoteProjectId: string;
  remoteModifiedAt: string | null | undefined;
}

/** Returns conflict kinds when a linked Drive overwrite should be confirmed first. */
export function evaluateDriveSaveConflictKinds(
  input: EvaluateDriveSaveConflictInput,
): DriveSaveConflictKind[] {
  const kinds: DriveSaveConflictKind[] = [];
  if (isRemotePortableNewer(input.remoteModifiedAt, input.localSyncedAt)) {
    kinds.push('remoteNewer');
  }
  if (input.remoteProjectId !== input.localProjectId) {
    kinds.push('projectIdMismatch');
  }
  return kinds;
}

export function buildDriveSaveConflict(
  kinds: DriveSaveConflictKind[],
  details: Omit<DriveSaveConflict, 'kinds'>,
): DriveSaveConflict | null {
  if (kinds.length === 0) {
    return null;
  }
  return { kinds, ...details };
}
