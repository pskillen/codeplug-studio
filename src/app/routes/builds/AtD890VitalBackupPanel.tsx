/**
 * AT-D890UV vital-data backup on Backup / Restore (#1288).
 * Calibration and identity cannot be recreated. Read-only: no restore.
 */

import { useRef } from 'react';
import { Alert, FileButton, Group, Stack, Table, Text } from '@mantine/core';
import {
  downloadAtD890VitalZip,
  type AtD890VitalSession,
} from '../../services/atD890VitalBackup.ts';
import { FormSection } from '../../components/ui/index.ts';
import { Button } from '../../components/v2/index.ts';

const MAX_RANGES_SHOWN = 24;

function hex(n: number): string {
  return `0x${n.toString(16)}`;
}

export interface AtD890VitalBackupPanelProps {
  busy: boolean;
  serialOk: boolean;
  session: AtD890VitalSession | null;
  onBackup: () => void;
  onOpenFile: (file: File | null) => void;
  onClear: () => void;
}

export default function AtD890VitalBackupPanel({
  busy,
  serialOk,
  session,
  onBackup,
  onOpenFile,
  onClear,
}: AtD890VitalBackupPanelProps) {
  const fileResetRef = useRef<() => void>(null);
  return (
    <FormSection title="Vital data (calibration and identity)">
      <Stack gap="sm">
        <Text size="sm">
          Calibration and identity cannot be recreated if they are lost. Back up vital data once and
          keep the file safe. Studio reads the radio twice and only saves the file when both reads
          match. This does not write to the radio and is not part of a codeplug backup.
        </Text>
        <Alert color="yellow" title="Sensitive file">
          The vital data file contains the radio&apos;s serial number and calibration. Do not share
          it publicly.
        </Alert>
        <Alert color="gray" title="The radio restarts afterwards">
          When the backup finishes Studio ends the programming session and the radio reboots. If the
          radio reports a stun or kill flag, Studio stops without ending the session. Power-cycle
          the radio and try again.
        </Alert>
        <Group gap="sm">
          <Button size="sm" disabled={busy || !serialOk} onClick={onBackup}>
            Back up vital data
          </Button>
          <FileButton
            resetRef={fileResetRef}
            onChange={(f) => {
              onOpenFile(f);
              fileResetRef.current?.();
            }}
            accept=".zip"
          >
            {(props) => (
              <Button size="sm" variant="secondary" disabled={busy} {...props}>
                Open vital data file
              </Button>
            )}
          </FileButton>
          {session ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => downloadAtD890VitalZip(session)}
              >
                Save file again
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
                Clear
              </Button>
            </>
          ) : null}
        </Group>

        {session ? (
          <Stack gap="sm">
            <Text size="sm" fw={600}>
              {session.source === 'live-read' ? 'Backed up' : 'Opened (read only)'}
            </Text>
            <Text size="sm">
              Serial {session.serial || '(unreadable)'}
              {session.manifest.firmware ? ` · ${session.manifest.firmware}` : ''}
              {` · variant ${session.manifest.variant}`}
              {` · ${new Date(session.manifest.capturedAt).toLocaleString()}`}
            </Text>
            {session.rangeSummary ? (
              <Text size="sm">Frequency range: {session.rangeSummary}</Text>
            ) : null}
            <Text size="sm">
              Both reads matched ({session.manifest.readPasses} passes compared byte for byte).
            </Text>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Unit</Table.Th>
                  <Table.Th>Address</Table.Th>
                  <Table.Th>SHA-256</Table.Th>
                  <Table.Th>Non-FF data</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {session.units.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td>
                      {u.label}
                      {u.identicalTo ? (
                        <Text size="xs" c="dimmed">
                          Same bytes as{' '}
                          {session.units.find((o) => o.id === u.identicalTo)?.label ??
                            u.identicalTo}
                          . The radio answered this address with that unit.
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td>
                      <Text ff="monospace" size="sm">
                        {hex(u.address)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text ff="monospace" size="xs" style={{ wordBreak: 'break-all' }}>
                        {u.sha256}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{u.nonFfBytes} bytes</Text>
                      <Text ff="monospace" size="xs">
                        {u.nonFfRanges
                          .slice(0, MAX_RANGES_SHOWN)
                          .map((r) => `${hex(r.start)}–${hex(r.end)}`)
                          .join(', ')}
                        {u.nonFfRanges.length > MAX_RANGES_SHOWN
                          ? ` … (+${u.nonFfRanges.length - MAX_RANGES_SHOWN} more)`
                          : ''}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Text size="sm" fw={600}>
              Local info
            </Text>
            <Table>
              <Table.Tbody>
                {session.localInfoRows.map((row) => (
                  <Table.Tr key={row.offset}>
                    <Table.Td>
                      <Text ff="monospace" size="sm">
                        {row.offset}
                      </Text>
                    </Table.Td>
                    <Table.Td>{row.label}</Table.Td>
                    <Table.Td>{row.value}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        ) : null}
      </Stack>
    </FormSection>
  );
}
