import { useCallback, useState } from 'react';
import { Alert, Button } from '@mantine/core';
import type { Channel } from '@core/models/library.ts';
import { runChannelDeleteFlow } from '../../lib/channelDeleteFlow.ts';
import { useLibrary } from '../../state/useLibrary.ts';

export interface ChannelDeleteButtonProps {
  channel: Channel;
  onDeleted?: () => void;
  size?: 'compact-sm' | 'compact-xs' | 'sm';
  variant?: 'light' | 'subtle' | 'filled';
}

export default function ChannelDeleteButton({
  channel,
  onDeleted,
  size = 'compact-sm',
  variant = 'light',
}: ChannelDeleteButtonProps) {
  const { projectId, deleteEntity, reload } = useLibrary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runChannelDeleteFlow({
        projectId,
        channel,
        deleteEntity,
        reload,
      });
      if (result.status === 'deleted') onDeleted?.();
      else if (result.status === 'blocked') setError(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }, [channel, deleteEntity, onDeleted, projectId, reload]);

  return (
    <>
      <Button color="red" variant={variant} size={size} loading={busy} onClick={() => void handleDelete()}>
        Delete channel
      </Button>
      {error ? (
        <Alert color="red" mt="xs">
          {error}
        </Alert>
      ) : null}
    </>
  );
}
