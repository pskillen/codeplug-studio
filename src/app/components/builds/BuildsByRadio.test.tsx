import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildWithEgresses } from '@core/domain/factories.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import BuildsByRadio, { relativeTime } from './BuildsByRadio.tsx';
import { filterBuildsByQuery } from './buildsSearch.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function build(targetId: string, name: string): RadioBuild {
  return { ...newRadioBuildWithEgresses(projectId, targetId).build, name };
}

function renderTree(builds: RadioBuild[], query?: string) {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <BuildsByRadio builds={builds} query={query} />
      </MantineProvider>
    </MemoryRouter>,
  );
}

const BUILDS = [
  build('baofeng-dm32uv-mm9pdy', 'Club B'),
  build('baofeng-dm32uv-mm9pdy', 'Club A'),
  build('baofeng-dm32uv', 'Spare'),
  build('baofeng-uv5r-mini', 'Mini'),
  build('retevis-rt95', 'Mobile'),
];

describe('BuildsByRadio', () => {
  it('renders one card per radio model under a manufacturer heading with counts', () => {
    renderTree(BUILDS);
    expect(screen.getByRole('heading', { level: 2, name: /Baofeng/ })).toHaveTextContent(
      '4 builds',
    );
    const dm32 = screen.getByRole('article', { name: 'DM-32UV builds' });
    expect(dm32).toHaveTextContent('3 builds');
    expect(within(dm32).getByText('DMR')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('orders builds by firmware (stock first) then name inside a card', () => {
    renderTree(BUILDS);
    const dm32 = screen.getByRole('article', { name: 'DM-32UV builds' });
    expect(
      within(dm32)
        .getAllByRole('link')
        .map((l) => l.querySelector('span')?.textContent),
    ).toEqual(['Spare', 'Club A', 'Club B']);
    expect(within(dm32).getAllByText('MM9PDY')).toHaveLength(2);
  });

  it('makes each build one link row that opens it, with no Open / New / Another controls', () => {
    const b = build('baofeng-uv5r-mini', 'Mini');
    renderTree([b]);
    const link = screen.getByRole('link', { name: /Mini/ });
    expect(link).toHaveAttribute('href', `/builds/${b.id}/export`);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
    expect(screen.queryByText(/Another/)).not.toBeInTheDocument();
    expect(screen.queryByText('+ New')).not.toBeInTheDocument();
  });

  it('highlights search words', () => {
    renderTree([build('baofeng-uv5r-mini', 'Mini Club')], 'club');
    expect(screen.getByText('Club', { selector: 'mark' })).toBeInTheDocument();
  });

  it('renders nothing for no builds', () => {
    renderTree([]);
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});

describe('filterBuildsByQuery', () => {
  it('matches every word across name, manufacturer, model and firmware, ignoring case', () => {
    expect(filterBuildsByQuery(BUILDS, '').length).toBe(5);
    expect(
      filterBuildsByQuery(BUILDS, 'baofeng club')
        .map((b) => b.name)
        .sort(),
    ).toEqual(['Club A', 'Club B']);
    expect(filterBuildsByQuery(BUILDS, 'MM9PDY dm-32').length).toBe(2);
    expect(filterBuildsByQuery(BUILDS, 'retevis mobile').map((b) => b.name)).toEqual(['Mobile']);
    expect(filterBuildsByQuery(BUILDS, 'baofeng mobile')).toEqual([]);
  });
});

describe('relativeTime', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');
  it('reads as an age', () => {
    expect(relativeTime('2026-11-20T12:00:00Z', now)).toBe('3 days ago');
    expect(relativeTime('2026-11-23T11:59:30Z', now)).toBe('just now');
  });
});
