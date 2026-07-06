import { Button, Group, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Library, Zone } from '@core/models/library.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { DEFAULT_ZONE_PIVOT, zonePivotPath } from '../../routes/library/zonePivotQuery.ts';

export interface ZoneInlineSettingsProps {
  zone: Zone;
  library: Library;
}

export default function ZoneInlineSettings({ zone, library }: ZoneInlineSettingsProps) {
  const navigate = useNavigate();
  const { deleteEntity } = useLibrary();
  const [name, setName] = useState(zone.name);
  const [comment, setComment] = useState(zone.comment);
  const [omitFromExport, setOmitFromExport] = useState(zone.omitFromExport === true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(zone.name);
    setComment(zone.comment);
    setOmitFromExport(zone.omitFromExport === true);
  }, [zone]);

  const persist = useCallback(
    async (patch: Partial<Zone>) => {
      setSaving(true);
      setError(null);
      const row: Zone = {
        ...zone,
        ...patch,
        name: (patch.name ?? zone.name).trim() || 'Untitled zone',
        omitFromExport: (patch.omitFromExport ?? zone.omitFromExport) ? true : undefined,
      };
      try {
        validateZoneMembership(row.id, row.members, {
          ...library,
          zones: library.zones.map((z) => (z.id === row.id ? row : z)),
        });
        const result = await persistence.putZone(row, zone.revision);
        if (!result.ok) {
          setError(`Save failed (${result.reason})`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    },
    [library, zone],
  );

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Delete zone “${zone.name}”? Channels stay in the library.`)) return;
    const result = await deleteEntity('zone', zone.id);
    if (result.ok) {
      navigate(zonePivotPath(DEFAULT_ZONE_PIVOT));
    } else {
      setError(
        `Delete blocked — ${result.references.length} entit${result.references.length === 1 ? 'y' : 'ies'} still reference this zone.`,
      );
    }
  }, [deleteEntity, navigate, zone.id, zone.name]);

  return (
    <Stack gap="sm">
      <Group grow align="flex-end">
        <TextInput
          label="Zone name"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          onBlur={() => {
            if (name.trim() !== zone.name) void persist({ name });
          }}
        />
        <TextInput
          label="Comment"
          value={comment}
          onChange={(event) => setComment(event.currentTarget.value)}
          onBlur={() => {
            if (comment !== zone.comment) void persist({ comment });
          }}
        />
      </Group>
      <Switch
        label="Don't export as its own zone"
        checked={omitFromExport}
        onChange={(event) => {
          const next = event.currentTarget.checked;
          setOmitFromExport(next);
          void persist({ omitFromExport: next });
        }}
      />
      <Group justify="space-between">
        <Button variant="light" color="red" size="compact-sm" onClick={() => void handleDelete()}>
          Delete zone
        </Button>
        {saving ? (
          <Text size="sm" c="dimmed">
            Saving…
          </Text>
        ) : null}
      </Group>
      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
