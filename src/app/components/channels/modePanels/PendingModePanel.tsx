import type { ChannelModeProfile } from '@core/models/library.ts';
import { modeLabel } from '../../../lib/channelModes.ts';
import type { ModePanelProps } from './types.ts';
import DigitalModeGroups from './DigitalModeGroups.tsx';

export default function PendingModePanel<P extends ChannelModeProfile>({
  profile,
}: ModePanelProps<P>) {
  const label = modeLabel(profile.mode);
  return (
    <DigitalModeGroups
      access={{
        note: `Studio doesn't hold ${label} settings yet. Pick the mode now; its settings come in a later release.`,
      }}
      call={{ note: '' }}
      listen={{ note: '' }}
      you={{ note: '' }}
    />
  );
}
