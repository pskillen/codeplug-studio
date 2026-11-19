import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { RadioReadSummary } from '../../services/radioReadIntoLibrary.ts';
import ReadIntoLibrarySummary from './ReadIntoLibrarySummary.tsx';

const summary: RadioReadSummary = {
  modelLabel: 'Baofeng UV-5R Mini',
  firmwareLabel: 'MM9PDY modded firmware',
  channels: { created: 12, updated: 3, unchanged: 40 },
  zones: { created: 1, updated: 0, unchanged: 2, warnings: ['An empty slot was skipped.'] },
  build: {
    id: 'build-1',
    name: 'Mini',
    action: 'updated',
    targetLabel: 'Mini MM9PDY',
    channelsLeftOut: 4,
    zonesLeftOut: 1,
  },
  buildNote: 'The MM9PDY build was used.',
  droppedFields: ['Busy channel lockout'],
  notes: ['Channel order was inferred.'],
};

function renderSummary(value: RadioReadSummary) {
  return render(
    <MantineProvider>
      <MemoryRouter>
        <ReadIntoLibrarySummary summary={value} />
      </MemoryRouter>
    </MantineProvider>,
  );
}

describe('ReadIntoLibrarySummary', () => {
  it('shows counts, links, build exclusions, dropped fields and read details', () => {
    renderSummary(summary);
    expect(screen.getByRole('heading', { name: 'Read complete' })).toBeInTheDocument();
    expect(screen.getByText('Baofeng UV-5R Mini · MM9PDY modded firmware')).toBeInTheDocument();
    expect(screen.getByText('Channels: 12 created, 3 updated, 40 unchanged')).toBeInTheDocument();
    expect(screen.getByText('Zones: 1 created, 0 updated, 2 unchanged')).toBeInTheDocument();
    expect(
      screen.getByText('Left out of the build (still in your library): 4 channels, 1 zone'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mini' })).toHaveAttribute(
      'href',
      '/builds/build-1/export',
    );
    expect(screen.getByRole('link', { name: 'Open channels' })).toHaveAttribute(
      'href',
      '/library/channels',
    );
    expect(screen.getByRole('link', { name: 'Open zones' })).toHaveAttribute(
      'href',
      '/library/zones',
    );
    expect(screen.getByText('Not carried over')).toBeInTheDocument();
    expect(screen.getByText('Busy channel lockout')).toBeInTheDocument();
    expect(screen.getByText('The MM9PDY build was used.')).toBeInTheDocument();
    expect(screen.getByText('Channel order was inferred.')).toBeInTheDocument();
    expect(screen.getByText('An empty slot was skipped.')).toBeInTheDocument();
  });

  it('omits the zone count, zone link and exclusions when none apply', () => {
    renderSummary({
      ...summary,
      zones: { created: 0, updated: 0, unchanged: 0, warnings: [] },
      build: { ...summary.build, channelsLeftOut: 0, zonesLeftOut: 0 },
    });
    expect(screen.queryByText(/^Zones:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open zones' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Left out of the build/)).not.toBeInTheDocument();
  });

  it('shows exclusions when only zones are left out', () => {
    renderSummary({ ...summary, build: { ...summary.build, channelsLeftOut: 0 } });
    expect(
      screen.getByText('Left out of the build (still in your library): 0 channels, 1 zone'),
    ).toBeInTheDocument();
  });
});
