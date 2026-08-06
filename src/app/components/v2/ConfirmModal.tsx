import { IconAlertTriangle, IconHelpCircle } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import Button from './Button.tsx';
import ModalShell, { type ModalShellIconTone } from './ModalShell.tsx';

export type ConfirmModalTone = 'default' | 'destructive';

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmModalTone;
  /** While true, dismiss is disabled and the confirm button reads "Working…". */
  busy?: boolean;
  confirmDisabled?: boolean;
  inline?: boolean;
}

const TONE_ICON: Record<ConfirmModalTone, ModalShellIconTone> = {
  default: 'accent',
  destructive: 'destructive',
};

/**
 * Standard + destructive confirmation dialog on top of {@link ModalShell}, `size="sm"`.
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy = false,
  confirmDisabled = false,
  inline,
}: ConfirmModalProps) {
  const Icon = tone === 'destructive' ? IconAlertTriangle : IconHelpCircle;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      icon={<Icon size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
      iconTone={TONE_ICON[tone]}
      size="sm"
      dismissible={!busy}
      inline={inline}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'destructive' ? 'destructive' : 'primary'}
            size="sm"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </ModalShell>
  );
}
