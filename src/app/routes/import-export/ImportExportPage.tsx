import { Stack } from '@mantine/core';
import { ListPage, PageSection, PageSectionGrid } from '../../components/ui/index.ts';
import ExportProjectYamlPanel from '../../components/import-export/ExportProjectYamlPanel.tsx';
import ExportToDrivePanel from '../../components/import-export/ExportToDrivePanel.tsx';
import ImportYamlIntoActivePanel from '../../components/import-export/ImportYamlIntoActivePanel.tsx';
import { useProjects } from '../../state/useProjects.ts';

export default function ImportExportPage() {
  const { activeProjectId } = useProjects();
  return (
    <ListPage
      title="Import / export"
      description="Export the active project to native YAML or replace it from a backup file."
    >
      <PageSectionGrid>
        <PageSection title="Import YAML (replace active project)">
          <ImportYamlIntoActivePanel />
        </PageSection>
        <PageSection title="Export YAML">
          <Stack gap="md">
            <ExportProjectYamlPanel key={activeProjectId ?? 'none'} />
            <ExportToDrivePanel key={`${activeProjectId ?? 'none'}-drive`} />
          </Stack>
        </PageSection>
      </PageSectionGrid>
    </ListPage>
  );
}
