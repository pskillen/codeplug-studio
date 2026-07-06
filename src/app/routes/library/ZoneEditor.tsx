import { useCallback, useState } from 'react';
import { Stack, Switch, Text, TextInput } from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { newZone } from '@core/domain/factories.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import { FormSection } from '../../components/ui/index.ts';
import {
  normalizeZoneMembers,
  zoneMembersFromSelectedIds,
} from '../../components/library/zoneMembers.ts';
import { persistence } from '../../state/persistence.ts';
import EditorActions from './EditorActions.tsx';
import { readInitialChannelIds } from './zoneEditorState.ts';
import { zonePivotPath } from './zonePivotQuery.ts';

/** Create-only zone form — existing zones edit on the unified pivot screen. */
export default function ZoneEditor({
  projectId,
  entity,
  library,
}: {
  projectId: string;
  entity: Zone | null;
  library: Library;
}) {
  const base = entity ?? newZone(projectId, '');
  const navigate = useNavigate();
  const location = useLocation();
  const initialChannelIds = entity === null ? readInitialChannelIds(location.state) : [];
  const [name, setName] = useState(base.name);
  const [members] = useState<ZoneMemberEntry[]>(() =>
    initialChannelIds.length > 0
      ? zoneMembersFromSelectedIds(initialChannelIds)
      : normalizeZoneMembers(base.members),
  );
  const [comment, setComment] = useState(base.comment);
  const [omitFromExport, setOmitFromExport] = useState(base.omitFromExport === true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(async () => {
    const row: Zone = {
      ...base,
      name: name.trim() || 'Untitled zone',
      members,
      comment,
      omitFromExport: omitFromExport ? true : undefined,
    };
    try {
      const libraryForValidation = {
        ...library,
        zones: [...library.zones, row],
      };
      validateZoneMembership(row.id, members, libraryForValidation);
      setValidationError(null);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid zone membership');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const result = await persistence.putZone(row, null);
      if (!result.ok) {
        setError('Save failed.');
        return;
      }
      navigate(zonePivotPath({ pivot: 'zone', zoneId: row.id }));
    } finally {
      setSaving(false);
    }
  }, [base, comment, library, members, name, navigate, omitFromExport]);

  const displayError = validationError ?? error;

  return (
    <Stack gap="md">
      <FormSection title="Identity">
        <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <TextInput
          label="Comment"
          value={comment}
          onChange={(e) => setComment(e.currentTarget.value)}
        />
        <Switch
          label="Don't export as its own zone"
          checked={omitFromExport}
          onChange={(e) => setOmitFromExport(e.currentTarget.checked)}
        />
        <Text size="sm" c="dimmed">
          Add channels and nested zones on the unified channels & zones screen after saving.
        </Text>
        {initialChannelIds.length > 0 ? (
          <Text size="sm" c="dimmed">
            {initialChannelIds.length} channel{initialChannelIds.length === 1 ? '' : 's'} will be
            added as members.
          </Text>
        ) : null}
      </FormSection>

      <EditorActions
        saving={saving}
        error={displayError}
        onSave={() => void handleSave()}
        cancelPath="/library/zones?pivot=all"
      />
    </Stack>
  );
}
