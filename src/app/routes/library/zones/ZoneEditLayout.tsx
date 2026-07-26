import { Anchor, Stack } from '@mantine/core';
import { Link, Navigate, Outlet, useParams } from 'react-router-dom';
import { FormPage } from '../../../components/ui/index.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import { ZoneEditProvider } from './ZoneEditContext.tsx';
import ZoneEditActions from './ZoneEditActions.tsx';

export default function ZoneEditLayout() {
  const { zoneId } = useParams();
  const { library, loading, projectId } = useLibrary();

  if (!zoneId || zoneId === 'new') {
    return <Navigate to="/library/zones/new" replace />;
  }

  if (loading || !projectId) {
    return (
      <FormPage title="Loading…">
        <span />
      </FormPage>
    );
  }

  const entity = library.zones.find((z) => z.id === zoneId);
  if (!entity) {
    return (
      <FormPage
        title="Zone not found"
        description={
          <Anchor component={Link} to="/library/zones" size="sm">
            ← Back to zones
          </Anchor>
        }
      >
        <span />
      </FormPage>
    );
  }

  return (
    <ZoneEditProvider entity={entity} library={library} projectId={projectId}>
      <FormPage
        title={`Edit zone`}
        description={
          <Anchor component={Link} to="/library/zones" size="sm">
            ← Back to zones
          </Anchor>
        }
      >
        <Stack gap="md" maw={960}>
          <Outlet />
          <ZoneEditActions />
        </Stack>
      </FormPage>
    </ZoneEditProvider>
  );
}
