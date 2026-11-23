import type { ComponentType } from 'react';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import type { ModePanelProps, ProfileFor } from './types.ts';
import AnalogModePanel from './AnalogModePanel.tsx';
import DmrModePanel from './DmrModePanel.tsx';
import NxdnModePanel from './NxdnModePanel.tsx';
import DstarModePanel from './DstarModePanel.tsx';
import YsfModePanel from './YsfModePanel.tsx';
import TetraModePanel from './TetraModePanel.tsx';
import PendingModePanel from './PendingModePanel.tsx';

export const MODE_PANELS: { [M in ChannelMode]: ComponentType<ModePanelProps<ProfileFor<M>>> } = {
  fm: AnalogModePanel,
  am: AnalogModePanel,
  ssb: AnalogModePanel,
  dmr: DmrModePanel,
  nxdn: NxdnModePanel,
  tetra: TetraModePanel,
  dstar: DstarModePanel,
  ysf: YsfModePanel,
  p25: PendingModePanel,
  m17: PendingModePanel,
};
