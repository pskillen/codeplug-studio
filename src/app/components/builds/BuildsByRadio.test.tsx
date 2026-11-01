import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildWithEgresses } from '@core/domain/factories.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import BuildsByRadio from './BuildsByRadio.tsx';

const projectId = '11111111-1111-4111-8111-111111111111';

function build(targetId: string, name: string): RadioBuild {
  return { ...newRadioBuildWithEgresses(projectId, targetId).build, name };
}

function renderTree(builds: RadioBuild[]) {
  return render(
    <MemoryRouter>
      <MantineProvider>
        <BuildsByRadio builds={builds} />
      </MantineProvider>
    </MemoryRouter>,
  );
}

const BUILDS = [
  build('baofeng-dm32uv-mm9pdy', 'Club A'),
  build('baofeng-dm32uv-mm9pdy', 'Club B'),
  build('baofeng-dm32uv', 'Spare'),
  build('baofeng-uv5r-mini', 'Mini'),
  build('retevis-rt95', 'Mobile'),
];

describe('BuildsByRadio', () => {
  it('renders manufacturer → model → firmware → builds', () => {
    renderTree(BUILDS);
    expect(screen.getByRole('button', { name: 'Baofeng builds' })).toHaveTextContent('4 builds');
    const dm32 = screen
      .getByRole('button', { name: 'DM-32UV builds' })
      .closest('div')!.parentElement!;
    expect(dm32).toHaveTextContent('3 builds on 2 firmwares');
    expect(within(dm32).getByText('MM9PDY')).toBeInTheDocument();
    expect(within(dm32).getByText('Mod')).toBeInTheDocument();
    expect(within(dm32).getByRole('link', { name: 'Club A' })).toBeInTheDocument();
    expect(within(dm32).getByRole('link', { name: 'Spare' })).toBeInTheDocument();
  });

  it('links per-firmware "+ Another" rows to a preselected New build for multi-firmware models', () => {
    renderTree(BUILDS);
    const another = screen.getByRole('link', { name: '+ Another MM9PDY build' });
    expect(another).toHaveAttribute('href', '/builds/new?target=baofeng-dm32uv-mm9pdy');
    const stock = screen.getAllByRole('link', { name: '+ Another Stock build' });
    expect(stock.map((l) => l.getAttribute('href'))).toEqual([
      '/builds/new?target=baofeng-dm32uv',
      '/builds/new?target=retevis-rt95',
    ]);
  });

  it('gives single-firmware models a header "+ New" for their target', () => {
    renderTree([build('baofeng-uv5r-mini', 'Mini')]);
    expect(screen.getByRole('link', { name: '+ New' })).toHaveAttribute(
      'href',
      '/builds/new?target=baofeng-uv5r-mini',
    );
    expect(screen.queryByText(/Another/)).not.toBeInTheDocument();
  });

  it('opens a build', () => {
    const b = build('baofeng-uv5r-mini', 'Mini');
    renderTree([b]);
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      `/builds/${b.id}/export`,
    );
  });

  it('collapses a manufacturer and all groups', () => {
    renderTree(BUILDS);
    fireEvent.click(screen.getByRole('button', { name: 'Retevis builds' }));
    expect(screen.queryByRole('link', { name: 'Mobile' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByRole('link', { name: 'Mini' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByRole('link', { name: 'Mini' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mobile' })).toBeInTheDocument();
  });

  it('renders nothing for no builds', () => {
    renderTree([]);
    expect(screen.queryByRole('button', { name: 'Collapse all' })).not.toBeInTheDocument();
  });
});
