import { useState } from 'react';
import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { DigitalChannelMode, DigitalContact } from '@core/models/library.ts';
import { newDigitalContact } from '@core/domain/factories.ts';
import { FormSection, GradientSegmentedControl } from '../../components/ui/index.ts';
import { digitalModeSegmentOptions } from '../../lib/channelModes.ts';
import { parseOptionalInt } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';

const MODE_OPTIONS = digitalModeSegmentOptions();

export function DigitalContactEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: DigitalContact | null;
}) {
  const base = entity ?? newDigitalContact(projectId, '', 0);
  const [name, setName] = useState(base.name);
  const [mode, setMode] = useState<DigitalChannelMode>(base.mode);
  const [digitalId, setDigitalId] = useState(String(base.digitalId));
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('digital-contacts');

  function handleSave() {
    const row: DigitalContact = {
      ...base,
      name: name.trim() || 'Untitled contact',
      mode,
      digitalId: parseOptionalInt(digitalId) ?? 0,
      comment,
    };
    void save(() => persistence.putDigitalContact(row, entity ? entity.revision : null));
  }

  return (
    <Stack gap="lg" maw={640}>
      <FormSection title="Identity">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <GradientSegmentedControl
          label="Mode"
          value={mode}
          onChange={setMode}
          data={MODE_OPTIONS}
          scheme="digitalModes"
          fullWidth
        />
        <TextInput
          label="Contact ID"
          value={digitalId}
          onChange={(e) => setDigitalId(e.currentTarget.value)}
        />
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
    </Stack>
  );
}
