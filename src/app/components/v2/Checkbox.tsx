import type { InputHTMLAttributes } from 'react';
import classes from './Checkbox.module.css';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * v2-styled checkbox for list row selection.
 */
export default function Checkbox({
  checked,
  onCheckedChange,
  onChange,
  className,
  ...rest
}: CheckboxProps) {
  return (
    <input
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
