import { useId, type InputHTMLAttributes } from 'react';
import classes from './TextInput.module.css';

export type TextInputVariant = 'default' | 'plain';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  mono?: boolean;
  /** `plain` — no border/padding; use inside FormField. */
  variant?: TextInputVariant;
}

/**
 * v2 text/number input — standalone with optional label, or plain inside FormField.
 */
export default function TextInput({
  label,
  mono = false,
  variant = 'default',
  className,
  disabled,
  ...rest
}: TextInputProps) {
  const inputId = useId();
  const inputClass = [
    classes.input,
    mono ? classes.mono : '',
    variant === 'plain' ? classes.plain : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const input = (
    <input id={label ? inputId : undefined} className={inputClass} disabled={disabled} {...rest} />
  );

  if (!label && variant === 'plain') {
    return input;
  }

  return (
    <div className={classes.root}>
      {label ? (
        <label className={classes.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      {input}
    </div>
  );
}
