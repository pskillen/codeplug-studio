import { useCallback, useEffect, useMemo, useState } from 'react';
import { Accordion, Button, Group, MultiSelect, Stack, Text, TextInput } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ScanListEntry, ScanListsLayout } from '@core/models/traitLayout.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { useBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { persistence } from '../../state/persistence.ts';
import { BuildService } from '../../state/buildService.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';

const buildService = new BuildService(persistence);

async function loadLibrarySlice(projectId: string): Promise<LibrarySlice> {
  const [channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists] =
    await Promise.all([
      persistence.listChannels(projectId),
      persistence.listZones(projectId),
      persistence.listTalkGroups(projectId),
      persistence.listDigitalContacts(projectId),
      persistence.listAnalogContacts(projectId),
      persistence.listRxGroupLists(projectId),
    ]);
  return { channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists };
}

function findScanListsSection(build: FormatBuild): ScanListsLayout | undefined {
  return build.layout.sections.find(
    (section): section is ScanListsLayout => section.kind === 'scanLists',
  );
}

function emptyScanListsLayout(): ScanListsLayout {
  return { kind: 'scanLists', scanLists: [] };
}

function ensureScanListsLayout(build: FormatBuild): ScanListsLayout {
  return findScanListsSection(build) ?? emptyScanListsLayout();
}

function updateScanListEntry(
  layout: ScanListsLayout,
  scanListId: string,
  patch: Partial<Pick<ScanListEntry, 'name' | 'channelIds'>>,
): ScanListsLayout {
  return {
    ...layout,
    scanLists: layout.scanLists.map((entry) =>
      entry.id === scanListId ? { ...entry, ...patch } : entry,
    ),
  };
}

function removeScanListEntry(layout: ScanListsLayout, scanListId: string): ScanListsLayout {
  return {
    ...layout,
    scanLists: layout.scanLists.filter((entry) => entry.id !== scanListId),
  };
}

function addScanListEntry(layout: ScanListsLayout, name: string): ScanListsLayout {
  const id = crypto.randomUUID();
  return {
    ...layout,
    scanLists: [...layout.scanLists, { id, name, channelIds: [] }],
  };
}

export default function BuildScanListLayoutEditor() {
  const { build } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const { putBuild } = useFormatBuilds();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void loadLibrarySlice(activeProjectId).then((slice) => {
      if (!cancelled) setLibrary(slice);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.updatedAt]);

  const layout = useMemo(() => ensureScanListsLayout(build), [build]);

  const channelOptions = useMemo(
    () =>
      (library?.channels ?? []).map((channel) => ({
        value: channel.id,
        label: channelDisplayLabel(channel),
      })),
    [library],
  );

  const persistLayout = useCallback(
    async (nextLayout: ScanListsLayout) => {
      setSaving(true);
      const result = await putBuild(
        buildService.withScanListsSection(build, nextLayout),
        build.revision,
      );
      setSaving(false);
      if (!result.ok) {
        setError(
          result.reason === 'revision_conflict'
            ? 'Build changed elsewhere — reload.'
            : 'Save failed.',
        );
      } else {
        setError(null);
      }
    },
    [build, putBuild],
  );

  const updateEntry = useCallback(
    (scanListId: string, patch: Partial<Pick<ScanListEntry, 'name' | 'channelIds'>>) => {
      void persistLayout(updateScanListEntry(layout, scanListId, patch));
    },
    [layout, persistLayout],
  );

  const removeEntry = useCallback(
    (scanListId: string) => {
      void persistLayout(removeScanListEntry(layout, scanListId));
    },
    [layout, persistLayout],
  );

  const addEntry = useCallback(() => {
    const nextName = `Scan ${layout.scanLists.length + 1}`;
    void persistLayout(addScanListEntry(layout, nextName));
  }, [layout, persistLayout]);

  if (build.formatId !== 'anytone' || !library) {
    return null;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          Scan lists are stored on this build layout. Assign channels below and wire names in the
          table.
        </Text>
        <Button size="xs" variant="light" disabled={saving} onClick={addEntry}>
          Add scan list
        </Button>
      </Group>
      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}
      {layout.scanLists.length === 0 ? (
        <Text size="sm" c="dimmed">
          No scan lists yet. Add one to export ScanList.CSV rows.
        </Text>
      ) : (
        <Accordion variant="separated">
          {layout.scanLists.map((entry) => (
            <Accordion.Item key={entry.id} value={entry.id}>
              <Accordion.Control>{entry.name}</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <TextInput
                    label="Name"
                    value={entry.name}
                    disabled={saving}
                    onChange={(event) => updateEntry(entry.id, { name: event.currentTarget.value })}
                  />
                  <MultiSelect
                    label="Channels"
                    data={channelOptions}
                    value={entry.channelIds}
                    searchable
                    disabled={saving}
                    onChange={(channelIds) => updateEntry(entry.id, { channelIds })}
                  />
                  <Button
                    size="xs"
                    color="red"
                    variant="subtle"
                    disabled={saving}
                    onClick={() => removeEntry(entry.id)}
                  >
                    Remove scan list
                  </Button>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </Stack>
  );
}
