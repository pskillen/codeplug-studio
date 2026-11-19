import { Group, List, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { RadioReadSummary } from '../../services/radioReadIntoLibrary.ts';

export default function ReadIntoLibrarySummary({ summary }: { summary: RadioReadSummary }) {
  const { channels, zones, build, buildNote, droppedFields, notes } = summary;
  const readZones = zones.created + zones.updated + zones.unchanged > 0;
  const details = [...notes, ...zones.warnings];

  return (
    <Stack gap="xs">
      <Title order={3}>Read complete</Title>
      <Text size="sm">
        {summary.modelLabel} · {summary.firmwareLabel}
      </Text>
      <Text size="sm">
        Channels: {channels.created} created, {channels.updated} updated, {channels.unchanged}{' '}
        unchanged
      </Text>
      {readZones ? (
        <Text size="sm">
          Zones: {zones.created} created, {zones.updated} updated, {zones.unchanged} unchanged
        </Text>
      ) : null}
      <Text size="sm">
        Build: <Link to={`/builds/${build.id}/export`}>{build.name}</Link> ({build.action})
      </Text>
      {build.channelsLeftOut > 0 || build.zonesLeftOut > 0 ? (
        <Text size="sm">
          Left out of the build (still in your library): {build.channelsLeftOut}{' '}
          {build.channelsLeftOut === 1 ? 'channel' : 'channels'}, {build.zonesLeftOut}{' '}
          {build.zonesLeftOut === 1 ? 'zone' : 'zones'}
        </Text>
      ) : null}
      {buildNote ? (
        <Text size="sm" c="dimmed">
          {buildNote}
        </Text>
      ) : null}
      <Group>
        <Link to="/library/channels">Open channels</Link>
        {readZones ? <Link to="/library/zones">Open zones</Link> : null}
      </Group>
      {droppedFields.length > 0 ? (
        <div>
          <Text size="sm" fw={600}>
            Not carried over
          </Text>
          <List size="sm">
            {droppedFields.map((field) => (
              <List.Item key={field}>{field}</List.Item>
            ))}
          </List>
        </div>
      ) : null}
      {details.length > 0 ? (
        <List size="sm" c="dimmed">
          {details.map((detail) => (
            <List.Item key={detail}>{detail}</List.Item>
          ))}
        </List>
      ) : null}
    </Stack>
  );
}
