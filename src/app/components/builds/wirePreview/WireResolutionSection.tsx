import { Stack, Table, Text } from '@mantine/core';
import type {
  ResolutionFieldRow,
  ZoneScanMemberResolutionRow,
} from '../../../lib/wirePreviewResolution.ts';

export interface WireResolutionSectionProps {
  /** Effective value + deciding layer, one row per exported field. */
  fields: ResolutionFieldRow[];
  /** Zone rows only — per-member zone-derived scan inclusion, when the trait applies. */
  zoneDerivedScan?: ZoneScanMemberResolutionRow[];
}

/**
 * "Why is it this?" reading for one row's export projection (ux-proposal.md §1) — absorbed
 * from the deleted `/builds/:id/export-resolution` About route. Lists each exported field
 * next to the layer that decided its effective value: library default, channel/zone/member
 * override, build override, or (wire names only) a row override / target constraint.
 */
export default function WireResolutionSection({
  fields,
  zoneDerivedScan,
}: WireResolutionSectionProps) {
  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>
        Resolution
      </Text>
      <Table.ScrollContainer minWidth={320}>
        <Table striped withTableBorder={false}>
          <Table.Tbody>
            {fields.map((field) => (
              <Table.Tr key={field.key}>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {field.label}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{field.value}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {field.layer}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {zoneDerivedScan ? (
        <Stack gap={4}>
          <Text size="sm" c="dimmed">
            Zone-derived scan membership (library → member → build → projection)
          </Text>
          {zoneDerivedScan.length === 0 ? (
            <Text size="sm" c="dimmed">
              No channels reachable through this zone.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={320}>
              <Table striped withTableBorder={false}>
                <Table.Tbody>
                  {zoneDerivedScan.map((member) => (
                    <Table.Tr key={member.key}>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {member.channelLabel}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{member.value}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {member.layer}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
