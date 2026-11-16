import { Alert, Stack, Switch, Table, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  DM32_SETTINGS_GROUPS,
  DM32_SETTINGS_LAYOUT_BASIS,
  type Dm32DocumentedRangeView,
  type Dm32SettingFieldView,
  type Dm32SettingsInventory,
} from '@integrations/radio-io/radios/dm32uv/debugMemorySettings.ts';

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

function valueText(f: Dm32SettingFieldView): string {
  if (f.status === 'not-captured') return NOT_CAPTURED;
  if (f.value === undefined) return 'Not interpreted (see raw bytes)';
  return f.value === '' ? '(empty)' : f.value;
}

function addressText(f: { address: number; length: number; mask?: number }): string {
  const span = f.length > 1 ? `${hexAddress(f.address)} +${f.length}` : hexAddress(f.address);
  return f.mask === undefined ? span : `${span} mask 0x${hexByte(f.mask)}`;
}

function rawText(f: { raw?: number[] }): string {
  return f.raw ? hexBytes(f.raw) : DASH;
}

/** Read-only grouped view of the DM-32UV settings page (tag 0x04). */
export function SettingsPanel({ settings }: { settings: Dm32SettingsInventory }) {
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
  const fieldMatches = (f: Dm32SettingFieldView, groupLabel: string) =>
    matches(
      query,
      f.label,
      f.id,
      f.help ?? '',
      groupLabel,
      valueText(f),
      rawText(f),
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
        {count(counts.decoded)} decoded to a value · {count(counts.documentedRangesCaptured)} of{' '}
        {count(counts.documentedRanges)} documented-not-decoded ranges captured ·{' '}
        {count(counts.unknownBytes)} unknown bytes
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
        <Switch
          label="Show raw bytes + address"
          checked={raw}
          onChange={(e) => setRaw(e.currentTarget.checked)}
        />
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
                            Raw {hexAddress(f.address)}: {rawText(f)}
                          </Text>
                        )}
                      </Table.Td>
                      {raw && <Table.Td>{addressText(f)}</Table.Td>}
                      {raw && <Table.Td>{rawText(f)}</Table.Td>}
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
            The reference names these areas, but no meaning is decoded here. They are shown as raw
            bytes only.
          </Text>
          {rangesShown.map((r) => (
            <Text size="sm" key={r.id} ff="monospace">
              {r.label} · {addressText(r)}: {r.status === 'captured' ? rawText(r) : NOT_CAPTURED}
            </Text>
          ))}
        </Stack>
      )}
      <Stack gap="xs" component="section" aria-label="Unknown bytes">
        <Title order={4}>Unknown bytes</Title>
        <Text size="sm" c="dimmed">
          Captured bytes in the first 0x508 bytes that no known field or documented area covers.
          They are unexplained, not zero. {count(counts.unknownBytes)} bytes in{' '}
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
