import type { ReactNode } from 'react';
import classes from './FacetBar.module.css';

export interface FacetChipProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export function FacetChip({ label, active, disabled, onClick }: FacetChipProps) {
  return (
    <button
      type="button"
      className={[classes.chip, active ? classes.chipActive : ''].filter(Boolean).join(' ')}
      disabled={disabled}
      aria-pressed={active || undefined}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export interface FacetBarProps {
  children: ReactNode;
  /** Horizontal scroll on narrow viewports (L2 band facets). */
  scrollable?: boolean;
  className?: string;
}

export function FacetBar({ children, scrollable, className }: FacetBarProps) {
  return (
    <div
      className={[classes.bar, scrollable ? classes.scroll : '', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

export interface SplitFilterOption {
  value: string;
  label: string;
}

export interface SplitFilterProps {
  options: [SplitFilterOption, SplitFilterOption];
  value: string | null;
  /** Clicking the active option clears the filter (`null`). */
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

/** Two-way pill toggle (Simplex / Split) — page-local until promoted to v2 forms. */
export function SplitFilter({ options, value, onChange, disabled }: SplitFilterProps) {
  return (
    <div
      className={[classes.splitFilter, value ? classes.splitFilterActive : '']
        .filter(Boolean)
        .join(' ')}
      role="group"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={[classes.splitOption, value === option.value ? classes.splitOptionActive : '']
            .filter(Boolean)
            .join(' ')}
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(value === option.value ? null : option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
