import { Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { FormPage } from '../../components/ui/index.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

export default function BuildWirePreviewPlaceholderPage({ title }: { title: string }) {
  const { build } = useBuildLayout();

  return (
    <FormPage
      title={title}
      description={
        <Link to={`/builds/${build.id}/overview`} style={{ fontSize: 'var(--mantine-font-size-sm)' }}>
          ← {build.name}
        </Link>
      }
    >
      <Text c="dimmed" size="sm">
        Wire preview editor loading in a later slice.
      </Text>
    </FormPage>
  );
}
