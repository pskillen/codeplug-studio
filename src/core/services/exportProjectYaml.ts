import { getExportAdapter } from '@core/import-export/registry.ts';
import type { ExportDestinationKind } from '@core/models/interchange.ts';
import {
  defaultLocalExportFileName,
  recordExportDestination,
  suggestExportDestination,
} from './interchangeMeta.ts';
import type { ProjectInterchangePort } from './projectInterchangePort.ts';
import { seedToAggregate } from './projectSeedMapping.ts';

export interface ExportProjectYamlOptions {
  fileName?: string;
  recordDestination?: ExportDestinationKind;
}

export interface ExportProjectYamlResult {
  content: string;
  fileName: string;
  projectId: string;
  warnings: string[];
}

export async function exportProjectYaml(
  port: ProjectInterchangePort,
  projectId: string,
  options: ExportProjectYamlOptions = {},
): Promise<ExportProjectYamlResult> {
  const seed = await port.loadProjectSeed(projectId);
  if (!seed) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const suggested = options.recordDestination
    ? suggestExportDestination(seed.meta, options.recordDestination)
    : null;
  const fileName =
    options.fileName ??
    suggested?.fileName ??
    defaultLocalExportFileName(seed.meta.name);

  let metaForExport = seed.meta;
  if (options.recordDestination === 'localFile') {
    metaForExport = recordExportDestination(seed.meta, 'localFile', { fileName });
  }

  const aggregate = seedToAggregate({ ...seed, meta: metaForExport });
  const adapter = getExportAdapter('native-yaml');
  const { content, warnings } = adapter.serialise(aggregate);

  if (options.recordDestination === 'localFile') {
    const result = await port.putProjectMeta(metaForExport, seed.meta.revision);
    if (!result.ok) {
      throw new Error(`Failed to record export destination: ${result.reason}`);
    }
  }

  return { content, fileName, projectId, warnings };
}
