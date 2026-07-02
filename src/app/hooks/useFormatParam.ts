import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatCatalog, formatCatalogEntry } from '@core/import-export/registry.ts';
import type { FormatCatalogEntry, FormatId } from '@core/import-export/types.ts';

const FORMAT_PARAM = 'format';

function parseFormatId(raw: string | null): FormatId | null {
  if (!raw) return null;
  const found = formatCatalog.find((f) => f.id === raw);
  return found?.id ?? null;
}

export function useFormatParam(): {
  formatId: FormatId | null;
  formatEntry: FormatCatalogEntry | undefined;
  setFormatId: (id: FormatId | null) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const formatId = parseFormatId(searchParams.get(FORMAT_PARAM));
  const formatEntry = formatId ? formatCatalogEntry(formatId) : undefined;

  const setFormatId = useCallback(
    (id: FormatId | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!id) next.delete(FORMAT_PARAM);
          else next.set(FORMAT_PARAM, id);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return { formatId, formatEntry, setFormatId };
}
