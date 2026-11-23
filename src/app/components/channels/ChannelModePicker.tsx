import { Menu } from '@mantine/core';
import { IconCheck, IconChevronDown, IconX } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { ChannelMode as CoreChannelMode } from '@core/models/libraryTypes.ts';
import {
  MODE_PICKER_COMMON,
  MODE_PICKER_MORE,
  MODE_PRESETS,
  modeColor,
  modeLabel,
  type ModePreset,
} from '../../lib/channelModes.ts';
import classes from './ChannelModePicker.module.css';

const PRESET_COVERED = new Set<CoreChannelMode>(['fm', 'dmr']);
const PLACEHOLDER_OTHER = MODE_PICKER_COMMON.filter((m) => !PRESET_COVERED.has(m));

export interface ChannelModePickerProps {
  modes: readonly CoreChannelMode[];
  onSwitch: (mode: CoreChannelMode) => void;
  onAdd: (mode: CoreChannelMode) => void;
  onRemove: (mode: CoreChannelMode) => void;
  onPreset: (preset: ModePreset) => void;
  compact?: boolean;
}

export interface AddModeMenuProps {
  modes: readonly CoreChannelMode[];
  onAdd: (mode: CoreChannelMode) => void;
  variant: 'link' | 'chip';
}

function pickerModesNotOnChannel(modes: readonly CoreChannelMode[]): CoreChannelMode[] {
  const present = new Set(modes);
  return [...MODE_PICKER_COMMON, ...MODE_PICKER_MORE].filter((m) => !present.has(m));
}

function ModeRadioChip({
  mode,
  checked,
  onSelect,
}: {
  mode: CoreChannelMode;
  checked: boolean;
  onSelect: (mode: CoreChannelMode) => void;
}) {
  const fill = modeColor(mode);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={[classes.chip, checked ? classes.chipChecked : ''].filter(Boolean).join(' ')}
      style={{
        borderColor: fill,
        ...(checked ? { backgroundColor: fill, color: '#1a1b1e' } : {}),
      }}
      onClick={() => {
        if (!checked) onSelect(mode);
      }}
    >
      {checked ? (
        <IconCheck size={11} stroke={2.5} aria-hidden className={classes.chipCheck} />
      ) : null}
      {modeLabel(mode)}
    </button>
  );
}

