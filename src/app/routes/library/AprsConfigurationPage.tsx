import { Loader, Tabs } from '@mantine/core';
import { useCallback, useRef, useState } from 'react';
import AprsChannelAssignmentPanel from '../../components/library/AprsChannelAssignmentPanel.tsx';
import AprsConfigurationEditor from './AprsConfigurationEditor.tsx';
import { FormPage, UnsavedChangesModal } from '../../components/ui/index.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { useLibrary } from '../../state/useLibrary.ts';

export default function AprsConfigurationPage() {
  const { library, loading, projectId, reload } = useLibrary();
  const [activeTab, setActiveTab] = useState<string | null>('configuration');
  const [configDirty, setConfigDirty] = useState(false);
  const [assignmentsDirty, setAssignmentsDirty] = useState(false);
  const [tabModalOpen, setTabModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const permitNavigationRef = useRef(false);

  const aprsEditorKey = `${library.aprsConfiguration?.id ?? 'new'}:${library.aprsConfiguration?.revision ?? 0}:${editorResetKey}`;

  const isDirty = configDirty || assignmentsDirty;
  const {
    modalOpen: routeModalOpen,
    stay: routeStay,
    leave: routeLeave,
  } = useUnsavedNavigationGuard(isDirty, permitNavigationRef);

  const permitNavigationOnce = useCallback(() => {
    permitNavigationRef.current = true;
  }, []);

  function handleTabChange(next: string | null) {
    if (!next || next === activeTab) return;
    if (isDirty) {
      setPendingTab(next);
      setTabModalOpen(true);
      return;
    }
    setActiveTab(next);
  }

  function stayOnTab() {
    setTabModalOpen(false);
    setPendingTab(null);
  }

  function leaveTab() {
    setTabModalOpen(false);
    setConfigDirty(false);
    setAssignmentsDirty(false);
    setEditorResetKey((key) => key + 1);
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
    }
  }

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
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="configuration">Configuration</Tabs.Tab>
          <Tabs.Tab value="assignments">Channel assignments</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="configuration" pt="md" keepMounted>
          <AprsConfigurationEditor
            key={`config-${aprsEditorKey}`}
            projectId={projectId}
            library={library}
            entity={library.aprsConfiguration}
            settingsPage
            mapActive={activeTab === 'configuration'}
            onDirtyChange={setConfigDirty}
            onSaved={reload}
            permitNavigationOnce={permitNavigationOnce}
          />
        </Tabs.Panel>

        <Tabs.Panel value="assignments" pt="md" keepMounted>
          <AprsChannelAssignmentPanel
            key={`assignments-${aprsEditorKey}`}
            projectId={projectId}
            channels={library.channels}
            aprsConfiguration={library.aprsConfiguration}
            channelSlots={library.aprsConfiguration?.channelSlots ?? []}
            onSaved={reload}
            onDirtyChange={setAssignmentsDirty}
            permitNavigationOnce={permitNavigationOnce}
          />
        </Tabs.Panel>
      </Tabs>

      <UnsavedChangesModal opened={routeModalOpen} onStay={routeStay} onLeave={routeLeave} />
      <UnsavedChangesModal
        opened={tabModalOpen}
        onStay={stayOnTab}
        onLeave={leaveTab}
        title="Unsaved changes"
        message="You have unsaved edits on this page. Switch tabs without saving?"
      />
    </FormPage>
  );
}
