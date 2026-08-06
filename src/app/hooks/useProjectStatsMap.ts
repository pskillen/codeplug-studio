import { useEffect, useState } from 'react';
import { summariseProjectSeed } from '@core/services/projectSyncSummary.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { persistence } from '../state/persistence.ts';

export type ProjectStatsMap = Record<string, string>;

function formatStats(counts: { channels: number; zones: number; radioBuilds: number }): string {
  return `${counts.channels} channels · ${counts.zones} zones · ${counts.radioBuilds} builds`;
}

/** Loads per-project inventory stats for Home project cards. */
export function useProjectStatsMap(projects: ProjectMeta[]): ProjectStatsMap {
  const [stats, setStats] = useState<ProjectStatsMap>({});

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const next: ProjectStatsMap = {};
      await Promise.all(
        projects.map(async (project) => {
          const seed = await persistence.loadProjectSeed(project.projectId);
          if (!seed) return;
          const summary = summariseProjectSeed(seed);
          next[project.projectId] = formatStats(summary.counts);
        }),
      );
      if (!cancelled) setStats(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  return stats;
}
