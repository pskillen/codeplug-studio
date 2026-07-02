import { Anchor, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { ListPage, PageSection, PageSectionGrid } from '../../components/ui/index.ts';
import ExportProjectYamlPanel from '../../components/import-export/ExportProjectYamlPanel.tsx';
import ExportToDrivePanel from '../../components/import-export/ExportToDrivePanel.tsx';
import ImportYamlIntoActivePanel from '../../components/import-export/ImportYamlIntoActivePanel.tsx';
import CpsFormatCatalogGrid from '../../components/import-export/CpsFormatCatalogGrid.tsx';
import { useFormatParam } from '../../hooks/useFormatParam.ts';
import { useProjects } from '../../state/useProjects.ts';

export default function ImportExportPage() {
  const { activeProjectId } = useProjects();
  const { formatId } = useFormatParam();

  return (
    <ListPage
      title="Import / export"
      description="Your library is vendor-neutral inside the project. Use native YAML for full project backup, or pick a CPS format below for radio-specific interchange (import/export adapters ship in later Phase 4 slices)."
    >
      <Stack gap="lg">
        <PageSection
          title="Native YAML"
          description="Lossless project interchange — library, builds, and metadata."
        >
          <PageSectionGrid>
            <PageSection title="Import (replace active project)">
              <ImportYamlIntoActivePanel />
            </PageSection>
            <PageSection title="Export">
              <Stack gap="md">
                <ExportProjectYamlPanel key={activeProjectId ?? 'none'} />
                <ExportToDrivePanel key={`${activeProjectId ?? 'none'}-drive`} />
              </Stack>
            </PageSection>
          </PageSectionGrid>
        </PageSection>

        <PageSection
          title="CPS formats"
          description="Vendor CSV/YAML families — OpenGD77, CHIRP, DM32, qDMR. Import and export adapters are planned; cards show current registry status."
        >
          <CpsFormatCatalogGrid highlightedFormatId={formatId} />
        </PageSection>

        <PageSection
          title="Export to CPS"
          description="Per-build CPS export lives on each radio build."
        >
          <Text size="sm">
            Open a build under{' '}
            <Anchor component={Link} to="/builds">
              Radio builds
            </Anchor>{' '}
            to export when the format adapter ships. Import for CPS formats remains in the catalog
            above.
          </Text>
        </PageSection>
      </Stack>
    </ListPage>
  );
}
