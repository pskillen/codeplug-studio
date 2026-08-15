import { useEffect, useState } from 'react';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { DigitalIdDirectoryOrderBy } from '@integrations/persistence/index.ts';
import { persistence } from '../state/persistence.ts';

export type DigitalIdDirectoryPageFilters = {
  digitalIdPrefix?: string;
  callsignPrefix?: string;
  namePrefix?: string;
  countryEquals?: string;
};

export type UseDigitalIdDirectoryPageOptions = {
  page: number;
  pageSize: number;
  orderBy?: DigitalIdDirectoryOrderBy;
  filters?: DigitalIdDirectoryPageFilters;
};

export function useDigitalIdDirectoryPage(
  projectId: string | null | undefined,
  { page, pageSize, orderBy = 'name', filters = {} }: UseDigitalIdDirectoryPageOptions,
): {
  rows: DigitalIdDirectoryEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  pageCount: number;
} {
  const [rows, setRows] = useState<DigitalIdDirectoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digitalIdPrefix = filters.digitalIdPrefix;
  const callsignPrefix = filters.callsignPrefix;
  const namePrefix = filters.namePrefix;
  const countryEquals = filters.countryEquals;

  useEffect(() => {
    if (!projectId) return;
    const activeProjectId = projectId;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const offset = Math.max(0, (page - 1) * pageSize);
        const result = await persistence.queryDigitalIdDirectoryPage({
          projectId: activeProjectId,
          offset,
          limit: pageSize,
          orderBy,
          digitalIdPrefix,
          callsignPrefix,
          namePrefix,
          countryEquals,
        });
        if (cancelled) return;
        setRows(result.rows);
        setTotal(result.total);
      } catch {
        if (!cancelled) {
          setError('Failed to load directory rows.');
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const unsubscribe = persistence.subscribeDirectory((change) => {
      if (change.projectId === activeProjectId) void load();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [projectId, page, pageSize, orderBy, digitalIdPrefix, callsignPrefix, namePrefix, countryEquals]);

  if (!projectId) {
    return {
      rows: [],
      total: 0,
      loading: false,
      error: null,
      pageCount: 1,
    };
  }

  return {
    rows,
    total,
    loading,
    error,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
