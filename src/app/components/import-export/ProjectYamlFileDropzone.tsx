import { useState } from 'react';
import { DesignSystemV2Provider, FileDropzone } from '../v2/index.ts';
import { readTextFile } from '../../lib/readTextFile.ts';

const YAML_ACCEPT =
  '.yaml,.yml,application/x-yaml,application/yaml,text/yaml,text/x-yaml,text/plain';

export interface ProjectYamlFileDropzoneProps {
  onFileText: (text: string, fileName: string) => void | Promise<void>;
  error?: string | null;
  disabled?: boolean;
}

/**
 * v2 FileDropzone wired for native YAML project import (P2 / C6).
 */
export default function ProjectYamlFileDropzone({
  onFileText,
  error,
  disabled = false,
}: ProjectYamlFileDropzoneProps) {
  const [fileName, setFileName] = useState<string | undefined>();
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFiles(files: File[]) {
    const file = files[0];
    if (!file || disabled) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.yaml') && !lower.endsWith('.yml')) {
      setLocalError('Choose a .yaml or .yml file');
      setFileName(undefined);
      return;
    }
    setLocalError(null);
    try {
      const text = await readTextFile(file);
      setFileName(file.name);
      await onFileText(text, file.name);
    } catch (err) {
      setFileName(undefined);
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  }

  const displayError = error ?? localError;

  return (
    <DesignSystemV2Provider>
      <FileDropzone
        label="Drop a native YAML file here, or click to browse"
        hint="Single .yaml / .yml native YAML project file"
        accept={YAML_ACCEPT}
        fileName={fileName}
        onClear={() => {
          setFileName(undefined);
          setLocalError(null);
        }}
        error={displayError ?? undefined}
        disabled={disabled}
        onFilesSelected={(files) => void handleFiles(files)}
      />
    </DesignSystemV2Provider>
  );
}
