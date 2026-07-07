import { useState } from 'react';
import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { AnalogContact } from '@core/models/library.ts';
import { newAnalogContact } from '@core/domain/factories.ts';
import { FormSection, UnsavedChangesModal } from '../../components/ui/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';

export function AnalogContactEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: AnalogContact | null;
}) {
  const base = entity ?? newAnalogContact(projectId, '');
  const [name, setName] = useState(base.name);
  const [code, setCode] = useState(base.code);
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('analog-contacts');

  function buildRow(): AnalogContact {
    return {
      ...base,
      name: name.trim() || 'Untitled contact',
      code,
      comment,
    };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putAnalogContact(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <Stack gap="lg" maw={640}>
      <FormSection title="Identity">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput label="Code" value={code} onChange={(e) => setCode(e.currentTarget.value)} />
        <TextInput
          label="Comment"
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
      </FormSection>

      {error ? (
        <Text c="red" size="sm">
          {error}
        </Text>
      ) : null}
      <Group>
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
        <Button component={Link} to="/library/contacts" variant="light">
          Cancel
        </Button>
      </Group>
      <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
    </Stack>
  );
}
