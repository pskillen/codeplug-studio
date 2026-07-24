import { Button, Menu } from '@mantine/core';
import { IconListCheck } from '@tabler/icons-react';
import { useMemo } from 'react';
import { pickFmAmModeProfile } from '@core/domain/modeProfiles.ts';
import type { Channel } from '@core/models/library.ts';
import { bandsFromFrequencies } from '../../../lib/bands.ts';
import { modeLabel } from '../../../lib/channelModes.ts';
import { ICON_STROKE } from '../../../lib/iconSizes.ts';

export interface ExportOrderSelectMenuProps {
  orderedChannelIds: readonly string[];
  channelById: ReadonlyMap<string, Channel>;
  selectedKeys: readonly string[];
  onSelectedKeysChange: (keys: string[]) => void;
  disabled?: boolean;
}

function channelIdsForBand(
  orderedChannelIds: readonly string[],
  channelById: ReadonlyMap<string, Channel>,
  bandId: string,
): string[] {
  return orderedChannelIds.filter((channelId) => {
    const channel = channelById.get(channelId);
    if (!channel) return false;
    return bandsFromFrequencies(channel.rxFrequency, channel.txFrequency).some(
      (band) => band.id === bandId,
    );
  });
}

function channelIdsForMode(
  orderedChannelIds: readonly string[],
  channelById: ReadonlyMap<string, Channel>,
  mode: 'fm' | 'am',
): string[] {
  return orderedChannelIds.filter((channelId) => {
    const channel = channelById.get(channelId);
    if (!channel) return false;
    return pickFmAmModeProfile(channel)?.mode === mode;
  });
}

export default function ExportOrderSelectMenu({
  orderedChannelIds,
  channelById,
  selectedKeys,
  onSelectedKeysChange,
  disabled = false,
}: ExportOrderSelectMenuProps) {
  const bandOptions = useMemo(() => {
    const byBand = new Map<string, { label: string; channelIds: string[] }>();
    for (const channelId of orderedChannelIds) {
      const channel = channelById.get(channelId);
      if (!channel) continue;
      for (const band of bandsFromFrequencies(channel.rxFrequency, channel.txFrequency)) {
        const existing = byBand.get(band.id);
        if (existing) {
          if (!existing.channelIds.includes(channelId)) {
            existing.channelIds.push(channelId);
          }
        } else {
          byBand.set(band.id, { label: band.label, channelIds: [channelId] });
        }
      }
    }
    return [...byBand.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [channelById, orderedChannelIds]);

  const modeOptions = useMemo(() => {
    const modes = new Set<'fm' | 'am'>();
    for (const channelId of orderedChannelIds) {
      const channel = channelById.get(channelId);
      if (!channel) continue;
      const profile = pickFmAmModeProfile(channel);
      if (profile?.mode === 'fm' || profile?.mode === 'am') {
        modes.add(profile.mode);
      }
    }
    return [...modes].sort();
  }, [channelById, orderedChannelIds]);

  const toggleKeys = (keys: string[]) => {
    if (!keys.length) return;
    const next = new Set(selectedKeys);
    const allSelected = keys.every((key) => next.has(key));
    if (allSelected) {
      for (const key of keys) next.delete(key);
    } else {
      for (const key of keys) next.add(key);
    }
    onSelectedKeysChange([...next]);
  };

  const hasHelpers = bandOptions.length > 0 || modeOptions.length > 0;

  return (
    <Menu shadow="md" width={280} position="bottom-start">
      <Menu.Target>
        <Button
          type="button"
          variant="default"
          size="compact-sm"
          leftSection={<IconListCheck size={14} stroke={ICON_STROKE} />}
          disabled={disabled || !hasHelpers}
        >
          Select…
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {bandOptions.length > 0 ? (
          <>
            <Menu.Label>Select by band</Menu.Label>
            {bandOptions.map((band) => (
              <Menu.Item
                key={band.id}
                onClick={() =>
                  toggleKeys(channelIdsForBand(orderedChannelIds, channelById, band.id))
                }
              >
                {band.label} ({band.channelIds.length})
              </Menu.Item>
            ))}
          </>
        ) : null}
        {modeOptions.length > 0 ? (
          <>
            {bandOptions.length > 0 ? <Menu.Divider /> : null}
            <Menu.Label>Select by mode</Menu.Label>
            {modeOptions.map((mode) => (
              <Menu.Item
                key={mode}
                onClick={() => toggleKeys(channelIdsForMode(orderedChannelIds, channelById, mode))}
              >
                {modeLabel(mode)} ({channelIdsForMode(orderedChannelIds, channelById, mode).length})
              </Menu.Item>
            ))}
          </>
        ) : null}
        <Menu.Divider />
        <Menu.Item disabled={selectedKeys.length === 0} onClick={() => onSelectedKeysChange([])}>
          Clear selection
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
