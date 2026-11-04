import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Channel } from '@core/models/library.ts';
import { duplicateChannel } from '@core/domain/factories.ts';
import { channelEditPath } from '../../lib/channelPaths.ts';
import { persistence } from '../../state/persistence.ts';
import { Button, ConfirmModal, type ButtonVariant } from '../v2/index.ts';

export interface ChannelDuplicateButtonProps {
  projectId: string;
  /** The channel to copy, read when the operator confirms (the editor passes its live form). */
  getSource: () => Channel;
  /** Editor only: the form has edits that are not saved yet; they go into the copy. */
  includesUnsavedEdits?: boolean;
  variant?: ButtonVariant;
}

function channelLabel(channel: Channel): string {
  const callsign = channel.callsign.trim();
  const name = channel.name.trim();
  if (callsign && name) return `${callsign} · ${name}`;
  return callsign || name || 'Untitled channel';
}

/** Duplicate a channel after a confirm step, then open the copy in the editor. */
export default function ChannelDuplicateButton({
  projectId,
  getSource,
  includesUnsavedEdits = false,
  variant = 'outline',
}: ChannelDuplicateButtonProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const source = open ? getSource() : null;

  async function handleConfirm() {
    const copy = duplicateChannel(projectId, getSource());
    setBusy(true);
    setError(null);
    const result = await persistence.putChannel(copy, null);
    setBusy(false);
    if (!result.ok) {
      setError('Could not create the copy.');
      return;
    }
    setOpen(false);
    navigate(channelEditPath(copy.id));
  }

  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        Duplicate
      </Button>
      <ConfirmModal
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        onConfirm={() => void handleConfirm()}
        title="Duplicate channel?"
        confirmLabel="Duplicate"
        busy={busy}
      >
        {source ? (
          <>
            <p>
              Creates a new channel copying <strong>{channelLabel(source)}</strong>, named{' '}
              <strong>{source.name.trim() || 'Untitled channel'} (copy)</strong>, and opens it in
              the editor. Zone memberships are not copied.
            </p>
            {includesUnsavedEdits ? (
              <p>Your unsaved edits on this page go into the copy, not the original.</p>
            ) : null}
            {error ? <p role="alert">{error}</p> : null}
          </>
        ) : null}
      </ConfirmModal>
    </>
  );
}
