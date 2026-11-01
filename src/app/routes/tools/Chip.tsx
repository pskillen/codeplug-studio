import type { ReactNode } from 'react';
import classes from './FieldTools.module.css';

export interface ChipProps {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  title?: string;
  children: ReactNode;
}

/** Pill-shaped toggle used for precision, radius, source and filter choices in the Field tools. */
export default function Chip({ active = false, disabled, onClick, title, children }: ChipProps) {
  return (
    <button
      type="button"
      className={[classes.chip, active ? classes.chipActive : ''].filter(Boolean).join(' ')}
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
