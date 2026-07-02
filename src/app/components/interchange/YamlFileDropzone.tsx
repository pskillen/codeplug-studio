import { useRef, useState, type DragEvent } from 'react';
import { Alert, Box, Text } from '@mantine/core';
import { readTextFile } from '../../lib/readTextFile.ts';

export interface YamlFileDropzoneProps {
  onFileText: (text: string, fileName: string) => void | Promise<void>;
  error?: string | null;
  disabled?: boolean;
}

const ACCEPT = '.yaml,.yml';

export default function YamlFileDropzone({
  onFileText,
  error,
  disabled = false,
}: YamlFileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.yaml') && !lower.endsWith('.yml')) {
      setLocalError('Choose a .yaml or .yml file');
      return;
    }
    setLocalError(null);
    try {
      const text = await readTextFile(file);
      await onFileText(text, file.name);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  const displayError = error ?? localError;

  return (
    <Box>
      <Box
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        p="lg"
        style={{
          border: `2px dashed var(--mantine-color-${dragOver ? 'blue-6' : 'dark-4'})`,
          borderRadius: 'var(--mantine-radius-md)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          textAlign: 'center',
        }}
      >
        <Text size="sm">Drop a native YAML file here, or click to browse</Text>
        <Text size="xs" c="dimmed" mt="xs">
          Single `.yaml` / `.yml` project interchange
        </Text>
      </Box>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        disabled={disabled}
        onChange={(event) => {
          void handleFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      {displayError ? (
        <Alert color="red" mt="sm">
          {displayError}
        </Alert>
      ) : null}
    </Box>
  );
}
