import { Modal, Stack } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { useBuildCpsExportPreview } from '../../hooks/useBuildCpsExportPreview.ts';
import CpsCsvPreview from './CpsCsvPreview.tsx';
import ExportWarningsAlert from './ExportWarningsAlert.tsx';

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
  const { fileNames, tablesByFile, textByFile, warnings, loading, error } = useBuildCpsExportPreview({
    build,
    exportOptions,
    enabled: opened,
  });

  return (
    <Modal opened={opened} onClose={onClose} title="CSV preview" size="90%" centered>
      <Stack gap="md">
        <ExportWarningsAlert warnings={warnings} />
        <CpsCsvPreview
          fileNames={fileNames}
          tablesByFile={tablesByFile}
          textByFile={textByFile}
          loading={loading}
          error={error}
        />
      </Stack>
    </Modal>
  );
}
