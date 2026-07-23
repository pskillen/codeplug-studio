/**
 * Read-only view of Web Serial radio-clone hydration on a Direct radio FormatBuild.
 * Sibling to NeonPlug settings — unmodelled retain for write-back, not library fields.
 */

import { Link, Navigate } from 'react-router-dom';
import { Stack, Table, Text } from '@mantine/core';
import { isRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import {
  summariseUv5rMiniClone,
  UV5R_MINI_MODEL_ID,
} from '@integrations/radio-io/radios/uv5r-mini/index.ts';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

function hexOffset(n: number): string {
  return `0x${n.toString(16).toUpperCase()}`;
}

export default function BuildRadioImageSettingsPage() {
  const { build } = useBuildLayout();

  if (build.formatId !== 'radio-io') {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  const bag = isRadioCloneHydrationBag(build.cpsWireHydration) ? build.cpsWireHydration : null;
  const isUv5rMini = bag?.retain.radioModelId === UV5R_MINI_MODEL_ID;
  const summary = bag && isUv5rMini ? summariseUv5rMiniClone(bag) : null;

  return (
    <FormPage
      title="Radio image"
      description={
        <Text size="sm" component="span">
          Read-only view of the clone image stored on this build after{' '}
          <Link to={`/builds/${build.id}/export`}>Read from radio</Link>. Unmodelled regions (VFO,
          settings, ANI) are retained for Write so they survive channel updates from the library.
          Settings are not editable in Studio.
        </Text>
      }
    >
      <Stack gap="lg">
        {!bag ? (
          <FormSection title="No radio image stored">
            <Text size="sm">
              Use <strong>Read from radio</strong> on the{' '}
              <Link to={`/builds/${build.id}/export`}>Export</Link> page to download a clone image
              into this build. Write stays blocked until a Read succeeds.
            </Text>
          </FormSection>
        ) : !summary ? (
          <FormSection title="Stored image">
            <Text size="sm">
              A radio-clone image is stored (model {bag.retain.radioModelId},{' '}
              {bag.retain.imageByteLength} bytes), but this build profile has no labelled summary
              yet. The opaque image is still used on Write.
            </Text>
          </FormSection>
        ) : (
          <>
            <FormSection title="Capture">
              <Table.ScrollContainer minWidth={360}>
                <Table withTableBorder withColumnBorders>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td fw={600}>Source</Table.Td>
                      <Table.Td>{bag.sourceFileName ?? '—'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Captured</Table.Td>
                      <Table.Td>{new Date(bag.capturedAt).toLocaleString()}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Via</Table.Td>
                      <Table.Td>{summary.capturedVia}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </FormSection>

            <FormSection
              title="Radio info"
              description="Parsed from the stored clone image where available."
            >
              <Table.ScrollContainer minWidth={360}>
                <Table withTableBorder withColumnBorders>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td fw={600}>Model</Table.Td>
                      <Table.Td>{summary.radioModelId}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Firmware</Table.Td>
                      <Table.Td>{summary.firmware?.trim() || '—'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Image size</Table.Td>
                      <Table.Td>
                        {summary.imageByteLength} bytes ({hexOffset(summary.imageByteLength)})
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Occupied channels on radio</Table.Td>
                      <Table.Td>
                        {summary.occupiedChannelCount} occupied · {summary.emptyChannelSlots} empty
                        slots (decoded from image — Write still uses library + assemble)
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </FormSection>

            <FormSection
              title="Retained regions"
              description="Channels are overwritten from the library on Write. Other regions stay as opaque bytes from Read — Studio does not model them yet (unlike NeonPlug JSON settings bags)."
            >
              <Table.ScrollContainer minWidth={480}>
                <Table withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Region</Table.Th>
                      <Table.Th>Packed offset</Table.Th>
                      <Table.Th>Size</Table.Th>
                      <Table.Th>On Write</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {summary.regions.map((region) => (
                      <Table.Tr key={region.label}>
                        <Table.Td>{region.label}</Table.Td>
                        <Table.Td>{hexOffset(region.packedOffset)}</Table.Td>
                        <Table.Td>{region.sizeBytes} bytes</Table.Td>
                        <Table.Td>{region.role}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </FormSection>
          </>
        )}
      </Stack>
    </FormPage>
  );
}
