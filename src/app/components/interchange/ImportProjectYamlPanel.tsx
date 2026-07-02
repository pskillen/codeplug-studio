import { useState } from 'react';
import { Alert, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { importProjectFromYaml } from '../../services/projectInterchangeService.ts';
import { useProjects } from '../../state/useProjects.ts';
import YamlFileDropzone from './YamlFileDropzone.tsx';

export default function ImportProjectYamlPanel() {
  const { refreshProjects, switchProject } = useProjects();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleFile(text: string) {
    setImporting(true);
    setError(null);
    try {
      const result = await importProjectFromYaml(text, { kind: 'createNew' });
      await refreshProjects();
      switchProject(result.projectId);
      navigate('/summary');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  return (
    <Stack gap="sm">
      <YamlFileDropzone onFileText={handleFile} disabled={importing} error={error} />
    </Stack>
  );
}
