import { PasswordInput } from '@mantine/core';
import type { CredentialGuide } from '../../lib/credentialGuides.tsx';
import { Button, Pill, StatusDot } from '../v2/index.ts';
import classes from './CredentialSetupField.module.css';

export interface CredentialSetupFieldProps {
  guide: CredentialGuide;
  /** Input draft. */
  value: string;
  onChange: (value: string) => void;
  /** True when a non-empty value is saved in browser storage. */
  hasSavedValue: boolean;
  /** True when the draft differs from the saved value. */
  isDirty: boolean;
  onSave: () => void;
  onClear: () => void;
}

/**
 * Settings block for one bring-your-own API key or token: what it unlocks,
 * how to get one, the input, and whether it is saved.
 */
export default function CredentialSetupField({
  guide,
  value,
  onChange,
  hasSavedValue,
  isDirty,
  onSave,
  onClear,
}: CredentialSetupFieldProps) {
  const inputId = `${guide.sectionId}-input`;
  const label = `${guide.service} ${guide.noun}`;
  const trimmed = value.trim();
  const formatHint = trimmed && guide.formatHint ? guide.formatHint(trimmed) : null;

  const status = isDirty
    ? {
        tone: 'warning' as const,
        text: trimmed
          ? 'Unsaved changes. Press Save to use this value.'
          : `Press Save to remove the saved ${guide.noun}.`,
      }
    : hasSavedValue
      ? { tone: 'success' as const, text: 'Saved in this browser' }
      : { tone: 'neutral' as const, text: 'Not set' };

  return (
    <section
      className={classes.root}
      id={guide.sectionId}
      aria-labelledby={`${guide.sectionId}-title`}
    >
      <div className={classes.header}>
        <h3 className={classes.title} id={`${guide.sectionId}-title`}>
          {guide.service}
        </h3>
        <Pill tone={guide.requirement === 'required' ? 'accent' : 'neutral'}>
          {guide.requirementLabel}
        </Pill>
      </div>

      <p className={classes.purpose}>{guide.purpose}</p>

      {/* Steps start open until a value is saved; afterwards they collapse out of the way. */}
      <details className={classes.steps} open={!hasSavedValue}>
        <summary className={classes.summary}>
          How to get a {guide.service} {guide.noun}
        </summary>
        <p className={classes.cost}>{guide.cost}</p>
        <ol className={classes.list}>
          {guide.steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      </details>

      <form
        className={classes.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (isDirty) onSave();
        }}
      >
        <PasswordInput
          id={inputId}
          label={label}
          placeholder={guide.placeholder}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          description={`Stored in this browser only. Sent to ${guide.sentTo}`}
          autoComplete="off"
          spellCheck={false}
        />
        {formatHint ? (
          <p className={classes.hint} role="status">
            {formatHint}
          </p>
        ) : null}
        <div className={classes.actions}>
          <Button type="submit" size="sm" disabled={!isDirty}>
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClear}
            disabled={!hasSavedValue && !value}
          >
            Clear
          </Button>
          <span className={classes.status} aria-live="polite">
            <StatusDot tone={status.tone} label={status.text} />
          </span>
        </div>
      </form>
    </section>
  );
}
