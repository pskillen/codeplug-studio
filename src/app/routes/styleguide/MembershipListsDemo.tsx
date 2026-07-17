import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  Paper,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconGripVertical, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { UK_BANDS } from '../../lib/bands.ts';
import { BandPill, ModePill } from '../../components/pills/index.ts';
import type { ChannelMode } from '../../lib/channelModes.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';
import { AvailableItemPicker, SelectedItemList } from '../../components/ui/index.ts';

const MEMBERSHIP_DEMO_CATALOG = {
  alpha: {
    key: 'alpha',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'GB3DA Stornoway',
    subtitle: '145.575 / 145.175 MHz',
    modes: ['fm'] as ChannelMode[],
    bandId: '2m' as const,
  },
  bravo: {
    key: 'bravo',
    pool: 'zones' as const,
    kind: 'zone' as const,
    label: 'Highlands',
    subtitle: '8 channels effective',
  },
  charlie: {
    key: 'charlie',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'BM Scotland 1',
    subtitle: '439.275 / 430.875 MHz',
    modes: ['dmr'] as ChannelMode[],
    bandId: '70cm' as const,
  },
  delta: {
    key: 'delta',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'Local FM net',
    subtitle: '145.500 / 145.500 MHz',
    modes: ['fm'] as ChannelMode[],
    bandId: '2m' as const,
    scanInclusion: 'skip',
  },
  echo: {
    key: 'echo',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'GB3IV Inverness',
    subtitle: '430.950 / 438.950 MHz',
    modes: ['dmr', 'ysf'] as ChannelMode[],
    bandId: '70cm' as const,
  },
  foxtrot: {
    key: 'foxtrot',
    pool: 'zones' as const,
    kind: 'zone' as const,
    label: 'City repeaters',
    subtitle: '5 channels effective',
  },
  golf: {
    key: 'golf',
    pool: 'channels' as const,
    kind: 'channel' as const,
    label: 'DSTAR reflector',
    subtitle: '434.612 / 434.612 MHz',
    modes: ['dstar'] as ChannelMode[],
    bandId: '70cm' as const,
  },
} satisfies Record<
  string,
  {
    key: string;
    pool: 'channels' | 'zones';
    kind: 'channel' | 'zone';
    label: string;
    subtitle: string;
    modes?: ChannelMode[];
    bandId?: '2m' | '70cm';
    scanInclusion?: 'default' | 'skip' | 'alwaysScan';
  }
>;

type MembershipDemoKey = keyof typeof MEMBERSHIP_DEMO_CATALOG;

const MEMBERSHIP_DEMO_POOL: Record<'channels' | 'zones', MembershipDemoKey[]> = {
  channels: ['charlie', 'delta', 'echo', 'golf'],
  zones: ['foxtrot'],
};

function membershipDemoMatchesFilter(key: MembershipDemoKey, filterLower: string): boolean {
  if (!filterLower) return true;
  const entry = MEMBERSHIP_DEMO_CATALOG[key];
  const haystack = `${entry.label} ${entry.subtitle}`.toLowerCase();
  return haystack.includes(filterLower);
}

