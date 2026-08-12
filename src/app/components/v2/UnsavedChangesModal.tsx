import ConfirmModal from './ConfirmModal.tsx';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';

export interface UnsavedChangesModalProps {
  opened: boolean;
  onStay: () => void;
  onLeave: () => void;
  title?: string;
  message?: string;
}

/**
 * C2 unsaved-changes confirm — v2 {@link ConfirmModal} with default (non-destructive) tone.
 * Wraps its own {@link DesignSystemV2Provider} so editors outside the shell chrome scope still
 * render ds tokens correctly.
 */
export default function UnsavedChangesModal({
  opened,
  onStay,
  onLeave,
  title = 'Discard unsaved changes?',
  message = 'You have unsaved edits on this screen. Discard them and leave?',
}: UnsavedChangesModalProps) {
  return (
    <DesignSystemV2Provider>
      <ConfirmModal
        open={opened}
        onClose={onStay}
        onConfirm={onLeave}
        title={title}
        cancelLabel="Stay"
        confirmLabel="Discard"
        tone="default"
      >
        {message}
      </ConfirmModal>
    </DesignSystemV2Provider>
  );
}
