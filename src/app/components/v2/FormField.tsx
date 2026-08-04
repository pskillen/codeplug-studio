import type { ReactNode } from 'react';
import classes from './FormField.module.css';

export interface FormFieldProps {
  label: string;
  mono?: boolean;
  /** When set, renders a static read-only value instead of children. */
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * Label-above-bordered-box field wrapper for channel editor sections.
 */
export default function FormField({
  label,
  mono = false,
  value,
  children,
  className,
}: FormFieldProps) {
  const bodyClass = [classes.body, mono ? classes.mono : ''].filter(Boolean).join(' ');

  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')}>
      <div className={classes.label}>{label}</div>
      <div className={bodyClass}>
        {value != null ? <div className={classes.staticValue}>{value}</div> : children}
      </div>
    </div>
  );
}
