import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import {
  DEFAULT_ACTIVATE_ROW_HEIGHT,
  DEFAULT_LIST_ROW_HEIGHT,
  DEFAULT_VIRTUAL_OVERSCAN,
  EXTREME_SCALE_SCROLLPORT_HEIGHT,
  resolveDataTableVirtualization,
  type DataTableVirtualizeMode,
} from './virtualization.ts';

function observeScrollportRect(
  instance: Virtualizer<HTMLDivElement, Element>,
  cb: (rect: { width: number; height: number }) => void,
) {
  const element = instance.scrollElement;
  if (!element) return;

  const getRect = () => ({
    width: element.clientWidth,
    height:
      element.clientHeight > 0 ? element.clientHeight : EXTREME_SCALE_SCROLLPORT_HEIGHT,
  });

  cb(getRect());

  const observer = new ResizeObserver(() => {
    cb(getRect());
  });
  observer.observe(element);

  return () => {
    observer.disconnect();
  };
}

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
    observeElementRect: observeScrollportRect,
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
