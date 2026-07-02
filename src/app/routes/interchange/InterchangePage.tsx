import { ListPage, PageSection, PageSectionGrid } from '../../components/ui/index.ts';
import ExportProjectYamlPanel from '../../components/interchange/ExportProjectYamlPanel.tsx';
import ImportYamlIntoActivePanel from '../../components/interchange/ImportYamlIntoActivePanel.tsx';

export default function InterchangePage() {
  return (
    <ListPage
      title="Interchange"
      description="Export the active project to native YAML or replace it from a backup file."
    >
      <PageSectionGrid>
        <PageSection title="Import YAML (replace active project)">
          <ImportYamlIntoActivePanel />
        </PageSection>
        <PageSection title="Export YAML">
          <ExportProjectYamlPanel />
        </PageSection>
      </PageSectionGrid>
    </ListPage>
  );
}
