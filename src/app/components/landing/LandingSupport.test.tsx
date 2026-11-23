import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import {
  buildSupportMatrix,
  listRadioModels,
  listSupportModeColumns,
} from '@core/radio-targets/index.ts';
import { RADIOFOUNDRY_STUDIO_PIN } from '@core/radios/radiofoundry/firmware.ts';
import LandingSupport from './LandingSupport.tsx';

function renderLanding() {
  const handlers = {
    onStartFromRadio: vi.fn(),
    onStartProject: vi.fn(),
    onOpenDrive: vi.fn(),
    onImport: vi.fn(),
  };
  render(
    <MemoryRouter>
      <MantineProvider>
        <LandingSupport {...handlers} />
      </MantineProvider>
    </MemoryRouter>,
  );
  return handlers;
}

describe('LandingSupport', () => {
  it('offers the ways in, radio first, each wired to its callback', () => {
    const handlers = renderLanding();
    const paths = within(screen.getByRole('navigation', { name: 'Get started' })).getAllByRole(
      'button',
    );
    expect(paths.map((b) => b.querySelector('span:last-child span')?.textContent)).toEqual([
      'Start from my radio',
      'Start from scratch',
      'Open from Google Drive',
      'Import a project file',
    ]);
    fireEvent.click(screen.getByRole('button', { name: /Start from my radio/ }));
    fireEvent.click(screen.getByRole('button', { name: /Start from scratch/ }));
    fireEvent.click(screen.getByRole('button', { name: /Open from Google Drive/ }));
    fireEvent.click(screen.getByRole('button', { name: /Import a project file/ }));
    expect(handlers.onStartFromRadio).toHaveBeenCalledTimes(1);
    expect(handlers.onStartProject).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenDrive).toHaveBeenCalledTimes(1);
    expect(handlers.onImport).toHaveBeenCalledTimes(1);
  });

  it('offers one chip per catalog model', () => {
    renderLanding();
    const chips = within(screen.getByRole('group', { name: 'Radio' })).getAllByRole('button');
    expect(chips).toHaveLength(listRadioModels().length);
  });

  it('shows an unsupported stock card with a pointer to the supported firmware', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /DM-1701/ }));
    const stock = screen.getByTestId('fw-card-stock');
    expect(within(stock).getByText('Not supported.')).toBeInTheDocument();
    expect(stock.textContent).toContain('Use OpenGD77 instead');
  });

  it('marks DMR features not applicable for an FM radio', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /UV-5R Mini/ }));
    const card = screen.getByTestId('fw-card-stock');
    // Two DMR feature columns plus one "Not applicable" per digital mode column.
    expect(within(card).getAllByText('Not applicable').length).toBe(
      2 + listSupportModeColumns().filter((m) => !['fm', 'am', 'ssb'].includes(m)).length,
    );
  });

  it('renders a matrix row per model firmware and filters by class', () => {
    renderLanding();
    const expected = buildSupportMatrix().flatMap((m) =>
      m.firmware.map((f) => `matrix-${m.model.id}-${f.firmware.id}`),
    );
    for (const id of expected) expect(screen.getByTestId(id)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'FM' }));
    expect(screen.queryByTestId('matrix-baofeng-dm32uv-stock')).not.toBeInTheDocument();
    expect(screen.getByTestId('matrix-baofeng-uv5r-mini-stock')).toBeInTheDocument();
  });

  it('shows the legend', () => {
    renderLanding();
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows channel mode columns with evidence', () => {
    renderLanding();
    expect(screen.getByTestId('mode-baofeng-dm32uv-radiofoundry-fm')).toHaveAttribute(
      'data-evidence',
      'bench',
    );
    expect(screen.getByTestId('mode-baofeng-dm1701-radiofoundry-dmr')).toHaveAttribute(
      'data-evidence',
      'on-air',
    );
    expect(screen.getByTestId('mode-anytone-at-d890uv-stock-fm')).toHaveAttribute(
      'data-evidence',
      'none',
    );
  });

  it('shows the checked build on RadioFoundry rows', () => {
    renderLanding();
    expect(screen.getByTestId('matrix-baofeng-dm32uv-radiofoundry').textContent).toContain(
      RADIOFOUNDRY_STUDIO_PIN.git,
    );
    expect(screen.getByTestId('matrix-baofeng-dm32uv-stock').textContent).not.toContain(
      RADIOFOUNDRY_STUDIO_PIN.git,
    );
  });

  it('shows the evidence legend', () => {
    renderLanding();
    const legend = screen.getByRole('list', { name: 'Evidence' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(4);
  });

  it('lists channel modes on a firmware card', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /DM-32UV/ }));
    const card = within(screen.getByTestId('fw-card-radiofoundry'));
    expect(card.getByText('Channel modes')).toBeInTheDocument();
    expect(card.getByText('FM')).toBeInTheDocument();
    expect(card.getAllByText('DMR').length).toBeGreaterThanOrEqual(1);
    expect(card.getByText(/Checked against/)).toBeInTheDocument();
  });
});

describe('best firmware', () => {
  it('highlights the firmware with the most features when several are supported', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /DM-32UV/ }));
    expect(screen.getAllByText('Most features')).toHaveLength(1);
  });
});
