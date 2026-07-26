import { Anchor } from '@mantine/core';
import { Link } from 'react-router-dom';
import { FormPage } from '../../../components/ui/index.ts';
import { useLibrary } from '../../../state/useLibrary.ts';
import ZoneEditor from '../ZoneEditor.tsx';

export default function ZoneCreatePage() {
  const { library, loading, projectId } = useLibrary();

  if (loading || !projectId) {
    return (
      <FormPage title="Loading…">
        <span />
      </FormPage>
    );
  }

  return (
    <FormPage
      title="New zone"
      description={
        <Anchor component={Link} to="/library/zones" size="sm">
          ← Back to zones
        </Anchor>
      }
    >
      <ZoneEditor projectId={projectId} library={library} entity={null} />
    </FormPage>
  );
}
