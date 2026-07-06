import { useCallback, useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { Channel } from '@core/models/library.ts';
import { runChannelDeleteFlow } from '../../lib/channelDeleteFlow.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { useLibrary } from '../../state/useLibrary.ts';

export default function ChannelListDeleteAction({ channel }: { channel: Channel }) {
  const { projectId, deleteEntity, reload } = useLibrary();
  const [busy, setBusy] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!projectId || busy) return;
    setBusy(true);
    try {
      const result = await runChannelDeleteFlow({
        projectId,
        channel,
        deleteEntity,
        reload,
      });
      if (result.status === 'blocked') {
        window.alert(result.message);
      }
    } finally {
      setBusy(false);
    }
  }, [busy, channel, deleteEntity, projectId, reload]);

  const label = channel.name || channel.callsign || 'channel';

  return (
    <Tooltip label={`Delete ${label}`}>
      <ActionIcon
        variant="subtle"
        color="red"
        size="sm"
        loading={busy}
        aria-label={`Delete ${label}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleDelete();
        }}
      >
        <IconTrash size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
      </ActionIcon>
    </Tooltip>
  );
}
