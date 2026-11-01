import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { MemoryRouter } from 'react-router-dom';
import { DM32_PREFER_NEONPLUG_TITLE } from '../../components/builds/Dm32PreferNeonPlugAlert.tsx';
import NewBuildPage from './NewBuildPage.tsx';

const mockBuilds = vi.hoisted(() => ({
  builds: [] as { id: string; radioTargetId: string; name: string }[],
}));

vi.mock('../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: () => ({
    createBuild: vi.fn(),
    builds: mockBuilds.builds,
  }),
}));

function renderPage(url = '/builds/new') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <MantineProvider>
        <NewBuildPage />
      </MantineProvider>
    </MemoryRouter>,
  );
}

function modelCard(label: string): HTMLElement {
  const group = screen.getByRole('radiogroup', { name: new RegExp(`${label} firmware`) });
  return group.parentElement as HTMLElement;
}

describe('NewBuildPage', () => {
  it('groups radios by manufacturer and model with firmware rows and export routes', () => {
    mockBuilds.builds = [];
    renderPage();

    expect(screen.getByText('Radio target')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Baofeng/ })).toBeInTheDocument();

    const mini = modelCard('UV-5R Mini');
    expect(within(mini).getByRole('radio', { name: /Stock/ })).toBeInTheDocument();
    expect(mini).toHaveTextContent('Web Serial · NeonPlug · CHIRP CSV');

    const dm32 = modelCard('DM-32UV');
    const rows = within(dm32).getAllByRole('radio');
    expect(rows.map((r) => r.closest('label')?.textContent)).toEqual([
      expect.stringContaining('Stock'),
      expect.stringContaining('MM9PDY'),
      expect.stringContaining('RadioFoundry'),
    ]);
    expect(dm32).toHaveTextContent('Mod');
    expect(dm32).toHaveTextContent('Open');
  });

  it('lists unsupported stock as a disabled row', () => {
    renderPage();
    const card = modelCard('DM-1701 / RT-84');
    const stock = within(card).getByRole('radio', { name: /Stock/ });
    expect(stock).toBeDisabled();
    expect(card).toHaveTextContent('Not supported');
    expect(within(card).getByRole('radio', { name: /OpenGD77/ })).toBeEnabled();
  });

  it('does not show prefer-NeonPlug warning on New Radio (export-time only)', () => {
    renderPage();
    expect(screen.queryByText(DM32_PREFER_NEONPLUG_TITLE)).not.toBeInTheDocument();
  });

  it('filters by search and firmware kind', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Search radios'), { target: { value: 'radiofoundry' } });
    expect(screen.getByRole('radiogroup', { name: /DM-32UV/ })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: /UV-5R Mini/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search radios'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'FM only' }));
    expect(screen.queryByRole('radiogroup', { name: /DM-32UV/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: /UV-5R Mini/ })).toBeInTheDocument();
  });

  it('shows existing build counts and selection in the footer', () => {
    mockBuilds.builds = [
      { id: '1', radioTargetId: 'baofeng-dm32uv-mm9pdy', name: 'A' },
      { id: '2', radioTargetId: 'baofeng-dm32uv-mm9pdy', name: 'B' },
    ];
    renderPage();
    expect(modelCard('DM-32UV')).toHaveTextContent('2 builds');

    fireEvent.click(within(modelCard('DM-32UV')).getByRole('radio', { name: /MM9PDY/ }));
    const footer = screen.getByTestId('new-build-footer');
    expect(footer).toHaveTextContent('Baofeng DM-32UV · MM9PDY');
    expect(footer).toHaveTextContent('you have 2 builds for this already');
  });

  it('disables Next until a radio is chosen, then advances to the name step', () => {
    mockBuilds.builds = [];
    renderPage();
    expect(screen.getByRole('button', { name: /Next: name it/ })).toBeDisabled();

    fireEvent.click(within(modelCard('UV-5R Mini')).getByRole('radio', { name: /Stock/ }));
    fireEvent.click(screen.getByRole('button', { name: /Next: name it/ }));

    expect(screen.getByLabelText('Build name')).toHaveValue('Baofeng UV-5R Mini');
  });

  it('preselects the target from ?target= and names with the firmware', () => {
    renderPage('/builds/new?target=baofeng-dm32uv-radiofoundry');
    expect(within(modelCard('DM-32UV')).getByRole('radio', { name: /RadioFoundry/ })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /Next: name it/ }));
    expect(screen.getByLabelText('Build name')).toHaveValue('Baofeng DM-32UV · RadioFoundry');
  });

  it('ignores an unknown ?target=', () => {
    renderPage('/builds/new?target=nope');
    expect(screen.getByRole('button', { name: /Next: name it/ })).toBeDisabled();
  });
});
