import { IconTrash } from '@tabler/icons-react';
import { useCallback, useState } from 'react';
import type { Channel } from '@core/models/library.ts';
import { runChannelDeleteFlow } from '../../lib/channelDeleteFlow.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { RowActionIcon } from '../v2/index.ts';

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
    <RowActionIcon
      tone="destructive"
      label={`Delete channel ${label}`}
      disabled={busy}
      icon={<IconTrash size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
      onClick={() => void handleDelete()}
    />
  );
}
