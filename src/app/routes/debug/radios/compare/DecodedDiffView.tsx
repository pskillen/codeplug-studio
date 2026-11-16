import type {
  DecodedDiff,
  DecodedIdentity,
  FieldDiff,
  RecordDiff,
  RecordDiffKind,
} from '@integrations/radio-io/debugCompare/index.ts';
import {
  Badge,
  Button,
  Group,
  Mark,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { SensitiveRevealButton } from '@app/components/debug/index.ts';

export const ALL_CATEGORIES = 'all';
const PAGE_SIZE = 30;

const KIND_COLOR: Record<RecordDiffKind, string> = {
  changed: 'yellow',
  added: 'teal',
  removed: 'red',
  unchanged: 'gray',
  incomparable: 'gray',
};
const KIND_LABEL: Record<RecordDiffKind, string> = {
  changed: 'changed',
  added: 'added',
  removed: 'removed',
  unchanged: 'unchanged',
  incomparable: 'not comparable',
};

/** Callsign first, then name; the name alone when there is no callsign. */
export function identityText(id: DecodedIdentity | undefined): string {
  if (!id) return '';
  return [id.callsign, id.name].filter(Boolean).join(' ');
}

function headline(r: RecordDiff): string {
  const slot = r.slot === undefined ? '' : `Slot ${r.slot}`;
  const a = identityText(r.identityA);
  const b = identityText(r.identityB);
  const current = b || a;
  const was = a && b && a !== b ? ` (was ${a})` : '';
  return [slot, `${current}${was}`.trim()].filter(Boolean).join(' · ') || r.key;
}

function Cell({ field, side, revealed }: { field: FieldDiff; side: 'a' | 'b'; revealed: boolean }) {
  const value = field[side];
  let text: string;
  if (field.kind === 'incomparable' && value === undefined) text = 'Not captured';
  else if (value === undefined) text = field.sensitive && !revealed ? '••' : '—';
  else text = value;
  const changed = field.kind === 'changed' || field.kind === 'added' || field.kind === 'removed';
  return (
    <Table.Td>
      {changed ? (
        <Mark color="yellow" fw={700}>
          {text}
        </Mark>
      ) : (
        text
      )}
    </Table.Td>
  );
}

function Record({
  record,
  onlyChanges,
  revealed,
}: {
  record: RecordDiff;
  onlyChanges: boolean;
  revealed: boolean;
}) {
  const fields = onlyChanges ? record.fields.filter((f) => f.kind !== 'unchanged') : record.fields;
  return (
    <Stack gap={4} role="group" aria-label={headline(record)}>
      <Group gap="xs">
        <Text fw={600}>{headline(record)}</Text>
        <Badge color={KIND_COLOR[record.kind]}>{KIND_LABEL[record.kind]}</Badge>
      </Group>
      {record.note && (
        <Text size="xs" c="dimmed">
          {record.note}
        </Text>
      )}
      {record.caveats.map((c) => (
        <Text key={c} size="xs" c="dimmed">
          {c}
        </Text>
      ))}
      {fields.length > 0 && (
        <Table withTableBorder aria-label={`${headline(record)} fields`}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Field</Table.Th>
              <Table.Th>A</Table.Th>
              <Table.Th>B</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {fields.map((f) => {
              const maskedChange = f.kind === 'changed' && f.sensitive && !revealed;
              return (
                <Table.Tr key={f.id}>
                  <Table.Td>{f.label}</Table.Td>
                  {maskedChange ? (
                    <Table.Td colSpan={2}>
                      <Mark color="yellow" fw={700}>
                        changed
                      </Mark>
                    </Table.Td>
                  ) : (
                    <>
                      <Cell field={f} side="a" revealed={revealed} />
                      <Cell field={f} side="b" revealed={revealed} />
                    </>
                  )}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

/**
 * The decoded diff: one block per changed record with its fields as A and B, changed cells
 * marked. Radio-neutral; the diff comes from the descriptor's adapter via `diffDecoded`. The
 * parent owns category, only-changes and reveal so the summary can jump here.
 */
export function DecodedDiffView({
  diff,
  category,
  onCategoryChange,
  onlyChanges,
  onOnlyChangesChange,
  revealed,
  onToggleReveal,
}: {
  diff: DecodedDiff;
  category: string;
  onCategoryChange: (value: string) => void;
  onlyChanges: boolean;
  onOnlyChangesChange: (value: boolean) => void;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const inCategory = diff.records.filter(
    (r) => category === ALL_CATEGORIES || r.domainId === category,
  );
  const shown = onlyChanges ? inCategory.filter((r) => r.kind !== 'unchanged') : inCategory;
  const domains = diff.domains.filter((d) => category === ALL_CATEGORIES || d.id === category);
  const sensitiveChanged = diff.records.some((r) =>
    r.fields.some((f) => f.sensitive && f.kind === 'changed'),
  );
  const domainLabel = new Map(diff.domains.map((d) => [d.id, d.label]));
  return (
    <Stack gap="sm">
      <Title order={4}>Decoded changes</Title>
      <Group align="flex-end" gap="md">
        <Select
          label="Category"
          value={category}
          allowDeselect={false}
          data={[
            { value: ALL_CATEGORIES, label: 'All' },
            ...diff.domains.map((d) => ({ value: d.id, label: d.label })),
          ]}
          onChange={(value) => {
            if (!value) return;
            setLimit(PAGE_SIZE);
            onCategoryChange(value);
          }}
        />
        <Switch
          label="Only changes"
          checked={onlyChanges}
          onChange={(event) => {
            setLimit(PAGE_SIZE);
            onOnlyChangesChange(event.currentTarget.checked);
          }}
        />
      </Group>
      {sensitiveChanged && (
        <Group gap="xs">
          <Text size="sm">Password values are {revealed ? 'shown' : 'hidden'}.</Text>
          <SensitiveRevealButton revealed={revealed} onToggle={onToggleReveal} />
        </Group>
      )}
      {domains
        .filter((d) => d.note)
        .map((d) => (
          <Text key={d.id} size="xs" c="dimmed">
            {d.label}: {d.note}
          </Text>
        ))}
      {shown.length === 0 && (
        <Text>{onlyChanges ? 'No decoded changes.' : 'No decoded records.'}</Text>
      )}
      {shown.slice(0, limit).map((r, i) => (
        <Stack key={`${r.domainId}:${r.key}`} gap={4}>
          {(i === 0 || shown[i - 1]!.domainId !== r.domainId) && category === ALL_CATEGORIES && (
            <Text size="sm" fw={700} mt="xs">
              {domainLabel.get(r.domainId)}
            </Text>
          )}
          <Record record={r} onlyChanges={onlyChanges} revealed={revealed} />
        </Stack>
      ))}
      {shown.length > limit && (
        <Button variant="light" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
          Show more ({(shown.length - limit).toLocaleString()} remaining)
        </Button>
      )}
    </Stack>
  );
}
