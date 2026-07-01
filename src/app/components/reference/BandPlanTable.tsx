import { ScrollArea, Stack, Table, Text, Title } from '@mantine/core';
import { BAND_SECTIONS } from '@core/domain/bandCatalog.ts';
import BandPill from '../pills/BandPill.tsx';
import { formatBandRangeMhz } from '../../lib/formatFrequency.ts';

export default function BandPlanTable() {
  return (
    <ScrollArea>
      <Stack gap="lg">
        {BAND_SECTIONS.map((section) => (
          <Stack key={section.title} gap="xs">
            <Title order={3} size="h4">
              {section.title}
            </Title>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Band</Table.Th>
                  <Table.Th>Range</Table.Th>
                  <Table.Th>Colour</Table.Th>
                  <Table.Th>Notes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {section.bands.map((band) => (
                  <Table.Tr key={band.id}>
                    <Table.Td>
                      <BandPill band={band} />
                    </Table.Td>
                    <Table.Td>{formatBandRangeMhz(band.minMhz, band.maxMhz)}</Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" ff="monospace">
                        {band.color}
                      </Text>
                    </Table.Td>
                    <Table.Td>{band.notes ?? '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        ))}
      </Stack>
    </ScrollArea>
  );
}
