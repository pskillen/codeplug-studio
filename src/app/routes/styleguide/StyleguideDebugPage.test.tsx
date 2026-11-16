import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import StyleguideDebugPage from './StyleguideDebugPage.tsx';

const renderPage = () =>
  render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <StyleguideDebugPage />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );

describe('StyleguideDebugPage', () => {
  it('shows a section per kit component on synthetic data', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Debug pages' })).toBeInTheDocument();
    for (const title of [
      'CalibrationChartCard and CalibrationChartGrid',
      'TrimDisplay',
      'ValueTable',
      'SettingsTable and SensitiveRevealButton',
      'MemoryCategories and MemoryCategoryPanel',
    ]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('keeps passwords masked until Show password', () => {
    renderPage();
    expect(document.body.textContent).not.toContain('1234');
    const show = screen.getAllByRole('button', { name: 'Show password' })[0]!;
    fireEvent.click(show);
    expect(screen.getAllByRole('button', { name: 'Hide password' }).length).toBeGreaterThan(0);
  });

  it('draws overlay legends when Overlay is on', () => {
    renderPage();
    expect(screen.queryAllByText(/Read B/).length).toBe(0);
    fireEvent.click(screen.getByLabelText('Overlay', { selector: 'input[type=checkbox]' }));
    expect(screen.queryAllByText(/Read B/).length).toBeGreaterThan(0);
  });
});
