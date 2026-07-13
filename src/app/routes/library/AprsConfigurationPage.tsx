import { Loader, Tabs } from '@mantine/core';
import { useState } from 'react';
import AprsChannelAssignmentPanel from '../../components/library/AprsChannelAssignmentPanel.tsx';
import AprsConfigurationEditor from './AprsConfigurationEditor.tsx';
import { FormPage } from '../../components/ui/index.ts';
import { useLibrary } from '../../state/useLibrary.ts';

export default function AprsConfigurationPage() {
  const { library, loading, projectId, reload } = useLibrary();
  const [activeTab, setActiveTab] = useState<string | null>('configuration');

  if (loading || !projectId) {
    return (
      <FormPage title="APRS configuration">
        <Loader size="sm" />
      </FormPage>
    );
  }

  return (
    <FormPage
      title="APRS configuration"
      description="Global digital APRS profile and per-channel assignments for this project."
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="configuration">Configuration</Tabs.Tab>
          <Tabs.Tab value="assignments">Channel assignments</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="configuration" pt="md">
          <AprsConfigurationEditor
            projectId={projectId}
            library={library}
            entity={library.aprsConfiguration}
            settingsPage
            mapActive={activeTab === 'configuration'}
          />
        </Tabs.Panel>

        <Tabs.Panel value="assignments" pt="md">
          <AprsChannelAssignmentPanel
            projectId={projectId}
            channels={library.channels}
            aprsConfiguration={library.aprsConfiguration}
            channelSlots={library.aprsConfiguration?.channelSlots ?? []}
            onSaved={reload}
          />
        </Tabs.Panel>
      </Tabs>
    </FormPage>
  );
}
