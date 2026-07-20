import { Link, Navigate } from 'react-router-dom';
import { Stack, Table, Text } from '@mantine/core';
import {
  isNeonplugDonorBag,
  summariseNeonplugDonorRetain,
} from '../../services/buildCpsExportService.ts';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

/** Read-only NeonPlug donor settings retained on a DM32UV format build. */
export default function BuildNeonplugSettingsPage() {
  const { build } = useBuildLayout();

  if (build.profileId !== 'neonplug-dm32uv') {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  const donor = isNeonplugDonorBag(build.cpsWireHydration) ? build.cpsWireHydration : null;
  const summary = donor ? summariseNeonplugDonorRetain(donor) : null;

  return (
    <FormPage
      title="NeonPlug settings"
      description={
        <Text size="sm" component="span">
          Read-only view of unmodelled donor settings stored on this build for merge export. Upload
          or replace the donor on <Link to={`/builds/${build.id}/export`}>Export</Link>. Settings
          stay in browser storage only.
        </Text>
      }
    >
      <Stack gap="lg">
        {!donor || !summary ? (
          <FormSection title="No donor stored">
            <Text size="sm">
              Upload a radio-read <code>.neonplug</code> on the{' '}
              <Link to={`/builds/${build.id}/export`}>Export</Link> page to save settings for repeat
              radio-write exports.
            </Text>
          </FormSection>
        ) : (
          <>
            <FormSection title="Donor capture">
              <Table.ScrollContainer minWidth={360}>
                <Table withTableBorder withColumnBorders>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td fw={600}>Source file</Table.Td>
                      <Table.Td>{donor.sourceFileName ?? '—'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Captured</Table.Td>
                      <Table.Td>{new Date(donor.capturedAt).toLocaleString()}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </FormSection>

            <FormSection title="Radio info" description="Retained from the donor on merge.">
              <Table.ScrollContainer minWidth={360}>
                <Table withTableBorder withColumnBorders>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td fw={600}>Model</Table.Td>
                      <Table.Td>{summary.radioInfo.model || '—'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Firmware</Table.Td>
                      <Table.Td>{summary.radioInfo.firmware || '—'}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Build date</Table.Td>
                      <Table.Td>{summary.radioInfo.buildDate || '—'}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </FormSection>

            <FormSection title="Operator radio IDs">
              {summary.radioIdCount === 0 ? (
                <Text size="sm" c="dimmed">
                  No radio IDs in the stored donor.
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={360}>
                  <Table withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Index</Table.Th>
                        <Table.Th>Name</Table.Th>
                        <Table.Th>DMR ID</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {summary.radioIds.map((row) => (
                        <Table.Tr key={`${row.index}-${row.dmrId}`}>
                          <Table.Td>{row.index}</Table.Td>
                          <Table.Td>{row.name}</Table.Td>
                          <Table.Td>{row.dmrId}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </FormSection>

            <FormSection title="Ancillary counts">
              <Table.ScrollContainer minWidth={360}>
                <Table withTableBorder withColumnBorders>
                  <Table.Tbody>
                    <Table.Tr>
                      <Table.Td fw={600}>Quick contacts</Table.Td>
                      <Table.Td>{summary.quickContactCount}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Messages</Table.Td>
                      <Table.Td>{summary.messageCount}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Digital emergencies</Table.Td>
                      <Table.Td>{summary.digitalEmergencyCount}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Analog emergencies</Table.Td>
                      <Table.Td>{summary.analogEmergencyCount}</Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Encryption keys</Table.Td>
                      <Table.Td>
                        {summary.encryptionKeyCount === 0
                          ? 'None'
                          : `${summary.encryptionKeyCount} key${summary.encryptionKeyCount === 1 ? '' : 's'} present`}
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td fw={600}>Digital emergency config</Table.Td>
                      <Table.Td>{summary.hasDigitalEmergencyConfig ? 'Present' : 'None'}</Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </FormSection>

            <FormSection
              title="Radio settings (summary)"
              description="Shallow leaf values only — nested VFOs and bags are retained on merge but not listed here."
            >
              {!summary.hasRadioSettings ? (
                <Text size="sm" c="dimmed">
                  No radioSettings bag in the stored donor.
                </Text>
              ) : Object.keys(summary.radioSettingsPreview).length === 0 ? (
                <Text size="sm" c="dimmed">
                  radioSettings is present (nested objects only — no simple leaf fields to preview).
                </Text>
              ) : (
                <Table.ScrollContainer minWidth={360}>
                  <Table withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Key</Table.Th>
                        <Table.Th>Value</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {Object.entries(summary.radioSettingsPreview).map(([key, value]) => (
                        <Table.Tr key={key}>
                          <Table.Td>{key}</Table.Td>
                          <Table.Td>{String(value)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </FormSection>
          </>
        )}
      </Stack>
    </FormPage>
  );
}
