import ExportBuildCpsPanel from '../../components/builds/ExportBuildCpsPanel.tsx';
import { FormPage } from '../../components/ui/index.ts';
import { Link } from 'react-router-dom';
import { useBuildLayout } from './BuildLayoutContext.tsx';

export default function BuildExportPage() {
  const { build } = useBuildLayout();

  return (
    <FormPage
      title="Export to CPS"
      description={
        <Link
          to={`/builds/${build.id}/overview`}
          style={{ fontSize: 'var(--mantine-font-size-sm)' }}
        >
          ← {build.name}
        </Link>
      }
    >
      <ExportBuildCpsPanel build={build} />
    </FormPage>
  );
}
