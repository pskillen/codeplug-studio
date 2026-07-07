import { useState } from 'react';
import { Button, Group, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { DigitalChannelMode, TalkGroup } from '@core/models/library.ts';
import { newTalkGroup } from '@core/domain/factories.ts';
import TalkGroupWireNameExamples from '../../components/library/TalkGroupWireNameExamples.tsx';
import { FormSection, GradientSegmentedControl, UnsavedChangesModal } from '../../components/ui/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { digitalModeSegmentOptions } from '../../lib/channelModes.ts';
import { parseOptionalInt } from '../../lib/units.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';

const MODE_OPTIONS = digitalModeSegmentOptions();

export function TalkGroupEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: TalkGroup | null;
}) {
  const base = entity ?? newTalkGroup(projectId, '', 0);
  const [name, setName] = useState(base.name);
  const [abbreviation, setAbbreviation] = useState(base.abbreviation ?? '');
  const [mode, setMode] = useState<DigitalChannelMode>(base.mode);
  const [digitalId, setDigitalId] = useState(String(base.digitalId));
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('talk-groups');

  function buildRow(): TalkGroup {
    const trimmedAbbrev = abbreviation.trim();
    const row: TalkGroup = {
      ...base,
      name: name.trim() || 'Untitled talk group',
      mode,
      digitalId: parseOptionalInt(digitalId) ?? 0,
      comment,
    };
    if (trimmedAbbrev) {
      row.abbreviation = trimmedAbbrev;
    } else {
      delete row.abbreviation;
    }
    return row;
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putTalkGroup(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  const liveDigitalId = parseOptionalInt(digitalId) ?? 0;

  return (
    <Stack gap="lg" maw={640}>
      <FormSection title="Identity">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput
            label="Name"
            description="Full talk group name. May be shortened on export when used as a multi-talkgroup channel suffix."
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="Abbreviation"
            description="Optional short label used when export shortening needs a shorter TG suffix."
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.currentTarget.value)}
          />
        </SimpleGrid>
        <TalkGroupWireNameExamples
          name={name}
          abbreviation={abbreviation}
          digitalId={liveDigitalId}
        />
        <GradientSegmentedControl
          label="Mode"
          value={mode}
          onChange={setMode}
          data={MODE_OPTIONS}
          scheme="digitalModes"
          fullWidth
        />
        <TextInput
          label="Group ID"
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
        <Button component={Link} to="/library/talk-groups" variant="light">
          Cancel
        </Button>
      </Group>
      <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
    </Stack>
  );
}
