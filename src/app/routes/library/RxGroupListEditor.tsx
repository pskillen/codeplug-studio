import { useState } from 'react';
import type { Library, RxGroupList } from '@core/models/library.ts';
import { newRxGroupList } from '@core/domain/factories.ts';
import { Stack, TextInput } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import RxGroupListMemberPicker from '../../components/library/RxGroupListMemberPicker.tsx';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import EditorActions from './EditorActions.tsx';

export default function RxGroupListEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: RxGroupList | null;
  library: Library;
}) {
  const base = entity ?? newRxGroupList(projectId, '');
  const [name, setName] = useState(base.name);
  const [members, setMembers] = useState(base.members);
  const { save, saving, error } = useEntitySave('rx-group-lists');
  const navigate = useNavigate();

  function buildRow(): RxGroupList {
    return { ...base, name: name.trim() || 'Untitled list', members };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putRxGroupList(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <Stack gap="md" maw={900}>
      <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <RxGroupListMemberPicker
        talkGroups={library.talkGroups}
        digitalContacts={library.digitalContacts}
        library={library}
        members={members}
        onChange={setMembers}
      />
      <EditorActions
        saving={saving}
        error={error}
        onSave={handleSave}
        cancelPath="/library/rx-group-lists"
      />
      {entity ? (
        <EntityDeleteButton
          kind="rxGroupList"
          entityId={entity.id}
          label={entity.name}
          onDeleted={() => navigate('/library/rx-group-lists')}
        />
      ) : null}
      <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
    </Stack>
  );
}
