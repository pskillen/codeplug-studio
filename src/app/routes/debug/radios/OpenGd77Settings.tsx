import { Alert, Card, Stack, Table, Text, Title } from '@mantine/core';
import { OPENGD77_SETTINGS_ADDRESS } from '@core/radios/opengd77/settings.ts';
import { selectOpenGd77Settings } from '@integrations/radio-io/radios/opengd77/debugSettings.ts';
import type { DebugArchive } from './captureArchive.ts';

const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, '0');
const rawText = (raw?: Uint8Array) => (raw ? Array.from(raw, (b) => hex(b)).join(' ') : '—');

const SETTINGS_HEADERS = [
  'Member',
  'Address',
  'Type',
  'Raw',
  'Value',
  'Meaning',
  'Confidence',
  'Reader',
  'Evidence',
];

/**
 * Read-only view of the OpenGD77 firmware settings struct and the codeplug general settings,
 * decoded from the captured FLASH spans. It never reads a radio; whatever the capture does not
 * hold shows as not captured.
 */
export function OpenGd77Settings({ archive }: { archive: DebugArchive }) {
  const selection = selectOpenGd77Settings(archive);
  if (selection.status === 'unavailable') {
    return (
      <Alert color="yellow" title="Settings unavailable">
        {selection.reason}. The Hex tab still shows the stored bytes.
      </Alert>
    );
  }
  const { settings, general, model } = selection;
  const groups = Array.from(new Set(general.map((r) => r.group)));
  return (
    <Stack gap="sm">
      <Alert title="Firmware settings, read-only">
        Layout read from OpenGD77 firmware sources dated 2026-01-30 (DM-1701 family) and 2026-01-31
        (MD-9600); not validated on hardware. Nothing on this page is written to the radio.
      </Alert>
      {settings.status === 'ok' && (
        <>
          <Text size="sm">
            {model.label} · settings struct at 0x{hex(OPENGD77_SETTINGS_ADDRESS, 4)}, size 0x
            {hex(settings.size)} · {settings.provenance}
          </Text>
          <Text size="sm">
            {settings.capturedBytes} of {settings.memberBytes} member bytes are in this capture
            {settings.paddingBytes > 0
              ? `; ${settings.paddingBytes} struct padding bytes carry no member`
              : ''}
            . The size assumes 1-byte enums (inferred).
          </Text>
          <Card withBorder>
            <Title order={4}>Firmware settings</Title>
            <Table.ScrollContainer minWidth={900}>
              <Table striped fz="sm">
                <Table.Caption>Firmware settings</Table.Caption>
                <Table.Thead>
                  <Table.Tr>
                    {SETTINGS_HEADERS.map((h) => (
                      <Table.Th key={h}>{h}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {settings.members.map((m) => (
                    <Table.Tr key={m.id} data-row-id={`setting-${m.id}`}>
                      <Table.Td>{m.name}</Table.Td>
                      <Table.Td>
                        0x{hex(OPENGD77_SETTINGS_ADDRESS + m.offset, 4)} (+0x{hex(m.offset)})
                      </Table.Td>
                      <Table.Td>{m.type}</Table.Td>
                      <Table.Td ff="monospace">{rawText(m.raw)}</Table.Td>
                      <Table.Td>
                        {m.state === 'captured'
                          ? m.value
                          : m.state === 'partly-captured'
                            ? 'Partly captured'
                            : 'Not captured'}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">
                          {m.meaning}
                          {m.note ? ` ${m.note}` : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>{m.confidence}</Table.Td>
                      <Table.Td>{m.hasReader ? 'read by OpenGD77' : 'unused (no reader)'}</Table.Td>
                      <Table.Td>
                        <Text size="xs">{m.evidence}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </>
      )}
      {settings.status === 'not-captured' && (
        <Alert color="yellow" title="Firmware settings not captured">
          {settings.reason}
        </Alert>
      )}
      {settings.status === 'refused' && (
        <Alert color="red" title="Firmware settings not decoded">
          {settings.reason}
        </Alert>
      )}
      {groups.map((group) => (
        <Card withBorder key={group}>
          <Title order={4}>Codeplug {group}</Title>
          <Table.ScrollContainer minWidth={720}>
            <Table striped fz="sm">
              <Table.Caption>{group}</Table.Caption>
              <Table.Thead>
                <Table.Tr>
                  {['Field', 'Address', 'Width', 'Raw', 'Value', 'Use in OpenGD77'].map((h) => (
                    <Table.Th key={h}>{h}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {general
                  .filter((r) => r.group === group)
                  .map((r) => (
                    <Table.Tr key={r.id} data-row-id={`general-${r.id}`}>
                      <Table.Td>{r.name}</Table.Td>
                      <Table.Td>0x{hex(r.abs, 4)}</Table.Td>
                      <Table.Td>{r.length}</Table.Td>
                      <Table.Td ff="monospace">{rawText(r.raw)}</Table.Td>
                      <Table.Td>{r.captured ? (r.value ?? 'Raw only') : 'Not captured'}</Table.Td>
                      <Table.Td>
                        <Text size="xs">{r.hasReader ? r.meaning : 'unused (no reader)'}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      ))}
    </Stack>
  );
}
