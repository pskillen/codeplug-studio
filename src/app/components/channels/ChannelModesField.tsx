import { IconCheck } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { ChannelMode as CoreChannelMode } from '@core/models/libraryTypes.ts';
import { CHANNEL_MODES, modeLabel, type ChannelMode } from '../../lib/channelModes.ts';
import classes from './ChannelModesField.module.css';

const ANALOG_MODES = CHANNEL_MODES.filter((m) => m.category === 'analog' && m.id !== 'other').map(
  (m) => m.id as CoreChannelMode,
);
const DIGITAL_MODES = CHANNEL_MODES.filter((m) => m.category === 'digital').map(
  (m) => m.id as CoreChannelMode,
);

export interface ChannelModesFieldProps {
  selectedModes: readonly CoreChannelMode[];
  onChange: (modes: CoreChannelMode[]) => void;
  className?: string;
}

function ModeChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[classes.chip, active ? classes.chipActive : ''].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-pressed={active}
    >
      {active ? <IconCheck size={11} stroke={2.5} aria-hidden className={classes.chipCheck} /> : null}
      {children}
    </button>
  );
}

/**
 * Identity-panel mode multi-select — Analog and Digital chip groups (mk2 E1).
 */
export default function ChannelModesField({
  selectedModes,
  onChange,
  className,
}: ChannelModesFieldProps) {
  function toggle(mode: CoreChannelMode) {
    const next = selectedModes.includes(mode)
      ? selectedModes.filter((m) => m !== mode)
      : [...selectedModes, mode];
    onChange(next);
  }

  function renderGroup(label: string, modes: CoreChannelMode[]) {
    return (
      <div className={classes.group}>
        <div className={classes.groupLabel}>{label}</div>
        <div className={classes.chips}>
          {modes.map((mode) => (
            <ModeChip
              key={mode}
              active={selectedModes.includes(mode)}
              onClick={() => toggle(mode)}
            >
              {modeLabel(mode as ChannelMode)}
            </ModeChip>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      <div className={classes.label}>Modes</div>
      <p className={classes.hint}>
        Most channels use a single mode — select more only if this channel genuinely transmits as
        more than one.
      </p>
      <div className={classes.groups}>
        {renderGroup('Analog', ANALOG_MODES)}
        {renderGroup('Digital', DIGITAL_MODES)}
      </div>
    </div>
  );
}
