import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Loader, Table, Text } from '@mantine/core';
import {
  buildChannelBehaviourContext,
  resolveAnalogSquelchModeWithLayer,
  resolveForbidTransmitWithLayer,
  resolveSendTalkerAliasWithLayer,
  resolveTxPermitWithLayer,
} from '@core/import-export/channelBehaviourDefaults/resolve.ts';
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

  const context = useMemo(
    () => buildChannelBehaviourContext(library.channelDefaults, build.exportSettings),
    [library.channelDefaults, build.exportSettings],
  );

  const rows = useMemo(() => {
    return [...library.channels]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((channel) => {
        const forbid = resolveForbidTransmitWithLayer(channel, context);
        const txPermit = resolveTxPermitWithLayer(channel, context);
        const talkerAlias = resolveSendTalkerAliasWithLayer(channel, context);
        const squelch = resolveAnalogSquelchModeWithLayer(channel, context);
        return {
          id: channel.id,
          name: channel.name || 'Untitled',
          forbid,
          txPermit,
          talkerAlias,
          squelch,
        };
      });
  }, [library.channels, context]);

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
          Effective behavioural values for each library channel on this build, and which cascade
          layer wins. <Link to={`/builds/${build.id}/export`}>Edit build overrides on Export</Link>
          {' · '}
          <Link to="/library/channels/defaults">Library channel defaults</Link>
        </Text>
      }
    >
      {rows.length === 0 ? (
        <Text size="sm" c="dimmed">
          No channels in the library yet.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Channel</Table.Th>
                <Table.Th>Transmit</Table.Th>
                <Table.Th>TX permit</Table.Th>
                <Table.Th>Talker alias</Table.Th>
                <Table.Th>Analog squelch</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => (
                <Table.Tr key={row.id}>
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
                    {sendTalkerAliasLabel(row.talkerAlias.value)}
                    <Text size="xs" c="dimmed">
                      {layerLabel(row.talkerAlias.layer)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {analogSquelchModeLabel(row.squelch.value)}
                    <Text size="xs" c="dimmed">
                      {layerLabel(row.squelch.layer)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </FormPage>
  );
}
