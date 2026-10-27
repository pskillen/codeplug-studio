import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
  RANGE_CHANGE_JOURNAL_KEY,
  type RangeChangeJournalEntry,
} from '@integrations/persistence/rangeChangeJournal.ts';
import { resetRangeChangeJournalCache } from '../../state/atD890RangeChangeJournal.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import RangeChangeBanner from './RangeChangeBanner.tsx';

function entry(over: Partial<RangeChangeJournalEntry>): RangeChangeJournalEntry {
  return {
    serial: 'TESTSERIAL01',
    model: 'AT-D890UV',
    fromCode: 3,
    toCode: 7,
    stage: 'changed',
    backup: { fileName: 'b.zip', sha256: 'a'.repeat(64), savedAt: '2026-10-26T14:12:00Z' },
    vital: { fileName: 'v.zip', sha256: 'b'.repeat(64) },
    startedAt: '2026-10-26T14:10:00Z',
    updatedAt: '2026-10-26T14:14:00Z',
    studioVersion: 'test',
    ...over,
  };
}

function seed(entries: RangeChangeJournalEntry[]) {
  window.localStorage.setItem(RANGE_CHANGE_JOURNAL_KEY, JSON.stringify(entries));
  resetRangeChangeJournalCache();
}

function Where() {
  const loc = useLocation();
  return (
    <p data-testid="where">
      {loc.pathname}|{(loc.state as { serial?: string } | null)?.serial}
    </p>
  );
}

function renderBanner() {
  render(
    <MemoryRouter initialEntries={['/builds/b1/export']}>
      <Routes>
        <Route
          path="/builds/:id/export"
          element={
            <DesignSystemV2Provider>
              <RangeChangeBanner buildId="b1" />
            </DesignSystemV2Provider>
          }
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetRangeChangeJournalCache();
});

describe('RangeChangeBanner', () => {
  it('shows nothing with no record, and nothing for a done record', () => {
    seed([entry({ stage: 'done' })]);
    renderBanner();
    expect(screen.queryByTestId('range-change-banner')).toBeNull();
  });

  it.each(['sending', 'changed'] as const)('%s: the wiped-radio copy with Resume', (stage) => {
    seed([entry({ stage })]);
    renderBanner();
    const banner = screen.getByTestId('range-change-banner');
    expect(banner).toHaveTextContent('Unfinished range change.');
    expect(banner).toHaveTextContent('TESTSERIAL01');
    expect(banner).toHaveTextContent('was changed to Amateur US');
    expect(banner).toHaveTextContent("hasn't been restored");
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/builds/b1/export/danger-zone/frequency-range/resume|TESTSERIAL01',
    );
  });

  it('restored: restored but not checked, with Check', () => {
    seed([entry({ stage: 'restored' })]);
    renderBanner();
    expect(screen.getByTestId('range-change-banner')).toHaveTextContent(
      'restored, but not checked',
    );
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
  });

  it('Dismiss this record asks first, says what is lost, and forgets only on confirm', async () => {
    seed([entry({ stage: 'changed' })]);
    renderBanner();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this record' }));
    expect(await screen.findByText(/The radio isn't touched/)).toBeInTheDocument();
    // Keep it: the record stays.
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByTestId('range-change-banner')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(RANGE_CHANGE_JOURNAL_KEY)!)).toHaveLength(1);
    // Forget it: banner and record are gone.
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this record' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forget this record' }));
    expect(screen.queryByTestId('range-change-banner')).toBeNull();
    expect(window.localStorage.getItem(RANGE_CHANGE_JOURNAL_KEY) ?? '[]').not.toContain(
      'TESTSERIAL01',
    );
  });
});
