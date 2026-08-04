import { useEffect, useRef, type InputHTMLAttributes } from 'react';
import classes from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  indeterminate?: boolean;
}

/**
 * v2-styled checkbox for list row selection.
 */
export default function Checkbox({
  checked,
  onCheckedChange,
  onChange,
  className,
  indeterminate,
  ...rest
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate ?? false;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={[classes.root, className].filter(Boolean).join(' ')}
      checked={checked}
      onChange={(e) => {
        onChange?.(e);
        onCheckedChange?.(e.target.checked);
      }}
      {...rest}
    />
  );
}
