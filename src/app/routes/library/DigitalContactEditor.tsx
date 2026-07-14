import { useEffect, useState } from 'react';
import { Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { Link, useNavigate } from 'react-router-dom';
import type { DigitalChannelMode, DigitalContact } from '@core/models/library.ts';
import { newDigitalContact } from '@core/domain/factories.ts';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import {
  FormSection,
  GradientSegmentedControl,
  UnsavedChangesModal,
} from '../../components/ui/index.ts';
import { digitalModeSegmentOptions } from '../../lib/channelModes.ts';
import { parseOptionalInt } from '../../lib/units.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import RadioidContactVerifyPanel from '../../components/contacts/RadioidContactVerifyPanel.tsx';
import { useLibrary } from '../../state/useLibrary.ts';

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
  const [callsign, setCallsign] = useState(base.callsign);
  const [city, setCity] = useState(base.city);
  const [state, setState] = useState(base.state);
  const [country, setCountry] = useState(base.country);
  const [remarks, setRemarks] = useState(base.remarks);
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('digital-contacts');
  const { reload } = useLibrary();
  const navigate = useNavigate();

  useEffect(() => {
    if (!entity) return;
    setName(entity.name);
    setMode(entity.mode);
    setDigitalId(String(entity.digitalId));
    setCallsign(entity.callsign);
    setCity(entity.city);
    setState(entity.state);
    setCountry(entity.country);
    setRemarks(entity.remarks);
    setComment(entity.comment);
  }, [entity]);

  function buildRow(): DigitalContact {
    return {
      ...base,
      name: name.trim() || 'Untitled contact',
      mode,
      digitalId: parseOptionalInt(digitalId) ?? 0,
      callsign: callsign.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      remarks: remarks.trim(),
      comment,
    };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putDigitalContact(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
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
          label="Callsign"
          value={callsign}
          onChange={(e) => setCallsign(e.currentTarget.value)}
        />
      </FormSection>

      <FormSection title="Address">
        <TextInput label="City" value={city} onChange={(e) => setCity(e.currentTarget.value)} />
        <TextInput
          label="State / province"
          value={state}
          onChange={(e) => setState(e.currentTarget.value)}
        />
        <TextInput
          label="Country"
          value={country}
          onChange={(e) => setCountry(e.currentTarget.value)}
        />
        <TextInput
          label="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.currentTarget.value)}
          description="Exported on some CPS formats (e.g. Anytone Remarks column)."
        />
      </FormSection>

      <FormSection title="Notes">
        <TextInput
          label="Comment"
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
          description="Internal notes — not exported on all formats."
        />
      </FormSection>

      {entity ? (
        <RadioidContactVerifyPanel
          contact={entity}
          onApplied={() => void reload()}
        />
      ) : null}

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
        {entity ? (
          <EntityDeleteButton
            kind="digitalContact"
            entityId={entity.id}
            label={entity.name}
            onDeleted={() => navigate('/library/contacts')}
          />
        ) : null}
      </Group>
      <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
    </Stack>
  );
}
