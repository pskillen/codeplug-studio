import { useMemo } from 'react';
import { Button, Group, Stack, Table, TextInput } from '@mantine/core';
import type { EgressPath } from '@core/models/egressPath.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import { assemble } from '@core/services/assemble.ts';
import { useBuildWirePreview } from '../../hooks/useBuildWirePreview.ts';
import { buildRadioWriteProjection } from '../../services/radioIoWriteProjection.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { FieldCard } from '../fields/Fields.tsx';

const buildService = new BuildService(persistence);

export interface ChannelDescriptionsCardProps {
  egress: Pick<EgressPath, 'formatId' | 'profileId'>;
  /** Description length from the egress profile. */
  limit: number;
}

/**
 * Per-channel description as the radio will show it (wire value), with an inline override.
 * Shown only for egress profiles that write descriptions.
 */
export default function ChannelDescriptionsCard({ egress, limit }: ChannelDescriptionsCardProps) {
  const { build, library, persistBuild, saving } = useBuildWirePreview('channel');

  const rows = useMemo(() => {
    if (!library) return [];
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    const byNumber = new Map<number, string>();
    for (const [channelId, numbers] of projection.numbersBySourceChannelId) {
      for (const n of numbers) byNumber.set(n, channelId);
    }
    const names = new Map(library.channels.map((c) => [c.id, c.name]));
    return projection.channels
      .filter((dto) => !dto.empty && byNumber.has(dto.slotIndex))
      .map((dto) => {
        const channelId = byNumber.get(dto.slotIndex)!;
        return {
          channelId,
          slot: dto.slotIndex,
          libraryName: names.get(channelId) ?? '',
          radioName: dto.wireName,
          description: dto.description ?? '',
        };
      });
  }, [build, library, egress]);

  const overrides = useMemo(() => overrideByEntityId(build.channelOverrides), [build]);

  function save(channelId: string, text: string | undefined) {
    void persistBuild((current) =>
      buildService.withWireDescriptionOverride(current, channelId, text),
    );
  }

  if (rows.length === 0) return null;

  return (
    <FieldCard
      title="Descriptions"
      description={`Shown under the channel in single watch (${limit} characters). Defaults to the channel Name; type to override, leave empty for none.`}
    >
      <Stack gap="xs">
        <Table.ScrollContainer minWidth={480}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>No.</Table.Th>
                <Table.Th>Radio name</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row) => {
                const override = overrides.get(row.channelId)?.wireDescription;
                return (
                  <Table.Tr key={row.channelId}>
                    <Table.Td>{row.slot}</Table.Td>
                    <Table.Td>{row.radioName}</Table.Td>
                    <Table.Td>
                      <TextInput
                        key={`${row.channelId}:${row.description}`}
                        aria-label={`Description for ${row.libraryName || row.radioName}`}
                        size="xs"
                        maxLength={limit}
                        defaultValue={row.description}
                        disabled={saving}
                        onBlur={(event) => {
                          const next = event.currentTarget.value;
                          if (next !== row.description) save(row.channelId, next);
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      {override !== undefined ? (
                        <Group gap="xs">
                          <Button
                            size="compact-xs"
                            variant="subtle"
                            disabled={saving}
                            onClick={() => save(row.channelId, undefined)}
                          >
                            Reset
                          </Button>
                        </Group>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </FieldCard>
  );
}
