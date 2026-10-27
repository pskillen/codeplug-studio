import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../../../components/v2/index.ts';
import { BuildLayoutProvider } from '../BuildLayoutContext.tsx';
import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';
import { resetRangeChangeJournalCache } from '../../../state/atD890RangeChangeJournal.ts';
import BuildDangerZonePage from './BuildDangerZonePage.tsx';

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

afterEach(() => {
  window.localStorage.clear();
  resetRangeChangeJournalCache();
  vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
});

function renderPage(profileId: string, options?: { csvOnly?: boolean }) {
  const built = newRadioBuildForProfile('proj', profileId);
  const { build, egress } = built;
  const egressPaths = options?.csvOnly
    ? built.egressPaths.filter((p) => p.formatId !== 'radio-io')
    : built.egressPaths;
  render(
    <MemoryRouter initialEntries={[`/builds/${build.id}/export/danger-zone`]}>
      <BuildLayoutProvider
        value={{
          build,
          buildId: build.id,
          egressPaths,
          activeEgress: egress,
          setActiveEgressId: () => {},
          reloadEgressPaths: async () => {},
        }}
      >
        <DesignSystemV2Provider>
          <Routes>
            <Route path="/builds/:id/export/danger-zone" element={<BuildDangerZonePage />} />
            <Route path="/builds/:id/export" element={<p>EXPORT PAGE</p>} />
          </Routes>
        </DesignSystemV2Provider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
}

describe('BuildDangerZonePage', () => {
  it('lists the D890 range tool under the strap, with Start…', () => {
    renderPage('radio-io-at-d890uv');
    expect(screen.getByRole('heading', { level: 1, name: 'Danger zone' })).toBeInTheDocument();
    expect(
      screen.getByText("These change the radio itself. A Write can't undo them."),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Change frequency range' })).toBeInTheDocument();
    expect(screen.getByText(/About 10 minutes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start/ })).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('redirects to Export when the build has no Web Serial egress', () => {
    renderPage('radio-io-at-d890uv', { csvOnly: true });
    expect(screen.getByText('EXPORT PAGE')).toBeInTheDocument();
  });

  it('redirects to Export for a DM-32 build', () => {
    renderPage('radio-io-dm32uv');
    expect(screen.getByText('EXPORT PAGE')).toBeInTheDocument();
  });

  it('lists the range tool for an MM9PDY D890 build too', () => {
    renderPage('radio-io-at-d890uv-mm9pdy');
    expect(screen.getByRole('heading', { level: 1, name: 'Danger zone' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Change frequency range' })).toBeInTheDocument();
  });

  it('redirects to Export in the native app (Capacitor)', () => {
    vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
    renderPage('radio-io-at-d890uv');
    expect(screen.getByText('EXPORT PAGE')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Danger zone' })).toBeNull();
  });

  it('always offers "Finish a range change from a backup file"', () => {
    renderPage('radio-io-at-d890uv');
    expect(
      screen.getByRole('button', { name: 'Finish a range change from a backup file' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('range-last-change')).toBeNull();
  });

  it('shows the last finished change with the last 4 of the serial, and Change back…', () => {
    window.localStorage.setItem(
      'codeplug-studio.danger-zone.range-change-journal.v1',
      JSON.stringify([
        {
          serial: 'TESTSERIAL01',
          model: 'AT-D890UV',
          fromCode: 3,
          toCode: 7,
          stage: 'done',
          backup: { fileName: 'b.zip', sha256: 'a'.repeat(64), savedAt: '2026-10-26T14:12:00Z' },
          vital: { fileName: 'v.zip', sha256: 'b'.repeat(64) },
          startedAt: '2026-10-26T14:10:00Z',
          updatedAt: '2026-10-26T14:20:00Z',
          studioVersion: 'test',
        },
      ]),
    );
    resetRangeChangeJournalCache();
    renderPage('radio-io-at-d890uv');
    const last = screen.getByTestId('range-last-change');
    expect(last).toHaveTextContent('Last change: …AL01, Amateur Europe → Amateur US');
    expect(last).not.toHaveTextContent('TESTSERIAL');
    fireEvent.click(screen.getByRole('button', { name: 'Change back…' }));
  });
});
