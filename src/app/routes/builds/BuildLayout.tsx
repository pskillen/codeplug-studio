import { Text } from '@mantine/core';
import { Outlet, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FormPage } from '../../components/ui/index.ts';
import { useFormatBuild } from '../../state/useFormatBuilds.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';

export default function BuildLayout() {
  const { id } = useParams();
  const { build, loading } = useFormatBuild(id);

  if (loading) {
    return (
      <FormPage title="Loading…">
        <span />
      </FormPage>
    );
  }

  if (!build || !id) {
    return (
      <FormPage title="Build not found">
        <Text>
          <Link to="/builds">← Back to builds</Link>
        </Text>
      </FormPage>
    );
  }

  return (
    <BuildLayoutProvider value={{ build, buildId: id }}>
      <Outlet />
    </BuildLayoutProvider>
  );
}
