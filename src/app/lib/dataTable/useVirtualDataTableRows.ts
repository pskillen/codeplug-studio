import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import {
  DEFAULT_ACTIVATE_ROW_HEIGHT,
  DEFAULT_LIST_ROW_HEIGHT,
  DEFAULT_VIRTUAL_OVERSCAN,
  resolveDataTableVirtualization,
  type DataTableVirtualizeMode,
} from './virtualization.ts';

export interface UseVirtualDataTableRowsOptions {
  rowCount: number;
  virtualize?: DataTableVirtualizeMode;
  estimatedRowHeight?: number;
  virtualizeOverscan?: number;
  hasRowActivate?: boolean;
}

export function useVirtualDataTableRows({
  rowCount,
  virtualize,
  estimatedRowHeight,
  virtualizeOverscan,
  hasRowActivate,
}: UseVirtualDataTableRowsOptions) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualized = resolveDataTableVirtualization(virtualize, rowCount);
  const rowHeight =
    estimatedRowHeight ?? (hasRowActivate ? DEFAULT_ACTIVATE_ROW_HEIGHT : DEFAULT_LIST_ROW_HEIGHT);

  const rowVirtualizer = useVirtualizer({
    count: virtualized ? rowCount : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: virtualizeOverscan ?? DEFAULT_VIRTUAL_OVERSCAN,
  });

  const virtualRows = virtualized ? rowVirtualizer.getVirtualItems() : [];
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]!.start : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1]!.end
      : 0;

  return {
    scrollRef,
    virtualized,
    virtualRows,
    paddingTop,
    paddingBottom,
  };
}
