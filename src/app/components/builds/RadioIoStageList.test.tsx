import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { DesignSystemV2Provider } from '../v2/index.ts';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import RadioIoStageList, {
  STAGE_LIST_ROW_PX,
  STAGE_LIST_VISIBLE_ROWS,
  type StageRow,
} from './RadioIoStageList.tsx';

function ui(rows: StageRow[], progress: ProgressUpdate | null, startedAt?: number) {
  return (
    <MantineProvider>
      <DesignSystemV2Provider>
        <RadioIoStageList rows={rows} progress={progress} startedAt={startedAt} />
      </DesignSystemV2Provider>
    </MantineProvider>
  );
}

function makeRows(n: number, activeIdx: number): StageRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    label: `Stage ${i}`,
    status: i < activeIdx ? 'success' : i === activeIdx ? 'active' : 'pending',
    weight: 100,
  }));
}

describe('RadioIoStageList', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows every stage before any progress event, in a fixed-height scrolling list', () => {
    render(ui(makeRows(30, 0), null));
    expect(screen.getByText('Stage 0')).toBeInTheDocument();
    expect(screen.getByText('Stage 29')).toBeInTheDocument();
    const list = screen.getByTestId('stage-list');
    expect(list.style.maxHeight).toBe(`${STAGE_LIST_VISIBLE_ROWS * STAGE_LIST_ROW_PX}px`);
    expect(list.style.overflowY).toBe('auto');
  });

  it('keeps the same list height when the current stage moves', () => {
    const { rerender } = render(ui(makeRows(30, 0), { cur: 1, max: 2, msg: '' }));
    const before = screen.getByTestId('stage-list').style.maxHeight;
    rerender(ui(makeRows(30, 20), { cur: 1, max: 2, msg: '' }));
    expect(screen.getByTestId('stage-list').style.maxHeight).toBe(before);
    expect(screen.getByText('Stage 20').closest('li')).toHaveAttribute('data-status', 'active');
    expect(screen.getByText('Stage 3').closest('li')).toHaveAttribute('data-status', 'success');
  });

  it('shows the overall percentage and the estimate only after 2 s of progress', () => {
    const start = Date.now();
    const { rerender } = render(ui(makeRows(2, 0), { cur: 0, max: 100, msg: '' }, start));
    expect(screen.getByTestId('stage-list-eta')).toHaveTextContent('');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(ui(makeRows(2, 0), { cur: 25, max: 100, msg: '' }, start));
    expect(screen.getByText('13%')).toBeInTheDocument();
    expect(screen.getByTestId('stage-list-eta')).toHaveTextContent('');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('stage-list-eta').textContent).toMatch(/left|Almost done/);
    expect(screen.getByTestId('stage-list-eta').textContent).not.toMatch(/NaN|-/);
  });

  it('hides the overall bar when no row has a weight', () => {
    const rows: StageRow[] = [{ id: 'a', label: 'A', status: 'active' }];
    render(ui(rows, null));
    expect(screen.queryByTestId('stage-list-eta')).not.toBeInTheDocument();
  });
});
