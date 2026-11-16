import { Alert, Badge, Code, Group, Select, Stack, Table, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';

import { PageSection } from '@app/components/ui/index.ts';
import {
  decodeUv5rMiniSettings,
  decodeUv5rMiniVfo,
  type Uv5rMiniFrameCounts,
  type Uv5rMiniFrameFieldValue,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';

import { formatHexAddress as addr, formatHexByte as h2 } from './uv5rMiniHexRows.ts';
import type { Uv5rMiniDebugRead } from './uv5rMiniDebugReads.ts';

function ConfidenceBadge({ row }: { row: Uv5rMiniFrameFieldValue }) {
  if (row.field.kind === 'no-reader') {
    return (
      <Badge variant="light" color="gray">
        unused (no reader)
      </Badge>
    );
  }
  return (
    <Badge variant="light" color={row.field.confidence === 'traced' ? 'green' : 'yellow'}>
      {row.field.confidence === 'traced' ? 'traced' : 'partly traced'}
    </Badge>
  );
}

function FrameTable({
  rows,
  testId,
  columns,
}: {
  rows: readonly (readonly Uv5rMiniFrameFieldValue[])[];
  testId: string;
  columns: readonly string[];
}) {
  const first = rows[0];
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table striped fz="sm" data-testid={testId}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Address</Table.Th>
            <Table.Th>Field</Table.Th>
            {columns.map((c) => (
              <Table.Th key={c}>{c}</Table.Th>
            ))}
            <Table.Th>Encoding</Table.Th>
            <Table.Th>Default</Table.Th>
            <Table.Th>Confidence</Table.Th>
            <Table.Th>Evidence</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {first.map((row, i) => (
            <Table.Tr key={`${row.field.offset}-${row.field.name}`}>
              <Table.Td>
                <Code>{addr(row.address)}</Code>
                {row.field.length > 1 ? ` +${row.field.length}` : ''}
              </Table.Td>
              <Table.Td>{row.field.name}</Table.Td>
              {rows.map((side, s) => (
                <Table.Td
                  key={columns[s]}
                  c={row.field.kind === 'no-reader' ? 'dimmed' : undefined}
                >
                  {side[i].text}{' '}
                  <Text span size="xs" c="dimmed">
                    ({Array.from(side[i].bytes, h2).join(' ')})
                  </Text>
                </Table.Td>
              ))}
              <Table.Td>{row.field.encoding}</Table.Td>
              <Table.Td>{row.field.defaultText}</Table.Td>
              <Table.Td>
                <ConfidenceBadge row={row} />
              </Table.Td>
              <Table.Td>{row.field.evidence}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function countsText(c: Uv5rMiniFrameCounts): string {
  const unread = c.noReader === 1 ? '1 byte' : `${c.noReader} bytes`;
  return `${c.named} bytes named (${c.traced} traced, ${c.partly} inferred), ${unread} unused (no reader).`;
}

/**
 * The settings frame (`0x9000–0x903F`) and VFO frame (`0x8000–0x803F`) tables decoded from one full decoded clone
 * (0x10000 bytes). Shared by the old `/debug/uv5r-mini` page and the radio debug page's Settings tab. It decodes
 * bytes already read: nothing here writes, copies or sends them.
 */
export function Uv5rMiniSettingsFrames({ decoded }: { decoded: Uint8Array }) {
  const settings = useMemo(() => decodeUv5rMiniSettings(decoded), [decoded]);
  const vfo = useMemo(() => decodeUv5rMiniVfo(decoded), [decoded]);
  return (
    <>
      <Text size="sm" c="dimmed">
        Evidence is a v0.04 firmware address, or a radio repo ledger id (F302-F309, PR #219); v0.27
        runs the same code relocated. Confidence: traced is code address and meaning; partly traced
        is a traced use with an inferred name. A byte shown as unused (no reader) has no reference
        in either build, which does not rule out a computed pointer access. Nothing in the settings
        frame is sensitive.
      </Text>

      <Stack gap="xs">
        <Group gap="xs">
          <Title order={4}>Settings frame</Title>
          <Code>0x9000–0x903F</Code>
        </Group>
        <Text size="sm">{countsText(settings.counts)}</Text>
        {settings.empty ? (
          <Alert color="yellow" title="Settings frame reads as blank">
            Every byte of 0x9000–0x903F reads the same (0x00 or 0xFF): the radio would load its
            defaults.
          </Alert>
        ) : null}
        <FrameTable
          rows={[settings.fields]}
          testId="uv5r-mini-settings-frame"
          columns={['Value']}
        />
      </Stack>

      <Stack gap="xs">
        <Group gap="xs">
          <Title order={4}>VFO frame</Title>
          <Code>0x8000–0x803F</Code>
        </Group>
        <Text size="sm">
          Two 32-byte records, A then B. {countsText(vfo.counts)} Busy lockout in VFO mode is
          settings byte 0x0F, not here. CHIRP has 6 offset digits and its squelch mode at +0x1C; the
          firmware writes 7 digits and SP-Mute at +0x1B.
        </Text>
        <FrameTable
          rows={vfo.sides.map((s) => s.fields)}
          testId="uv5r-mini-vfo-frame"
          columns={vfo.sides.map((s) => `VFO ${s.side}`)}
        />
      </Stack>
    </>
  );
}

/**
 * Read-only view of a read's settings frame and VFO frame. It decodes the bytes of the read already taken:
 * nothing here writes, copies or sends them.
 */
export default function Uv5rMiniSettingsSection({
  reads,
}: {
  reads: readonly Uv5rMiniDebugRead[];
}) {
  const [label, setLabel] = useState<string | null>(null);
  const read = reads.find((r) => r.label === label) ?? reads.at(-1);
  const options = reads.map((r) => ({ value: r.label, label: r.label }));

  return (
    <PageSection
      title="Settings and VFO"
      description="0x9000–0x903F (settings) and 0x8000–0x803F (VFO A, B) of one read, named from the radio repo's static trace. View only."
    >
      {!read ? (
        <Text size="sm" c="dimmed">
          Take a read to view its settings.
        </Text>
      ) : (
        <Stack gap="lg" data-testid="uv5r-mini-settings">
          <Select
            label="Read"
            data={options}
            value={read.label}
            onChange={(v) => setLabel(v)}
            allowDeselect={false}
          />
          <Uv5rMiniSettingsFrames decoded={read.decoded} />
        </Stack>
      )}
    </PageSection>
  );
}
