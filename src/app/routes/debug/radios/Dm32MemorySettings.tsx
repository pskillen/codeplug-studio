import { Alert, Badge, Group, Stack, Switch, Table, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  DM32_SETTINGS_GROUPS,
  DM32_SETTINGS_LAYOUT_BASIS,
  type Dm32DocumentedRangeView,
  type Dm32SettingConfidence,
  type Dm32SettingFieldView,
  type Dm32SettingsInventory,
  type Dm32UnusedRangeView,
} from '@integrations/radio-io/radios/dm32uv/debugMemorySettings.ts';
import { SensitiveRevealButton } from './SensitiveReveal.tsx';
import { MASKED_HEX_BYTE } from './viewerUtils.ts';

const NOT_CAPTURED = 'Not captured';
const DASH = '—';
const count = (n: number) => n.toLocaleString('en-GB');
const hexByte = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');
const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(8, '0')}`;
const hexBytes = (bytes: readonly number[]) => bytes.map(hexByte).join(' ');
const matches = (query: string, ...haystack: string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

const CONFIDENCE: Record<Dm32SettingConfidence, { label: string; color: string }> = {
  traced: { label: 'Traced', color: 'green' },
  'partially-traced': { label: 'Partly traced', color: 'yellow' },
  unknown: { label: 'Unknown', color: 'gray' },
};

const UNUSED_KIND_LABEL = {
  free: 'Free',
  unread: 'Unused (no reader)',
  'mm9pdy-reserved': 'MM9PDY reserved',
} as const;

function addressText(f: { address: number; length: number; mask?: number }): string {
  const span = f.length > 1 ? `${hexAddress(f.address)} +${f.length}` : hexAddress(f.address);
  return f.mask === undefined ? span : `${span} mask 0x${hexByte(f.mask)}`;
}

function rawText(f: { raw?: number[] }): string {
  return f.raw ? hexBytes(f.raw) : DASH;
}

/** Read-only grouped view of the DM-32UV settings page (tag 0x04). */
export function SettingsPanel({
  settings,
  revealed = false,
  onToggleReveal,
}: {
  settings: Dm32SettingsInventory;
  /** Whether password fields are shown; hidden unless the viewer reveals them. */
  revealed?: boolean;
  onToggleReveal?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [raw, setRaw] = useState(false);
  const groups = useMemo(
    () =>
      settings.status !== 'captured'
        ? []
        : DM32_SETTINGS_GROUPS.map((g) => ({
            ...g,
            fields: settings.fields.filter((f) => f.group === g.id),
          })),
    [settings],
  );
  if (settings.status !== 'captured')
    return (
      <Alert
        title={settings.status === 'ambiguous' ? 'Several pages, not decoded' : NOT_CAPTURED}
        color="yellow"
      >
        {settings.reason}
        {settings.status === 'ambiguous'
          ? ` Addresses: ${settings.addresses.map(hexAddress).join(', ')}.`
          : ''}{' '}
        This does not mean the radio has default settings.
      </Alert>
    );
  const { counts } = settings;
  const searching = query.trim() !== '';
  const hidden = (f: Dm32SettingFieldView) => f.sensitive && !revealed;
  const valueText = (f: Dm32SettingFieldView): string => {
    if (f.status === 'not-captured') return NOT_CAPTURED;
    if (hidden(f)) return 'Hidden (password)';
    if (f.value === undefined) return 'Not interpreted (see raw bytes)';
    return f.value === '' ? '(empty)' : f.value;
  };
  const fieldRawText = (f: Dm32SettingFieldView) =>
    !f.raw ? DASH : hidden(f) ? f.raw.map(() => MASKED_HEX_BYTE).join(' ') : hexBytes(f.raw);
  const unusedMatches = (u: Dm32UnusedRangeView) =>
    matches(
      query,
      'unused free reserved no reader',
      UNUSED_KIND_LABEL[u.kind],
      u.label,
      addressText(u),
    );
  const unusedShown = settings.unused.filter((u) => !searching || unusedMatches(u));
  const fieldMatches = (f: Dm32SettingFieldView, groupLabel: string) =>
    matches(
      query,
      f.label,
      f.id,
      f.help ?? '',
      groupLabel,
      valueText(f),
      fieldRawText(f),
      CONFIDENCE[f.confidence].label,
      addressText(f),
    );
  const rangeMatches = (r: Dm32DocumentedRangeView) =>
    matches(query, 'documented not decoded', r.label, rawText(r), addressText(r));
  const rangesShown = settings.documented.filter((r) => !searching || rangeMatches(r));
  const unknownShown = settings.unknown.filter(
    (u) => !searching || matches(query, 'unknown', hexAddress(u.address), hexBytes(u.raw)),
  );
  return (
    <Stack gap="sm">
      <Text>
        {count(counts.captured)} of {count(counts.registered)} known setting fields captured ·{' '}
        {count(counts.decoded)} decoded to a value · {count(counts.traced)} traced,{' '}
        {count(counts.partiallyTraced)} partly traced, {count(counts.unknownConfidence)} unknown ·{' '}
        {count(counts.documentedRangesCaptured)} of {count(counts.documentedRanges)}{' '}
        documented-not-decoded ranges captured · {count(counts.unusedBytes)} unused bytes in{' '}
        {count(counts.unusedRanges)} ranges · {count(counts.unknownBytes)} unknown bytes
      </Text>
      <Text size="sm" c="dimmed">
        Read-only view of the settings page at {hexAddress(settings.address)} (tag 0x04). Layout
        basis: {DM32_SETTINGS_LAYOUT_BASIS}. Each field is shown only when every byte of its own
        span was captured; missing bytes stay missing and are never filled with defaults. Only the
        first 0x508 bytes carry layout. The bytes alone do not show which firmware is installed.
        Nothing here edits the radio or reads it again.
      </Text>
      <Text size="sm" c="dimmed">
        Emergency systems and encryption keys are outside this view and are not shown; they remain
        only in the Hex tab.
      </Text>
      <Stack gap="xs">
        <TextInput
          label="Search settings"
          placeholder="Search settings"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <Group gap="md" align="center">
          <Switch
            label="Show raw bytes + address"
            checked={raw}
            onChange={(e) => setRaw(e.currentTarget.checked)}
          />
          {onToggleReveal && (
            <SensitiveRevealButton revealed={revealed} onToggle={onToggleReveal} />
          )}
        </Group>
      </Stack>
      {groups.map((g) => {
        const fields = g.fields.filter((f) => !searching || fieldMatches(f, g.label));
        if (fields.length === 0) {
          if (searching) return null;
          return (
            <Stack key={g.id} gap="xs" component="section" aria-label={g.label}>
              <Title order={4}>{g.label}</Title>
              <Text size="sm" c="dimmed">
                No documented setting is decoded in this group.
              </Text>
            </Stack>
          );
        }
        return (
          <Stack key={g.id} gap="xs" component="section" aria-label={g.label}>
            <Title order={4}>{g.label}</Title>
            <Table.ScrollContainer minWidth={320}>
              <Table aria-label={`${g.label} settings`}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Setting</Table.Th>
                    <Table.Th>Value</Table.Th>
                    <Table.Th>Confidence</Table.Th>
                    {raw && <Table.Th>Address</Table.Th>}
                    {raw && <Table.Th>Raw bytes</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {fields.map((f) => (
                    <Table.Tr key={f.id}>
                      <Table.Td>
                        {f.label}
                        {f.help && (
                          <Text size="xs" c="dimmed">
                            {f.help}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {valueText(f)}
                        {!raw && f.status === 'captured' && f.value === undefined && (
                          <Text size="xs" c="dimmed">
                            Raw {hexAddress(f.address)}: {fieldRawText(f)}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={CONFIDENCE[f.confidence].color} variant="light">
                          {CONFIDENCE[f.confidence].label}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {f.source}
                        </Text>
                      </Table.Td>
                      {raw && <Table.Td>{addressText(f)}</Table.Td>}
                      {raw && <Table.Td>{fieldRawText(f)}</Table.Td>}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        );
      })}
      {(rangesShown.length > 0 || !searching) && (
        <Stack gap="xs" component="section" aria-label="Documented, not decoded">
          <Title order={4}>Documented, not decoded</Title>
          <Text size="sm" c="dimmed">
            The firmware reads these areas, but their record contents are not decoded here. They are
            shown as raw bytes only.
          </Text>
          {rangesShown.map((r) => (
            <Text size="sm" key={r.id} ff="monospace">
              {r.label} · {CONFIDENCE[r.confidence].label} · {addressText(r)}:{' '}
              {r.status === 'captured' ? rawText(r) : NOT_CAPTURED}
            </Text>
          ))}
        </Stack>
      )}
      {(unusedShown.length > 0 || !searching) && (
        <Stack gap="xs" component="section" aria-label="Unused bytes">
          <Title order={4}>Unused bytes</Title>
          <Text size="sm" c="dimmed">
            Bytes the stock firmware never reads: free, not read by 048 (the vendor CPS may still
            write them), or reserved for MM9PDY. Their contents are listed only with the raw-bytes
            switch on.
          </Text>
          {unusedShown.map((u) => (
            <Text size="sm" key={u.id} ff="monospace">
              {UNUSED_KIND_LABEL[u.kind]} · {addressText(u)}
              {raw && `: ${u.status === 'captured' ? rawText(u) : NOT_CAPTURED}`}
              <Text size="xs" c="dimmed" component="span" ff="sans-serif">
                {' '}
                {u.label}
              </Text>
            </Text>
          ))}
        </Stack>
      )}
      <Stack gap="xs" component="section" aria-label="Unknown bytes">
        <Title order={4}>Unknown bytes</Title>
        <Text size="sm" c="dimmed">
          Captured bytes in the first 0x508 bytes that no known field, documented area or unused
          range covers. They are unexplained, not zero. {count(counts.unknownBytes)} bytes in{' '}
          {count(settings.unknown.length)} runs.
        </Text>
        {unknownShown.length === 0 ? (
          <Text size="sm">
            {settings.unknown.length === 0
              ? 'No unexplained captured bytes.'
              : `No unknown bytes match “${query.trim()}”.`}
          </Text>
        ) : (
          unknownShown.map((u) => (
            <Text size="sm" key={u.address} ff="monospace">
              {hexAddress(u.address)}: {hexBytes(u.raw)}
            </Text>
          ))
        )}
      </Stack>
    </Stack>
  );
}
