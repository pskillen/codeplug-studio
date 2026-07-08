import { useState } from 'react';
import type { Library, ScanList } from '@core/models/library.ts';
import { newScanList } from '@core/domain/factories.ts';
import { Stack, TextInput } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import ScanListMemberEditor from '../../components/library/ScanListMemberEditor.tsx';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

export default function ScanListEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: ScanList | null;
  library: Library;
}) {
  const base = entity ?? newScanList(projectId, '');
  const [name, setName] = useState(base.name);
  const [memberChannelIds, setMemberChannelIds] = useState(base.memberChannelIds);
  const { save, saving, error } = useEntitySave('scan-lists');
  const navigate = useNavigate();

  function buildRow(): ScanList {
    return { ...base, name: name.trim() || 'Untitled scan list', memberChannelIds };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putScanList(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <Stack gap="md" maw={900}>
      <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <ScanListMemberEditor
        channels={library.channels}
        memberChannelIds={memberChannelIds}
        onChange={setMemberChannelIds}
      />
      <EditorActions
        saving={saving}
        error={error}
        onSave={handleSave}
        cancelPath="/library/scan-lists"
      />
      {entity ? (
        <EntityDeleteButton
          kind="scanList"
          entityId={entity.id}
          label={entity.name}
          onDeleted={() => navigate('/library/scan-lists')}
        />
      ) : null}
      <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
    </Stack>
  );
}
