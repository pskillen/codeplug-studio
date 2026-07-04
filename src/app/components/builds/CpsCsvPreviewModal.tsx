import { Alert, Modal, Stack, Text } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { useBuildCpsExportPreview } from '../../hooks/useBuildCpsExportPreview.ts';
import CpsCsvPreview from './CpsCsvPreview.tsx';

export interface CpsCsvPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  build: FormatBuild;
  exportOptions: CpsExportOptions;
}

export default function CpsCsvPreviewModal({
  opened,
  onClose,
  build,
  exportOptions,
}: CpsCsvPreviewModalProps) {
  const { fileNames, tablesByFile, warnings, loading, error } = useBuildCpsExportPreview({
    build,
    exportOptions,
    enabled: opened,
  });

  return (
    <Modal opened={opened} onClose={onClose} title="CSV preview" size="90%" centered>
      <Stack gap="md">
        {warnings.length > 0 ? (
          <Alert color="yellow" title="Export warnings">
            <Stack gap={4}>
              {warnings.map((warning) => (
                <Text key={warning} size="sm">
                  {warning}
                </Text>
              ))}
            </Stack>
          </Alert>
        ) : null}
        <CpsCsvPreview
          fileNames={fileNames}
          tablesByFile={tablesByFile}
          loading={loading}
          error={error}
        />
      </Stack>
    </Modal>
  );
}