function MembershipListsDemo() {
  const [selectedKeys, setSelectedKeys] = useState<MembershipDemoKey[]>(['alpha', 'bravo']);
  const [listSelection, setListSelection] = useState<MembershipDemoKey[]>([]);
  const [poolChannelPick, setPoolChannelPick] = useState<MembershipDemoKey[]>([]);
  const [poolZonePick, setPoolZonePick] = useState<MembershipDemoKey[]>([]);
  const [selectedFilter, setSelectedFilter] = useState('');
  const [poolFilter, setPoolFilter] = useState('');
  const [hideFilteredFromMap, setHideFilteredFromMap] = useState(false);
  const [scanListByKey, setScanListByKey] = useState<Partial<Record<MembershipDemoKey, boolean>>>({
    alpha: true,
    charlie: true,
  });

  const selectedFilterLower = selectedFilter.trim().toLowerCase();
  const poolFilterLower = poolFilter.trim().toLowerCase();

  const filteredSelected = selectedKeys.filter((key) =>
    membershipDemoMatchesFilter(key, selectedFilterLower),
  );

  const poolChannels = MEMBERSHIP_DEMO_POOL.channels.filter(
    (key) => !selectedKeys.includes(key) && membershipDemoMatchesFilter(key, poolFilterLower),
  );
  const poolZones = MEMBERSHIP_DEMO_POOL.zones.filter(
    (key) => !selectedKeys.includes(key) && membershipDemoMatchesFilter(key, poolFilterLower),
  );

  const toggleListSelect = (key: MembershipDemoKey) => {
    setListSelection((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  };

  const removeSelectedBulk = () => {
    if (!listSelection.length) return;
    const remove = new Set(listSelection);
    setSelectedKeys((prev) => prev.filter((key) => !remove.has(key)));
    setListSelection([]);
  };

  const addFromPool = () => {
    const toAdd = [...poolChannelPick, ...poolZonePick];
    if (!toAdd.length) return;
    setSelectedKeys((prev) => [...prev, ...toAdd]);
    setPoolChannelPick([]);
    setPoolZonePick([]);
  };

  const moveSelected = (direction: 'up' | 'down') => {
    if (!listSelection.length) return;
    setSelectedKeys((prev) => {
      const next = [...prev];
      const indices = listSelection
        .map((key) => next.indexOf(key))
        .filter((index) => index >= 0)
        .sort((a, b) => (direction === 'up' ? a - b : b - a));
      for (const index of indices) {
        const swapWith = direction === 'up' ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= next.length) continue;
        if (listSelection.includes(next[swapWith]!)) continue;
        [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
      }
      return next;
    });
  };

  const canMoveUp = listSelection.some((key) => selectedKeys.indexOf(key) > 0);
  const canMoveDown = listSelection.some((key) => {
    const index = selectedKeys.indexOf(key);
    return index >= 0 && index < selectedKeys.length - 1;
  });

  const channelCount = selectedKeys.filter(
    (key) => MEMBERSHIP_DEMO_CATALOG[key].kind === 'channel',
  ).length;

  return (
    <Stack gap="lg" maw={640}>
      <SelectedItemList
        title="In this zone"
        description={`${selectedKeys.length} direct member${selectedKeys.length === 1 ? '' : 's'} · ${channelCount} channels effective — export order`}
        filter={{
          value: selectedFilter,
          onChange: setSelectedFilter,
          placeholder: 'Filter members…',
          'aria-label': 'Filter selected members',
        }}
        itemKeys={filteredSelected}
        selectedKeys={listSelection}
        onToggleSelect={toggleListSelect}
        onRemove={(key) => {
          setSelectedKeys((prev) => prev.filter((x) => x !== key));
          setListSelection((prev) => prev.filter((x) => x !== key));
        }}
        emptyMessage="No members in zone"
        renderItem={({ itemKey, selected, onToggleSelect, onRemove }) => {
          const entry = MEMBERSHIP_DEMO_CATALOG[itemKey];

          if (entry.kind === 'zone') {
            return (
              <Paper key={itemKey} withBorder p="xs" radius="sm">
                <Group gap="sm" wrap="nowrap" justify="space-between">
                  <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                    <Checkbox
                      checked={selected}
                      onChange={onToggleSelect}
                      aria-label={`Select ${entry.label}`}
                    />
                    <IconGripVertical
                      size={14}
                      stroke={ICON_STROKE}
                      style={{ opacity: 0.35, flexShrink: 0 }}
                    />
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" fw={500} truncate>
                        Zone: {entry.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {entry.subtitle}
                      </Text>
                    </Stack>
                  </Group>
                  <Group gap="xs" wrap="nowrap">
                    <Text size="xs" c="brand">
                      Open zone
                    </Text>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={onRemove}
                      aria-label="Remove"
                    >
                      <IconX size={14} stroke={ICON_STROKE} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            );
          }

          const band = entry.bandId ? (UK_BANDS.find((b) => b.id === entry.bandId) ?? null) : null;

          return (
            <Paper key={itemKey} withBorder p="xs" radius="sm">
              <Group gap="sm" wrap="nowrap" justify="space-between" align="flex-start">
                <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                  <Checkbox
                    checked={selected}
                    onChange={onToggleSelect}
                    aria-label={`Select ${entry.label}`}
                  />
                  <IconGripVertical
                    size={14}
                    stroke={ICON_STROKE}
                    style={{ opacity: 0.35, flexShrink: 0 }}
                  />
                  <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
                    <Group gap="xs" wrap="wrap">
                      <Text size="sm" fw={500}>
                        {entry.label}
                      </Text>
                      {band ? <BandPill band={band} size="xs" /> : null}
                      {entry.modes.map((mode) => (
                        <ModePill key={mode} mode={mode} size="xs" />
                      ))}
                      {(() => {
                        const scanInclusion =
                          'scanInclusion' in entry ? entry.scanInclusion : undefined;
                        if (scanInclusion === 'skip') {
                          return (
                            <Badge size="xs" variant="light" color="gray">
                              Skip scan
                            </Badge>
                          );
                        }
                        if (scanInclusion === 'alwaysScan') {
                          return (
                            <Badge size="xs" variant="light" color="teal">
                              Always scan
                            </Badge>
                          );
                        }
                        return null;
                      })()}
                    </Group>
                    <Text size="xs" c="dimmed">
                      {entry.subtitle}
                    </Text>
                  </Stack>
                </Group>
                <Group gap="xs" wrap="nowrap" align="center">
                  <Tooltip label="Include in zone-derived scan lists at export">
                    <Checkbox
                      label="Scan list"
                      size="xs"
                      checked={scanListByKey[itemKey] ?? true}
                      onChange={(e) =>
                        setScanListByKey((prev) => ({
                          ...prev,
                          [itemKey]: e.currentTarget.checked,
                        }))
                      }
                    />
                  </Tooltip>
                  <Text size="xs" c="brand">
                    Open
                  </Text>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={onRemove}
                    aria-label="Remove"
                  >
                    <IconX size={14} stroke={ICON_STROKE} />
                  </ActionIcon>
                </Group>
              </Group>
            </Paper>
          );
        }}
        toolbar={
          <Button
            type="button"
            variant="default"
            size="compact-sm"
            onClick={() =>
              setSelectedKeys((prev) =>
                [...prev].sort((a, b) =>
                  MEMBERSHIP_DEMO_CATALOG[a].label.localeCompare(MEMBERSHIP_DEMO_CATALOG[b].label),
                ),
              )
            }
            disabled={!selectedKeys.length}
          >
            Sort by name (demo)
          </Button>
        }
        onMoveSelected={moveSelected}
        onRemoveSelected={removeSelectedBulk}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />

      <AvailableItemPicker
        title="Other channels & zones"
        description="Sparse pool — stage candidates then Add selected (role B)."
        filter={{
          value: poolFilter,
          onChange: setPoolFilter,
          placeholder: 'Filter…',
          'aria-label': 'Filter available channels and zones',
        }}
        sections={[
          {
            id: 'channels',
            title: 'Channels',
            itemKeys: poolChannels,
            selectedKeys: poolChannelPick,
            onToggleSelect: (key) =>
              setPoolChannelPick((prev) =>
                prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
              ),
            emptyMessage: 'No channels available',
            sectionToolbar: (
              <Button
                type="button"
                variant="subtle"
                size="compact-xs"
                disabled={!poolChannels.length}
                onClick={() => setPoolChannelPick([...poolChannels])}
              >
                Select all
              </Button>
            ),
            renderItem: ({ itemKey, checked, onToggle }) => {
              const entry = MEMBERSHIP_DEMO_CATALOG[itemKey];
              if (entry.kind !== 'channel') return null;
              const band = entry.bandId
                ? (UK_BANDS.find((b) => b.id === entry.bandId) ?? null)
                : null;
              return (
                <Group key={itemKey} gap="sm" wrap="nowrap">
                  <Checkbox
                    checked={checked}
                    onChange={onToggle}
                    aria-label={`Select ${entry.label}`}
                  />
                  <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
                    {entry.label}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                    {entry.subtitle}
                  </Text>
                  {band ? <BandPill band={band} size="xs" /> : null}
                  {entry.modes.slice(0, 2).map((mode) => (
                    <ModePill key={mode} mode={mode} size="xs" />
                  ))}
                </Group>
              );
            },
          },
          {
            id: 'zones',
            title: 'Zones',
            itemKeys: poolZones,
            selectedKeys: poolZonePick,
            onToggleSelect: (key) =>
              setPoolZonePick((prev) =>
                prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
              ),
            emptyMessage: 'No zones available',
            renderItem: ({ itemKey, checked, onToggle }) => {
              const entry = MEMBERSHIP_DEMO_CATALOG[itemKey];
              return (
                <Checkbox
                  key={itemKey}
                  label={`Zone: ${entry.label}`}
                  description={entry.subtitle}
                  checked={checked}
                  onChange={onToggle}
                />
              );
            },
          },
        ]}
        onAddSelected={addFromPool}
        addDisabled={!poolChannelPick.length && !poolZonePick.length}
        footer={
          <Checkbox
            label="Hide filtered entries from map (demo)"
            checked={hideFilteredFromMap}
            disabled={!poolFilterLower}
            onChange={(e) => setHideFilteredFromMap(e.currentTarget.checked)}
          />
        }
      />
    </Stack>
  );
}

export default MembershipListsDemo;
