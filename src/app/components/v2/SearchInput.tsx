import { IconSearch } from '@tabler/icons-react';
import type { ChangeEventHandler } from 'react';
import Pill from './Pill.tsx';
import classes from './SearchInput.module.css';

export interface SearchInputProps {
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  /** Optional suffix pill — e.g. detected filter tag. */
  detectedTag?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Filter-bar search field with leading icon and optional detected-tag Pill.
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  detectedTag,
  className,
  'aria-label': ariaLabel = 'Search',
}: SearchInputProps) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      <IconSearch size={16} stroke={1.75} className={classes.icon} aria-hidden />
      <input
        className={classes.input}
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {detectedTag ? (
        <Pill tone="neutral" className={classes.tag}>
          {detectedTag}
        </Pill>
      ) : null}
    </div>
  );
}
