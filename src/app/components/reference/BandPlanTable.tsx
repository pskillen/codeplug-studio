import { Stack, Table, Text } from '@mantine/core';
import { BAND_SECTIONS } from '@core/domain/bandCatalog.ts';
import BandPill from '../pills/BandPill.tsx';
import { formatBandRangeMhz } from '../../lib/formatFrequency.ts';
import classes from './BandPlanTable.module.css';

export interface BandPlanTableProps {
  /** Typography-forward bare tables without Mantine table chrome (mk2 U5). */
  bare?: boolean;
}

export default function BandPlanTable({ bare = false }: BandPlanTableProps) {
  return (
    <Stack gap="lg" className={bare ? classes.bareRoot : undefined}>
      {BAND_SECTIONS.map((section) => (
        <Stack key={section.title} gap="xs">
          <h2 className={bare ? classes.sectionTitle : undefined}>
            {!bare ? (
              <Text component="span" size="lg" fw={600}>
                {section.title}
              </Text>
            ) : (
              section.title
            )}
          </h2>
          <Table
            striped={!bare}
            highlightOnHover={!bare}
            withTableBorder={!bare}
            className={bare ? classes.bareTable : undefined}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Band</Table.Th>
                <Table.Th>Range</Table.Th>
                {!bare ? <Table.Th>Colour</Table.Th> : null}
                <Table.Th>Notes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {section.bands.map((band) => (
                <Table.Tr key={band.id}>
                  <Table.Td>
                    <BandPill band={band} />
                  </Table.Td>
                  <Table.Td className={bare ? classes.rangeCell : undefined}>
                    {formatBandRangeMhz(band.minMhz, band.maxMhz)}
                  </Table.Td>
                  {!bare ? (
                    <Table.Td>
                      <Text size="sm" c="dimmed" ff="monospace">
                        {band.color}
                      </Text>
                    </Table.Td>
                  ) : null}
                  <Table.Td>{band.notes ?? '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Stack>
      ))}
    </Stack>
  );
}
