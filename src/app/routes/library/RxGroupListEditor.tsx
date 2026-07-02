import { useState } from 'react';
import type { Library, RxGroupList } from '@core/models/library.ts';
import { newRxGroupList } from '@core/domain/factories.ts';
import { Stack, TextInput } from '@mantine/core';
import RxGroupListMemberPicker from '../../components/library/RxGroupListMemberPicker.tsx';
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

  function handleSave() {
    const row: RxGroupList = { ...base, name: name.trim() || 'Untitled list', members };
    void save(() => persistence.putRxGroupList(row, entity ? entity.revision : null));
  }

  return (
    <Stack gap="md" maw={900}>
      <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
      <RxGroupListMemberPicker
        talkGroups={library.talkGroups}
        digitalContacts={library.digitalContacts}
        members={members}
        onChange={setMembers}
      />
      <EditorActions
        saving={saving}
        error={error}
        onSave={handleSave}
        cancelPath="/library/rx-group-lists"
      />
    </Stack>
  );
}
