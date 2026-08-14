import { useCallback, useMemo, useState } from 'react';
import {
  loadChannelListLayoutPrefs,
  mergeChannelListLayoutPrefs,
  type ChannelListCardGroupMode,
  type ChannelListLayoutMode,
} from '@integrations/listPrefs/index.ts';
import { useProjects } from '../state/useProjects.ts';

export interface ChannelListLayoutState {
  layout: ChannelListLayoutMode;
  cardGroup: ChannelListCardGroupMode;
}

const DEFAULT_LAYOUT: ChannelListLayoutState = {
  layout: 'table',
  cardGroup: 'none',
};

function normalizeLayoutPrefs(
  stored: Partial<ChannelListLayoutState> | null,
): ChannelListLayoutState {
  const layout = stored?.layout === 'cards' ? 'cards' : 'table';
  const cardGroup =
    stored?.cardGroup === 'zone' || stored?.cardGroup === 'band' || stored?.cardGroup === 'duplex'
      ? stored.cardGroup
      : 'none';
  return { layout, cardGroup };
}

export function usePersistedChannelListLayout(): [
  ChannelListLayoutState,
  {
    setLayout: (layout: ChannelListLayoutMode) => void;
    setCardGroup: (cardGroup: ChannelListCardGroupMode) => void;
  },
] {
  const { activeProjectId } = useProjects();
  const scopeKey = activeProjectId ?? '';

  const stored = useMemo((): ChannelListLayoutState => {
    if (!activeProjectId) return DEFAULT_LAYOUT;
    return normalizeLayoutPrefs(loadChannelListLayoutPrefs(activeProjectId));
  }, [activeProjectId]);

  const [trackedScopeKey, setTrackedScopeKey] = useState(scopeKey);
  const [override, setOverride] = useState<ChannelListLayoutState | undefined>(undefined);

  if (trackedScopeKey !== scopeKey) {
    setTrackedScopeKey(scopeKey);
    setOverride(undefined);
  }

  const layoutState = override ?? stored;

  const setLayout = useCallback(
    (layout: ChannelListLayoutMode) => {
      setOverride((prev) => {
        const base = prev ?? stored;
        const next = { ...base, layout };
        if (activeProjectId) mergeChannelListLayoutPrefs(activeProjectId, { layout });
        return next;
      });
    },
    [activeProjectId, stored],
  );

  const setCardGroup = useCallback(
    (cardGroup: ChannelListCardGroupMode) => {
      setOverride((prev) => {
        const base = prev ?? stored;
        const next = { ...base, cardGroup };
        if (activeProjectId) mergeChannelListLayoutPrefs(activeProjectId, { cardGroup });
        return next;
      });
    },
    [activeProjectId, stored],
  );

  return [layoutState, { setLayout, setCardGroup }];
}
