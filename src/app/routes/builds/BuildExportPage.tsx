import { Stack, Text } from '@mantine/core';
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
        <Stack gap={4}>
          <Link to="/builds" style={{ fontSize: 'var(--mantine-font-size-sm)' }}>
            ← Back to builds
          </Link>
          <Text size="sm" c="dimmed">
            Rename or change profile on <Link to={`/builds/${build.id}/overview`}>Setup</Link>.
          </Text>
        </Stack>
      }
    >
      <ExportBuildCpsPanel build={build} />
    </FormPage>
  );
}
