import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import {
  buildChannelBehaviourContext,
  resolveAnalogSquelchModeWithLayer,
  resolveForbidTransmitWithLayer,
  resolveSendTalkerAliasWithLayer,
  resolveTxPermitWithLayer,
  type ResolvedBehaviourField,
} from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import {
  buildZoneBehaviourContext,
  resolveIncludeInZoneDerivedScanListWithLayer,
} from '@core/import-export/zoneBehaviourDefaults/resolve.ts';
import {
  collectZoneScanMemberRefs,
  layoutEntry,
} from '@core/import-export/zoneDerivedScanLists/members.ts';
import type {
  AnalogSquelchMode,
  EffectiveForbidTransmit,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';
import { findAnalogProfile, findDmrProfile } from '@core/domain/modeProfiles.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { findZoneGroupingSection } from '@core/domain/zoneGroupingLayout.ts';
import { assemble, librarySliceFrom } from '@core/services/assemble.ts';
import { FormPage } from '../../components/ui/index.ts';
import { zoneScanExportSupported } from '../../hooks/useZoneScanExportLayout.ts';
import {
  analogSquelchModeLabel,
  forbidTransmitLabel,
  layerLabel,
  sendTalkerAliasLabel,
  txPermitLabel,
  zoneDerivedScanIncludeLabel,
  zoneLayerLabel,
} from '../../lib/behaviourResolutionLabels.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

export default function BuildExportResolutionPage() {
  const { build } = useBuildLayout();
  const { library, loading } = useLibrary();
  const [filter, setFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const supportsZoneDerivedScan = zoneScanExportSupported(build);

  const librarySlice = useMemo(() => librarySliceFrom(library), [library]);

  const assembled = useMemo(() => assemble(build, librarySlice), [build, librarySlice]);

  const exportedChannelIds = useMemo(
    () => new Set(assembled.channels.map((row) => row.entity.id)),
    [assembled.channels],
  );

  const context = useMemo(
    () => buildChannelBehaviourContext(library.channelDefaults, build.exportSettings),
    [library.channelDefaults, build.exportSettings],
  );

  const zoneContext = useMemo(
    () => buildZoneBehaviourContext(library.zoneDefaults, build.exportSettings),
    [library.zoneDefaults, build.exportSettings],
  );

  const zoneGrouping = useMemo(() => findZoneGroupingSection(build), [build]);

  const rows = useMemo(() => {
    return [...library.channels]
      .filter((channel) => exportedChannelIds.has(channel.id))
      .sort((a, b) => {
        const call = a.callsign.localeCompare(b.callsign);
        if (call !== 0) return call;
        return a.name.localeCompare(b.name);
      })
      .map((channel) => {
        const forbid = resolveForbidTransmitWithLayer(channel, context);
        const txPermit = resolveTxPermitWithLayer(channel, context);
        const dmr = findDmrProfile(channel);
        const analog = findAnalogProfile(channel);
        const talkerAlias: ResolvedBehaviourField<SendTalkerAliasMode> | null = dmr
          ? resolveSendTalkerAliasWithLayer(dmr, context)
          : null;
        const squelch: ResolvedBehaviourField<AnalogSquelchMode> | null = analog
          ? resolveAnalogSquelchModeWithLayer(analog, context)
          : null;
        return {
          id: channel.id,
          callsign: channel.callsign.trim(),
          name: channel.name.trim() || 'Untitled',
          forbid: forbid as ResolvedBehaviourField<EffectiveForbidTransmit>,
          txPermit: txPermit as ResolvedBehaviourField<TxPermitMode>,
          talkerAlias,
          squelch,
        };
      });
  }, [library.channels, context, exportedChannelIds]);

  const filteredRows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) || row.callsign.toLowerCase().includes(needle),
    );
  }, [rows, filter]);

  const zoneRows = useMemo(() => {
    if (!supportsZoneDerivedScan || !zoneGrouping) return [];
    const zoneById = new Map(library.zones.map((zone) => [zone.id, zone]));
    const channelById = new Map(library.channels.map((channel) => [channel.id, channel]));
    const result: Array<{
      key: string;
      zoneName: string;
      channelLabel: string;
      include: ReturnType<typeof resolveIncludeInZoneDerivedScanListWithLayer>;
    }> = [];

    for (const assembledZone of assembled.zones) {
      const entry = layoutEntry(zoneGrouping, assembledZone.zoneId);
      if (!entry?.exportScanList) continue;
      const libraryZone = zoneById.get(assembledZone.zoneId);
      if (!libraryZone) continue;
      const refs = collectZoneScanMemberRefs(libraryZone, library.zones, {
        context: zoneContext,
        layoutEntry: entry,
      });
      for (const ref of refs) {
        const channel = channelById.get(ref.channelId);
        const resolved = resolveIncludeInZoneDerivedScanListWithLayer({
          memberOverride: ref.memberOverride,
          channelId: ref.channelId,
          context: zoneContext,
          projection: entry.scanMemberInclusion,
        });
        result.push({
          key: `${assembledZone.zoneId}:${ref.channelId}`,
          zoneName: assembledZone.wireName,
          channelLabel: channel ? channelDisplayLabel(channel) : ref.channelId,
          include: resolved,
        });
      }
    }
    return result;
  }, [
    supportsZoneDerivedScan,
    zoneGrouping,
    library.zones,
    library.channels,
    assembled.zones,
    zoneContext,
  ]);

  const filteredZoneRows = useMemo(() => {
    const needle = zoneFilter.trim().toLowerCase();
    if (!needle) return zoneRows;
    return zoneRows.filter(
      (row) =>
        row.zoneName.toLowerCase().includes(needle) ||
        row.channelLabel.toLowerCase().includes(needle),
    );
  }, [zoneRows, zoneFilter]);

  if (loading) {
    return (
      <FormPage title="Export resolution">
        <Loader size="sm" />
      </FormPage>
    );
  }

  return (
    <FormPage
      title="Export resolution"
      description={
        <Text size="sm" component="span">
          Effective behavioural values for this build&apos;s export projection, and which cascade
          layer wins.{' '}
          <Link to={`/builds/${build.id}/export`}>Edit build overrides on Export</Link>
          {' · '}
          <Link to="/library/channels/defaults">Channel defaults</Link>
          {' · '}
          <Link to="/library/zones/defaults">Zone defaults</Link>
        </Text>
      }
    >
      <Tabs defaultValue="channels">
        <Tabs.List>
          <Tabs.Tab value="channels">Channels</Tabs.Tab>
          <Tabs.Tab value="zones">Zones</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="channels" pt="md">
          {rows.length === 0 ? (
            <Text size="sm" c="dimmed">
              No channels are included in this build&apos;s export projection yet.
            </Text>
          ) : (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Talker alias uses the DMR profile; analog squelch mode uses the first analog profile.
              </Text>
              <TextInput
                label="Filter"
                placeholder="Filter by callsign or name"
                value={filter}
                onChange={(event) => setFilter(event.currentTarget.value)}
                maw={360}
              />
              {filteredRows.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No channels match this filter.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={960}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Callsign</Table.Th>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Transmit</Table.Th>
                        <Table.Th>TX permit</Table.Th>
                        <Table.Th>Talker alias (DMR)</Table.Th>
                        <Table.Th>Analog squelch</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredRows.map((row) => (
                        <Table.Tr key={row.id}>
                          <Table.Td>{row.callsign || '—'}</Table.Td>
                          <Table.Td>{row.name}</Table.Td>
                          <Table.Td>
                            {forbidTransmitLabel(row.forbid.value)}
                            <Text size="xs" c="dimmed">
                              {layerLabel(row.forbid.layer)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {txPermitLabel(row.txPermit.value)}
                            <Text size="xs" c="dimmed">
                              {layerLabel(row.txPermit.layer)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {row.talkerAlias ? (
                              <>
                                {sendTalkerAliasLabel(row.talkerAlias.value)}
                                <Text size="xs" c="dimmed">
                                  {layerLabel(row.talkerAlias.layer)}
                                </Text>
                              </>
                            ) : (
                              <Text size="sm" c="dimmed">
                                —
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {row.squelch ? (
                              <>
                                {analogSquelchModeLabel(row.squelch.value)}
                                <Text size="xs" c="dimmed">
                                  {layerLabel(row.squelch.layer)}
                                </Text>
                              </>
                            ) : (
                              <Text size="sm" c="dimmed">
                                —
                              </Text>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="zones" pt="md">
          {!supportsZoneDerivedScan ? (
            <Text size="sm" c="dimmed">
              This format does not use zone-derived scan lists. Channel scan inclusion (Skip) is
              edited on channels; OpenGD77 treats zones as the scan set.
            </Text>
          ) : zoneRows.length === 0 ? (
            <Text size="sm" c="dimmed">
              No zones have Export as scan list enabled for this build yet. Enable them on Build →
              Zones.
            </Text>
          ) : (
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Zone-derived scan membership for channels under exported zones (library → member →
                build → projection).
              </Text>
              <TextInput
                label="Filter"
                placeholder="Filter by zone or channel"
                value={zoneFilter}
                onChange={(event) => setZoneFilter(event.currentTarget.value)}
                maw={360}
              />
              {filteredZoneRows.length === 0 ? (
                <Text size="sm" c="dimmed">
                  No rows match this filter.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={720}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Zone</Table.Th>
                        <Table.Th>Channel</Table.Th>
                        <Table.Th>Zone-derived scan</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredZoneRows.map((row) => (
                        <Table.Tr key={row.key}>
                          <Table.Td>{row.zoneName}</Table.Td>
                          <Table.Td>{row.channelLabel}</Table.Td>
                          <Table.Td>
                            {zoneDerivedScanIncludeLabel(row.include.value)}
                            <Text size="xs" c="dimmed">
                              {zoneLayerLabel(row.include.layer)}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </FormPage>
  );
}
