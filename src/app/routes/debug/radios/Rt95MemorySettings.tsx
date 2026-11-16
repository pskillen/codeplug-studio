import { Badge, Group, Stack, Switch, Table, Text, TextInput, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  RT95_SETTINGS_GROUPS,
  type Rt95SettingFieldView,
  type Rt95SettingsInventory,
} from '@integrations/radio-io/radios/rt95/debugMemorySettings.ts';
import { MASKED_HEX_BYTE } from './viewerUtils.ts';
import { SensitiveRevealButton } from './SensitiveReveal.tsx';

const DASH = '—';
const NOT_CAPTURED = 'Not captured';
const hexByte = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');
const hexAddress = (a: number) => `0x${a.toString(16).toUpperCase().padStart(8, '0')}`;
const hexBytes = (bytes: readonly number[]) => bytes.map(hexByte).join(' ');
const matches = (query: string, ...haystack: string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

function addressText(f: { address: number; length: number; mask?: number }): string {
  const span = f.length > 1 ? `${hexAddress(f.address)} +${f.length}` : hexAddress(f.address);
  return f.mask === undefined ? span : `${span} mask 0x${hexByte(f.mask)}`;
}

/** Read-only grouped view of the RT95 settings held in the clone image. */
export function Rt95SettingsPanel({
  settings,
  revealed,
  onToggleReveal,
}: {
  settings: Rt95SettingsInventory;
  revealed: boolean;
  onToggleReveal: () => void;
}) {
  const [query, setQuery] = useState('');
  const [raw, setRaw] = useState(false);
  const groups = useMemo(
    () =>
      RT95_SETTINGS_GROUPS.map((g) => ({
        ...g,
        fields: settings.fields.filter((f) => f.group === g.id),
      })),
    [settings],
  );
  const searching = query.trim() !== '';
  const hidden = (f: Rt95SettingFieldView) => f.sensitive && !revealed;
  const valueText = (f: Rt95SettingFieldView) => {
    if (f.status === 'not-captured') return NOT_CAPTURED;
    if (hidden(f)) return 'Hidden (power-on password)';
    return f.value ?? 'Not interpreted (see raw bytes)';
  };
  const rawText = (f: Rt95SettingFieldView) =>
    !f.raw ? DASH : hidden(f) ? f.raw.map(() => MASKED_HEX_BYTE).join(' ') : hexBytes(f.raw);
  const fieldMatches = (f: Rt95SettingFieldView, groupLabel: string) =>
    matches(
      query,
      f.label,
      f.id,
      f.help,
      groupLabel,
      f.trust,
      f.advanced ? 'advanced' : '',
      f.targets.join(' '),
      valueText(f),
      rawText(f),
      addressText(f),
    );
  const unclaimedShown = settings.unclaimed.filter(
    (u) =>
      !searching ||
      matches(query, 'unclaimed', hexAddress(u.address), u.raw ? hexBytes(u.raw) : ''),
  );
  const { counts } = settings;
  return (
    <Stack gap="sm">
      <Text>
        {counts.captured} of {counts.registered} registered setting fields captured ·{' '}
        {counts.decoded} decoded to a value · {counts.unclaimedBytes} of {counts.windowBytes}{' '}
        settings bytes claimed by no field
      </Text>
      <Text size="sm" c="dimmed">
        Read-only view of the clone image. Each field is shown only when every byte of its span was
        captured; missing bytes stay missing and are never filled with defaults. Trust says where
        the layout comes from (CPS and/or CHIRP), not that this radio was verified. Clone values
        have unknown provenance. Nothing here edits the radio or reads it again.
      </Text>
      <Group gap="md" align="flex-end">
        <TextInput
          label="Search settings"
          placeholder="Search settings"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          style={{ flex: '1 1 14rem' }}
        />
        <Switch
          label="Show raw bytes + address"
          checked={raw}
          onChange={(e) => setRaw(e.currentTarget.checked)}
        />
        <SensitiveRevealButton revealed={revealed} onToggle={onToggleReveal} />
      </Group>
      {groups.map((g) => {
        const fields = g.fields.filter((f) => !searching || fieldMatches(f, g.label));
        if (fields.length === 0) return null;
        return (
          <Stack key={g.id} gap="xs" component="section" aria-label={g.label}>
            <Title order={5}>{g.label}</Title>
            <Table.ScrollContainer minWidth={320}>
              <Table aria-label={`${g.label} settings`}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Setting</Table.Th>
                    <Table.Th>Value</Table.Th>
                    <Table.Th>Trust</Table.Th>
                    {raw && <Table.Th>Address</Table.Th>}
                    {raw && <Table.Th>Raw bytes</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {fields.map((f) => (
                    <Table.Tr key={f.id}>
                      <Table.Td>
                        {f.label}{' '}
                        {f.advanced && (
                          <Badge size="xs" variant="light">
                            advanced
                          </Badge>
                        )}
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
                      <Table.Td>
                        {f.trust}
                        <Text size="xs" c="dimmed">
                          {f.targets.join(' + ')}
                        </Text>
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
      {searching && settings.fields.every((f) => !fieldMatches(f, '')) && (
        <Text size="sm">No settings match “{query.trim()}”.</Text>
      )}
      <Stack gap="xs" component="section" aria-label="Unclaimed bytes">
        <Title order={5}>Unclaimed bytes</Title>
        <Text size="sm" c="dimmed">
          Bytes in the settings windows (0x1980–0x1AFF and 0x3200–0x327F) that no registered field
          covers. They are unexplained, not zero. {counts.unclaimedBytes} bytes in{' '}
          {settings.unclaimed.length} runs.
        </Text>
        {unclaimedShown.length === 0 ? (
          <Text size="sm">
            {settings.unclaimed.length === 0
              ? 'No unclaimed bytes.'
              : `No unclaimed bytes match “${query.trim()}”.`}
          </Text>
        ) : (
          unclaimedShown.map((u) => (
            <Text size="sm" key={u.address} ff="monospace">
              {hexAddress(u.address)} +{u.length}: {u.raw ? hexBytes(u.raw) : NOT_CAPTURED}
            </Text>
          ))
        )}
      </Stack>
    </Stack>
  );
}
