import { IconSearch } from '@tabler/icons-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './Combobox.module.css';

export interface ComboboxOption<T = unknown> {
  value: T;
  label: string;
  sublabel?: string;
}

export interface ComboboxProps<T = unknown> {
  /** Committed selection. When set, renders the committed chip state. */
  value?: ComboboxOption<T> | null;
  inputValue: string;
  onInputChange: (value: string) => void;
  options: ComboboxOption<T>[];
  loading?: boolean;
  onSelect: (option: ComboboxOption<T>) => void;
  placeholder?: string;
  emptyMessage?: string;
  renderOption?: (option: ComboboxOption<T>) => ReactNode;
  /** Clears the committed selection back to the searching state. */
  onClear?: () => void;
  /**
   * Leading icon for both states. Default search icon — the DS bundle
   * hardcodes a map-pin for its location use case; this generalizes that so
   * non-location consumers (e.g. a generic entity picker) aren't stuck with it.
   */
  icon?: ReactNode;
}

/**
 * Async search-select. Committed state shows a chip-like row with a "Change"
 * link; searching state shows a bordered input with a floating results
 * dropdown, open while focused with a non-empty query, closing on outside
 * click.
 */
export default function Combobox<T = unknown>({
  value,
  inputValue,
  onInputChange,
  options,
  loading,
  onSelect,
  placeholder = 'Search…',
  emptyMessage = 'No results',
  renderOption,
  onClear,
  icon,
}: ComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  const leadingIcon = icon ?? <IconSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />;

  if (value) {
    return (
      <div className={classes.committed}>
        <span className={classes.committedIcon} aria-hidden>
          {leadingIcon}
        </span>
        <span className={classes.committedLabel}>{value.label}</span>
        {onClear ? (
          <button type="button" className={classes.changeLink} onClick={onClear}>
            Change
          </button>
        ) : null}
      </div>
    );
  }

  const showDropdown = open && inputValue.length > 0;

  return (
    <div className={classes.root} ref={rootRef}>
      <div className={classes.inputRow}>
        <span className={classes.icon} aria-hidden>
          {leadingIcon}
        </span>
        <input
          type="text"
          className={classes.input}
          value={inputValue}
          placeholder={placeholder}
          onChange={(event) => onInputChange(event.currentTarget.value)}
          onFocus={() => setOpen(true)}
          aria-label={placeholder}
        />
        {loading ? <span className={classes.spinner} aria-hidden /> : null}
      </div>
      {showDropdown ? (
        <div className={classes.dropdown} role="listbox">
          {options.length === 0 ? (
            <div className={classes.empty}>{emptyMessage}</div>
          ) : (
            options.map((option, index) => (
              <button
                key={index}
                type="button"
                role="option"
                aria-selected={false}
                className={classes.option}
                onClick={() => {
                  onSelect(option);
                  setOpen(false);
                }}
              >
                {renderOption ? (
                  renderOption(option)
                ) : (
                  <>
                    <span className={classes.optionLabel}>{option.label}</span>
                    {option.sublabel ? (
                      <span className={classes.optionSublabel}>{option.sublabel}</span>
                    ) : null}
                  </>
                )}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
