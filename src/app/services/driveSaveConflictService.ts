import type { GoogleDriveInterchange } from '@core/models/interchange.ts';
import {
  buildDriveSaveConflict,
  evaluateDriveSaveConflictKinds,
  type DriveSaveAssessment,
} from '@core/services/driveSaveConflict.ts';
import type { GoogleDrivePort } from '@integrations/cloud/index.ts';
import { buildImportOverwriteDiff, parseYamlImportPreview } from './yamlImportResolverService.ts';

export interface AssessDriveSaveConflictInput {
  port: GoogleDrivePort;
  localProjectId: string;
  localSyncedAt: string | null | undefined;
  drive: Pick<GoogleDriveInterchange, 'fileId'>;
}

export async function assessDriveSaveConflict(
  input: AssessDriveSaveConflictInput,
): Promise<DriveSaveAssessment> {
  const { port, localProjectId, localSyncedAt, drive } = input;
  const metadata = await port.getFileMetadata(drive.fileId);
  const remoteYaml = await port.readFile(drive.fileId);
  const preview = parseYamlImportPreview(remoteYaml);
  const remoteModifiedAt = metadata.modifiedTime ?? preview.remoteSummary.portableSyncedAt ?? '';
  const kinds = evaluateDriveSaveConflictKinds({
    localProjectId,
    localSyncedAt,
    remoteProjectId: preview.projectId,
    remoteModifiedAt,
  });
  const diffLines = await buildImportOverwriteDiff(localProjectId, {
    ...preview.remoteSummary,
    lastModifiedAt: remoteModifiedAt || preview.remoteSummary.portableSyncedAt,
  });
  const conflict = buildDriveSaveConflict(kinds, {
    localProjectId,
    remoteProjectId: preview.projectId,
    remoteModifiedAt,
    localSyncedAt: localSyncedAt ?? null,
    diffLines,
    remoteYaml,
  });
  return { conflict };
}
