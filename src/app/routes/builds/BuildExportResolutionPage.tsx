import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader, Stack, Table, Text, TextInput } from '@mantine/core';
import {
  buildChannelBehaviourContext,
  resolveAnalogSquelchModeWithLayer,
  resolveForbidTransmitWithLayer,
  resolveSendTalkerAliasWithLayer,
  resolveTxPermitWithLayer,
  type ResolvedBehaviourField,
} from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import type {
  AnalogSquelchMode,
  EffectiveForbidTransmit,
  SendTalkerAliasMode,
  TxPermitMode,
} from '@core/models/channelBehaviourDefaults.ts';
import { findAnalogProfile, findDmrProfile } from '@core/domain/modeProfiles.ts';
import { assemble, librarySliceFrom } from '@core/services/assemble.ts';
import { FormPage } from '../../components/ui/index.ts';
import {
  analogSquelchModeLabel,
  forbidTransmitLabel,
  layerLabel,
  sendTalkerAliasLabel,
  txPermitLabel,
} from '../../lib/behaviourResolutionLabels.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

export default function BuildExportResolutionPage() {
  const { build } = useBuildLayout();
  const { library, loading } = useLibrary();
  const [filter, setFilter] = useState('');

  const librarySlice = useMemo(() => librarySliceFrom(library), [library]);

  const exportedChannelIds = useMemo(() => {
    const assembled = assemble(build, librarySlice);
    return new Set(assembled.channels.map((row) => row.entity.id));
  }, [build, librarySlice]);

  const context = useMemo(
    () => buildChannelBehaviourContext(library.channelDefaults, build.exportSettings),
    [library.channelDefaults, build.exportSettings],
  );

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
          Effective behavioural values for channels included in this build&apos;s export projection,
          and which cascade layer wins. Talker alias uses the DMR profile; analog squelch mode uses
          the first analog profile.{' '}
          <Link to={`/builds/${build.id}/export`}>Edit build overrides on Export</Link>
          {' · '}
          <Link to="/library/channels/defaults">Library channel defaults</Link>
        </Text>
      }
    >
      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          No channels are included in this build&apos;s export projection yet.
        </Text>
      ) : (
        <Stack gap="md">
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
    </FormPage>
  );
}
