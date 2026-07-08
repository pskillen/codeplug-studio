import { useCallback, useEffect, useMemo, useState } from 'react';
import { Accordion, Group, NumberInput, Stack, Switch, Text } from '@mantine/core';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Zone, ZoneMemberEntry } from '@core/models/library.ts';
import type { ZoneGroupingLayout } from '@core/models/traitLayout.ts';
import {
  findZoneGroupingSection,
  seedZoneGroupingFromLibrary,
  updateZoneGroupingEntry,
} from '@core/domain/zoneGroupingLayout.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';
import { useBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import { useFormatBuilds } from '../../state/useFormatBuilds.ts';
import { persistence } from '../../state/persistence.ts';
import { BuildService } from '../../state/buildService.ts';
import { loadLibrarySlice } from '../../lib/loadLibrarySlice.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';

const buildService = new BuildService(persistence);

const DEFAULT_CARRIER_MHZ = 145.5;

function ensureLayout(build: FormatBuild, library: LibrarySlice): ZoneGroupingLayout {
  return findZoneGroupingSection(build) ?? seedZoneGroupingFromLibrary(library);
}

export default function BuildZoneExportControls() {
  const { build } = useBuildLayout();
  const { activeProjectId } = useProjects();
  const { putBuild } = useFormatBuilds();
  const [library, setLibrary] = useState<LibrarySlice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void loadLibrarySlice(persistence, activeProjectId).then((slice) => {
      if (!cancelled) setLibrary(slice);
    });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build.updatedAt]);

  const layout = useMemo(() => (library ? ensureLayout(build, library) : null), [build, library]);

  const zoneById = useMemo(
    () => new Map((library?.zones ?? []).map((zone) => [zone.id, zone])),
    [library],
  );

  const channelById = useMemo(
    () => new Map((library?.channels ?? []).map((channel) => [channel.id, channel])),
    [library],
  );

  const persistLayout = useCallback(
    async (nextLayout: ZoneGroupingLayout) => {
      setSaving(true);
      const result = await putBuild(
        buildService.withZoneGroupingSection(build, nextLayout),
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

  const updateZoneEntry = useCallback(
    (zoneId: string, patch: Parameters<typeof updateZoneGroupingEntry>[2]) => {
      if (!layout) return;
      void persistLayout(updateZoneGroupingEntry(layout, zoneId, patch));
    },
    [layout, persistLayout],
  );

  const updateMemberScanInclusion = useCallback(
    async (zone: Zone, channelId: string, includeInScanList: boolean) => {
      if (!activeProjectId) return;
      const members: ZoneMemberEntry[] = zone.members.map((raw) => {
        const member = normalizeZoneMemberEntry(raw);
        if (member.kind !== 'channel' || member.channelId !== channelId) return member;
        return {
          ...member,
          includeInScanList: includeInScanList ? undefined : false,
        };
      });
      setSaving(true);
      const result = await persistence.putZone({ ...zone, members }, zone.revision);
      setSaving(false);
      if (result.ok) {
        setLibrary((prev) =>
          prev
            ? {
                ...prev,
                zones: prev.zones.map((row) =>
                  row.id === zone.id ? { ...zone, members, revision: result.revision } : row,
                ),
              }
            : prev,
        );
        setError(null);
      } else {
        setError('Failed to save zone membership.');
      }
    },
    [activeProjectId],
  );

  if (build.formatId !== 'dm32' || !library || !layout) {
    return null;
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        DM32 export options persist on this build layout. Scan membership toggles update library
        zones (vendor-neutral).
      </Text>
      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}
      <Accordion variant="separated">
        {layout.zones.map((entry) => {
          const zone = zoneById.get(entry.id);
          if (!zone) return null;
          const carrierMhz =
            entry.scanCarrierFrequencyHz != null
              ? entry.scanCarrierFrequencyHz / 1_000_000
              : DEFAULT_CARRIER_MHZ;

          return (
            <Accordion.Item key={entry.id} value={entry.id}>
              <Accordion.Control>{zone.name}</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Switch
                    label="Export scratch channel"
                    description="Deferred on wire — layout flag only until scratch serialise ships."
                    checked={entry.exportScratchChannel ?? false}
                    disabled={saving}
                    onChange={(event) =>
                      updateZoneEntry(entry.id, {
                        exportScratchChannel: event.currentTarget.checked,
                      })
                    }
                  />
                  <Switch
                    label="Export as scan list"
                    description="Emit Scan.csv, scan carrier, and channel Scan List FK on export."
                    checked={entry.exportScanList ?? false}
                    disabled={saving}
                    onChange={(event) =>
                      updateZoneEntry(entry.id, { exportScanList: event.currentTarget.checked })
                    }
                  />
                  {entry.exportScanList ? (
                    <NumberInput
                      label="Scan carrier (MHz)"
                      value={carrierMhz}
                      decimalScale={3}
                      min={0}
                      disabled={saving}
                      onChange={(value) =>
                        updateZoneEntry(entry.id, {
                          scanCarrierFrequencyHz:
                            typeof value === 'number' ? Math.round(value * 1_000_000) : null,
                        })
                      }
                    />
                  ) : null}
                  <Stack gap={4}>
                    <Text size="sm" fw={500}>
                      Include in scan list
                    </Text>
                    {zone.members
                      .map(normalizeZoneMemberEntry)
                      .filter(
                        (member): member is Extract<ZoneMemberEntry, { kind: 'channel' }> =>
                          member.kind === 'channel',
                      )
                      .map((member) => {
                        const channel = channelById.get(member.channelId);
                        const label = channel ? channelDisplayLabel(channel) : member.channelId;
                        return (
                          <Group key={member.channelId} justify="space-between" wrap="nowrap">
                            <Text size="sm">{label}</Text>
                            <Switch
                              aria-label={`Include ${label} in scan list`}
                              checked={member.includeInScanList !== false}
                              disabled={saving}
                              onChange={(event) =>
                                void updateMemberScanInclusion(
                                  zone,
                                  member.channelId,
                                  event.currentTarget.checked,
                                )
                              }
                            />
                          </Group>
                        );
                      })}
                  </Stack>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </Stack>
  );
}
