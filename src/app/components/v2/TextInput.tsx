import { useId, type InputHTMLAttributes } from 'react';
import classes from './TextInput.module.css';

export type TextInputVariant = 'default' | 'plain';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  mono?: boolean;
  /** `plain` — no border/padding; use inside FormField. */
  variant?: TextInputVariant;
  /** Validation error — destructive border; use `hint` for message below. */
  error?: boolean;
  hint?: string;
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
  error = false,
  hint,
  ...rest
}: TextInputProps) {
  const inputId = useId();
  const inputClass = [
    classes.input,
    mono ? classes.mono : '',
    variant === 'plain' ? classes.plain : '',
    error ? classes.inputError : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const input = (
    <input id={label ? inputId : undefined} className={inputClass} disabled={disabled} {...rest} />
  );

  if (!label && variant === 'plain' && !hint) {
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
      {hint ? <div className={error ? classes.error : classes.hint}>{hint}</div> : null}
    </div>
  );
}
