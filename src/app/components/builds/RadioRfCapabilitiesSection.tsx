import { List, Table, Text } from '@mantine/core';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import {
  getRadioRfCapabilities,
  type RadioFrequencyRange,
} from '@core/radio-targets/rfCapabilities.ts';
import { FormSection } from '../ui/index.ts';

function formatMode(mode: ChannelMode): string {
  return mode.toUpperCase();
}

function formatRangeLabel(range: RadioFrequencyRange): string {
  const modes = range.modes.map(formatMode).join(', ');
  const band = `${range.minMhz}–${range.maxMhz} MHz`;
  if (range.txAllowed === false) return `${band} · ${modes} · receive-only`;
  return `${band} · ${modes}`;
}

export interface RadioRfCapabilitiesSectionProps {
  radioTargetId: string;
}

export default function RadioRfCapabilitiesSection({
  radioTargetId,
}: RadioRfCapabilitiesSectionProps) {
  const caps = getRadioRfCapabilities(radioTargetId);
  if (!caps) {
    return (
      <FormSection
        title="RF bands and modes"
        description="Supported modes and frequency ranges for this radio target."
      >
        <Text size="sm" c="dimmed">
          No RF capability table is recorded for this radio yet.
        </Text>
      </FormSection>
    );
  }

  return (
    <FormSection
      title="RF bands and modes"
      description="Supported modes and frequency ranges used to filter build channel lists and export. Receive-only bands are labelled; export still uses your library forbid-transmit settings."
    >
      <Text size="sm" mb="xs">
        Supported modes:{' '}
        <Text span fw={600}>
          {caps.supportedModes.map(formatMode).join(', ')}
        </Text>
      </Text>
      <Table.ScrollContainer minWidth={360}>
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Band</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {caps.frequencyRanges.map((range) => (
              <Table.Tr key={`${range.minMhz}-${range.maxMhz}-${range.modes.join('-')}`}>
                <Table.Td>{formatRangeLabel(range)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <List size="sm" c="dimmed" mt="sm" spacing={2}>
        <List.Item>
          Channels with unsupported modes are always hidden on Radio Build pages.
        </List.Item>
        <List.Item>
          Turn off &quot;Hide channels outside frequency range&quot; on Export to include
          out-of-band memories (with warnings).
        </List.Item>
      </List>
    </FormSection>
  );
}
