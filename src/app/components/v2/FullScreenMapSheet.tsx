import { IconX } from '@tabler/icons-react';
import { useEffect, type ReactNode } from 'react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import Button from './Button.tsx';
import classes from './FullScreenMapSheet.module.css';

export interface FullScreenMapSheetProps {
  open: boolean;
  title: string;
  /** Live map; fills the sheet (`height="100%"`). Only mounted while open. */
  children: ReactNode;
  onClose: () => void;
  /** Confirm action pinned at the bottom (e.g. "Use this point"). */
  confirmLabel: string;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  /** One line above the confirm button, e.g. the picked point or "Tap the map to pick a point". */
  hint?: ReactNode;
}

/**
 * Full-screen map overlay with a pinned confirm action — the destination of a {@link MapThumbnail}
 * on mobile editors (#1498). Escape or the close button cancels.
 */
export default function FullScreenMapSheet({
  open,
  title,
  children,
  onClose,
  confirmLabel,
  onConfirm,
  confirmDisabled = false,
  hint,
}: FullScreenMapSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={classes.root} role="dialog" aria-modal="true" aria-label={title}>
      <div className={classes.bar}>
        <span className={classes.title}>{title}</span>
        <button type="button" className={classes.close} aria-label="Close map" onClick={onClose}>
          <IconX size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
        </button>
      </div>
      <div className={classes.map}>{children}</div>
      <div className={classes.footer}>
        {hint ? <div className={classes.hint}>{hint}</div> : null}
        <Button variant="primary" onClick={onConfirm} disabled={confirmDisabled}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
