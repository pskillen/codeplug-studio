import classes from './SegmentedControl.module.css';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
}

/**
 * Mutually exclusive option picker — DMR timeslot and filter segments.
 */
export default function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'sm',
  className,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')} role="group">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            className={[classes.option, classes[size], active ? classes.active : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => onChange?.(opt.value)}
            aria-pressed={active}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
