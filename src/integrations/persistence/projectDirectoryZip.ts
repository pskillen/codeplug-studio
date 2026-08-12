import { zipSync, strToU8, unzipSync } from 'fflate';
import { defaultLocalExportFileName } from '@core/services/interchangeMeta.ts';
import type { DirectoryInterchangeFormat } from './digitalIdDirectoryInterchange.ts';
import { defaultDirectoryExportFileName } from './digitalIdDirectoryInterchange.ts';

export function buildProjectWithDirectoryZip(input: {
  projectName: string;
  projectYaml: string;
  directoryContent: string;
  directoryFormat: DirectoryInterchangeFormat;
}): {
  zipBytes: Uint8Array;
  zipFileName: string;
  projectFileName: string;
  directoryFileName: string;
} {
  const projectFileName = defaultLocalExportFileName(input.projectName);
  const directoryFileName = defaultDirectoryExportFileName(
    input.projectName,
    input.directoryFormat,
  );
  const zipBytes = zipSync({
    [projectFileName]: strToU8(input.projectYaml),
    [directoryFileName]: strToU8(input.directoryContent),
  });
  return {
    zipBytes,
    zipFileName: `${projectFileName.replace(/\.yaml$/i, '')}-with-directory.zip`,
    projectFileName,
    directoryFileName,
  };
}

/** Test helper — list UTF-8 text members from a zip archive. */
export function readZipTextEntries(zipBytes: Uint8Array): Record<string, string> {
  const entries = unzipSync(zipBytes);
  const out: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(entries)) {
    out[name] = new TextDecoder().decode(bytes);
  }
  return out;
}
