import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { buildSupportMatrix, listRadioModels } from '@core/radio-targets/index.ts';
import LandingSupport from './LandingSupport.tsx';

function renderLanding(onStartProject = vi.fn(), onImport = vi.fn()) {
  render(
    <MemoryRouter>
      <MantineProvider>
        <LandingSupport onStartProject={onStartProject} onImport={onImport} />
      </MantineProvider>
    </MemoryRouter>,
  );
  return { onStartProject, onImport };
}

describe('LandingSupport', () => {
  it('has hero actions wired to the callbacks', () => {
    const { onStartProject, onImport } = renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'Create a project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import a project' }));
    expect(onStartProject).toHaveBeenCalledTimes(1);
    expect(onImport).toHaveBeenCalledTimes(1);
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
    expect(within(card).getAllByText('Not applicable').length).toBe(2);
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
});

describe('best firmware', () => {
  it('highlights the firmware with the most features when several are supported', () => {
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: /DM-32UV/ }));
    expect(screen.getAllByText('Most features')).toHaveLength(1);
  });
});
