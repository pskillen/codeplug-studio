import { Loader } from '@mantine/core';
import { FormPage } from '../../components/ui/index.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import ChannelBehaviourDefaultsEditor from './ChannelBehaviourDefaultsEditor.tsx';

export default function ChannelDefaultsPage() {
  const { library, loading, projectId, reload } = useLibrary();

  if (loading || !projectId) {
    return (
      <FormPage title="Channel defaults">
        <Loader size="sm" />
      </FormPage>
    );
  }

  return (
    <FormPage
      title="Channel defaults"
      description="Library-wide behavioural defaults for channels. Per-channel and per-build overrides take precedence when set."
    >
      <ChannelBehaviourDefaultsEditor
        projectId={projectId}
        channelDefaults={library.channelDefaults}
        onSaved={reload}
      />
    </FormPage>
  );
}
