import type { KeyboardEvent, ReactNode } from 'react';
import classes from './ToggleSwitch.module.css';

export interface ToggleSwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * v2 on/off switch — hand-built for DS fidelity (not Mantine Switch).
 */
export default function ToggleSwitch({
  checked = false,
  onChange,
  label,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: ToggleSwitchProps) {
  const toggle = () => {
    if (disabled) return;
    onChange?.(!checked);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      toggle();
    }
  };

  return (
    <label
      className={[
        classes.root,
        disabled ? classes.rootDisabled : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        type="checkbox"
        className={classes.input}
        checked={checked}
        onChange={() => toggle()}
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      />
      <span
        className={[classes.track, checked ? classes.trackChecked : ''].filter(Boolean).join(' ')}
        role="presentation"
        onKeyDown={onKeyDown}
      >
        <span
          className={[classes.thumb, checked ? classes.thumbChecked : ''].filter(Boolean).join(' ')}
        />
      </span>
      {label ? <span className={classes.label}>{label}</span> : null}
    </label>
  );
}
