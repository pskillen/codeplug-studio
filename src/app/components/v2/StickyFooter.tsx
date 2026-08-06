import Button from './Button.tsx';
import classes from './StickyFooter.module.css';

export interface StickyFooterProps {
  saveLabel: string;
  dirty?: boolean;
  onCancel: () => void;
  onSave: () => void;
  compact?: boolean;
  saving?: boolean;
  /** Overrides default dirty/saved status text. */
  statusText?: string;
  cancelLabel?: string;
  className?: string;
}

/**
 * Sticky editor save bar — Cancel + Save with dirty/saved status (Batch 3 E1–E8).
 */
export default function StickyFooter({
  saveLabel,
  dirty = false,
  onCancel,
  onSave,
  compact = false,
  saving = false,
  statusText,
  cancelLabel = 'Cancel',
  className,
}: StickyFooterProps) {
  const status = statusText ?? (dirty ? 'Unsaved changes' : 'All changes saved');

  return (
    <footer
      className={[classes.root, compact ? classes.compact : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-live="polite"
    >
      <span className={classes.status}>{status}</span>
      <div className={classes.actions}>
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          {cancelLabel}
        </Button>
        <Button variant="primary" size="sm" onClick={onSave} loading={saving}>
          {saveLabel}
        </Button>
      </div>
    </footer>
  );
}
