import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TrackingSettings } from '@core/models/trackingSettings.ts';
import { initialRevision, isoNow } from '@core/models/revision.ts';
import { newId } from '@core/models/ids.ts';
import { persistence } from './persistence.ts';
import { useProjects } from './useProjects.ts';

export type TrackingSettingsInput = Pick<
  TrackingSettings,
  'positionSource' | 'location' | 'maidenheadLocator'
>;

export interface UseTrackingSettingsResult {
  settings: TrackingSettings | null;
  loading: boolean;
  save: (input: TrackingSettingsInput) => Promise<void>;
}

/** Per-project observer location singleton for satellite pass prediction. */
export function useTrackingSettings(): UseTrackingSettingsResult {
  const { activeProjectId } = useProjects();
  const [settings, setSettings] = useState<TrackingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!activeProjectId) {
      setSettings(null);
      return;
    }
    const rows = await persistence.listTrackingSettings(activeProjectId);
    setSettings(rows[0] ?? null);
  }, [activeProjectId]);

  useEffect(() => {
    let cancelled = false;
    const initialLoad = async () => {
      setLoading(true);
      await reload();
      if (!cancelled) setLoading(false);
    };
    void initialLoad();
    const unsubscribe = persistence.subscribe((change) => {
      if (
        !cancelled &&
        change.projectId === activeProjectId &&
        change.kind === 'trackingSettings'
      ) {
        void reload();
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeProjectId, reload]);

  const save = useCallback(
    async (input: TrackingSettingsInput) => {
      if (!activeProjectId) return;
      const now = isoNow();
      const row: TrackingSettings = settings
        ? { ...settings, ...input, updatedAt: now }
        : {
            id: newId(),
            projectId: activeProjectId,
            revision: initialRevision(),
            updatedAt: now,
            ...input,
          };
      const result = await persistence.putTrackingSettings(row, settings?.revision ?? null);
      if (result.ok) {
        setSettings({ ...row, revision: result.revision });
      }
    },
    [activeProjectId, settings],
  );

  return useMemo(() => ({ settings, loading, save }), [settings, loading, save]);
}
