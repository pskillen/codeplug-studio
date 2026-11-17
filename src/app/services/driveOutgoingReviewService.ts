import type { GoogleDriveInterchange } from '@core/models/interchange.ts';
import {
  evaluateDriveSaveConflictKinds,
  type DriveSaveConflictKind,
} from '@core/services/driveSaveConflict.ts';
import {
  buildProjectOutgoingReview,
  type ProjectOutgoingReview,
} from '@core/services/projectSyncSummary.ts';
import type { GoogleDrivePort } from '@integrations/cloud/index.ts';
import { buildImportOverwriteDiff, parseYamlImportPreview } from './yamlImportResolverService.ts';

export interface DriveOutgoingReview extends ProjectOutgoingReview {
  /** Remote file's last-modified time, when Drive reports one. */
  remoteModifiedAt: string | null;
  /** Reasons a plain **Save** would stop to ask first (Drive newer than last sync, other project). */
  conflictKinds: DriveSaveConflictKind[];
}

export interface BuildDriveOutgoingReviewInput {
  port: GoogleDrivePort;
  localProjectId: string;
  localSyncedAt: string | null | undefined;
  drive: Pick<GoogleDriveInterchange, 'fileId'>;
}

/**
 * Read the linked Drive file and describe what saving this browser's copy over it would change.
 * Read-only: writes nothing to Drive or the local project.
 */
export async function buildDriveOutgoingReview({
  port,
  localProjectId,
  localSyncedAt,
  drive,
}: BuildDriveOutgoingReviewInput): Promise<DriveOutgoingReview> {
  const metadata = await port.getFileMetadata(drive.fileId);
  const remoteYaml = await port.readFile(drive.fileId);
  const preview = parseYamlImportPreview(remoteYaml);
  const remoteModifiedAt = metadata.modifiedTime ?? preview.remoteSummary.portableSyncedAt ?? null;
  const diff = await buildImportOverwriteDiff(
    localProjectId,
    { ...preview.remoteSummary, lastModifiedAt: remoteModifiedAt },
    preview.remoteEntities,
  );
  return {
    ...buildProjectOutgoingReview(diff),
    remoteModifiedAt,
    conflictKinds: evaluateDriveSaveConflictKinds({
      localProjectId,
      localSyncedAt,
      remoteProjectId: preview.projectId,
      remoteModifiedAt,
    }),
  };
}
