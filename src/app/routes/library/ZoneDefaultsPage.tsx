import { Loader } from '@mantine/core';
import { FormPage } from '../../components/ui/index.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import ZoneBehaviourDefaultsEditor from './ZoneBehaviourDefaultsEditor.tsx';

export default function ZoneDefaultsPage() {
  const { library, loading, projectId, reload } = useLibrary();

  if (loading || !projectId) {
    return (
      <FormPage title="Zone defaults">
        <Loader size="sm" />
      </FormPage>
    );
  }

  return (
    <FormPage
      title="Zone defaults"
      description="Library-wide behavioural defaults for zones. Per-member and per-build overrides take precedence when set."
    >
      <ZoneBehaviourDefaultsEditor
        projectId={projectId}
        zoneDefaults={library.zoneDefaults}
        onSaved={reload}
      />
    </FormPage>
  );
}