function MoreModesMenu({
  current,
  onSwitch,
  checked,
}: {
  current: CoreChannelMode | null;
  onSwitch: (mode: CoreChannelMode) => void;
  checked: boolean;
}) {
  const fill = current != null && checked ? modeColor(current) : undefined;
  const label = current != null && checked ? modeLabel(current) : 'More';
  return (
    <Menu withinPortal position="bottom-start" width={200}>
      <Menu.Target>
        <button
          type="button"
          role="radio"
          aria-checked={checked}
          className={[classes.chip, checked ? classes.chipChecked : ''].filter(Boolean).join(' ')}
          style={{
            borderColor: fill ?? undefined,
            ...(checked && fill
              ? { backgroundColor: fill, color: '#1a1b1e' }
              : {}),
          }}
        >
          {checked ? (
            <IconCheck size={11} stroke={2.5} aria-hidden className={classes.chipCheck} />
          ) : null}
          {label}
          <IconChevronDown size={14} stroke={2} aria-hidden />
        </button>
      </Menu.Target>
      <Menu.Dropdown>
        {MODE_PICKER_MORE.map((mode) => (
          <Menu.Item key={mode} onClick={() => onSwitch(mode)}>
            {modeLabel(mode)}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function AddModeMenu({ modes, onAdd, variant }: AddModeMenuProps): ReactNode {
  const available = pickerModesNotOnChannel(modes);
  if (available.length === 0) {
    return null;
  }

  const items = (
    <Menu.Dropdown>
      {available.map((mode) => (
        <Menu.Item key={mode} onClick={() => onAdd(mode)}>
          {modeLabel(mode)}
        </Menu.Item>
      ))}
    </Menu.Dropdown>
  );

  if (variant === 'link') {
    return (
      <Menu withinPortal position="bottom-start" width={200}>
        <Menu.Target>
          <button type="button" className={classes.addLink}>
            + Also runs another mode
          </button>
        </Menu.Target>
        {items}
      </Menu>
    );
  }

  return (
    <Menu withinPortal position="bottom-start" width={200}>
      <Menu.Target>
        <button type="button" className={classes.chip} aria-label="Add another mode">
          + Add another mode
        </button>
      </Menu.Target>
      {items}
    </Menu>
  );
}

function PlaceholderState({
  onSwitch,
  onPreset,
}: Pick<ChannelModePickerProps, 'onSwitch' | 'onPreset'>) {
  return (
    <Cardinal role="group" aria-labelledby="channel-mode-picker-title">
      <p id="channel-mode-picker-title" className={classes.placeholderTitle}>
        Which mode does this channel use?
      </p>
      <div className={classes.presetGrid}>
        {MODE_PRESETS.map((preset) => {
          const accent = modeColor(preset.modes[0] ?? 'fm');
          return (
            <button
              key={preset.id}
              type="button"
              className={classes.presetButton}
              style={{ borderLeftColor: accent }}
              onClick={() => onPreset(preset)}
            >
              <span className={classes.presetLabel}>{preset.label}</span>
              <span className={classes.presetSub}>{preset.sub}</span>
            </button>
          );
        })}
      </div>
      <p className={classes.otherLabel}>Other modes</p>
      <div className={classes.chips} role="radiogroup" aria-label="Other modes">
        {PLACEHOLDER_OTHER.map((mode) => (
          <ModeRadioChip key={mode} mode={mode} checked={false} onSelect={onSwitch} />
        ))}
        <MoreModesMenu current={null} onSwitch={onSwitch} checked={false} />
      </div>
    </Cardinal>
  );
}

function Cardinal({
  role,
  'aria-labelledby': labelledBy,
  children,
  className,
}: {
  role?: string;
  'aria-labelledby'?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={role}
      aria-labelledby={labelledBy}
      className={[classes.placeholder, className].filter(Boolean).join(' ')}
    >
      {children}
    </div>
  );
}

function SwitchState({
  current,
  onSwitch,
  compact,
}: {
  current: CoreChannelMode;
  onSwitch: (mode: CoreChannelMode) => void;
  compact?: boolean;
}) {
  const currentInMore = MODE_PICKER_MORE.includes(current);
  return (
    <div className={[classes.root, compact ? classes.compact : ''].filter(Boolean).join(' ')}>
      <div className={classes.chips} role="radiogroup" aria-label="Mode">
        {MODE_PICKER_COMMON.map((mode) => (
          <ModeRadioChip
            key={mode}
            mode={mode}
            checked={current === mode}
            onSelect={onSwitch}
          />
        ))}
        <MoreModesMenu
          current={currentInMore ? current : null}
          onSwitch={onSwitch}
          checked={currentInMore}
        />
      </div>
    </div>
  );
}

function MultiState({
  modes,
  onRemove,
  onAdd,
  compact,
}: {
  modes: readonly CoreChannelMode[];
  onRemove: (mode: CoreChannelMode) => void;
  onAdd: (mode: CoreChannelMode) => void;
  compact?: boolean;
}) {
  return (
    <div className={[classes.root, compact ? classes.compact : ''].filter(Boolean).join(' ')}>
      <div className={classes.chips}>
        {modes.map((mode) => {
          const fill = modeColor(mode);
          return (
            <span
              key={mode}
              className={[classes.chip, classes.chipChecked].join(' ')}
              style={{ borderColor: fill, backgroundColor: fill, color: '#1a1b1e' }}
            >
              <IconCheck size={11} stroke={2.5} aria-hidden className={classes.chipCheck} />
              {modeLabel(mode)}
              <button
                type="button"
                className={classes.removeButton}
                aria-label={`Remove ${modeLabel(mode)}`}
                onClick={() => onRemove(mode)}
              >
                <IconX size={14} stroke={2.5} aria-hidden />
              </button>
            </span>
          );
        })}
        <AddModeMenu modes={modes} onAdd={onAdd} variant="chip" />
      </div>
    </div>
  );
}

export default function ChannelModePicker({
  modes,
  onSwitch,
  onAdd,
  onRemove,
  onPreset,
  compact,
}: ChannelModePickerProps): ReactNode {
  if (modes.length === 0) {
    return (
      <div className={[classes.root, compact ? classes.compact : ''].filter(Boolean).join(' ')}>
        <PlaceholderState onSwitch={onSwitch} onPreset={onPreset} />
      </div>
    );
  }
  if (modes.length === 1) {
    return <SwitchState current={modes[0]!} onSwitch={onSwitch} compact={compact} />;
  }
  return <MultiState modes={modes} onRemove={onRemove} onAdd={onAdd} compact={compact} />;
}