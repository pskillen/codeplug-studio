import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import DebugIndexPage from './DebugIndexPage.tsx';

function card(model: string): HTMLElement {
  return screen.getByRole('link', { name: model }).closest('.mantine-Card-root') as HTMLElement;
}

describe('debug index capability badges', () => {
  it('shows each radio its real capability status', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <DebugIndexPage />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    const mini = card('UV-5R Mini');
    expect(mini).toHaveTextContent('Backup · Available');
    expect(mini).toHaveTextContent('Calibration · Partial');
    expect(mini).toHaveTextContent('Memory · Partial');
    const rt95 = card('RT95');
    expect(rt95).toHaveTextContent('Backup · Available');
    expect(rt95).toHaveTextContent('Calibration · Not yet available');
    expect(rt95).toHaveTextContent('Memory · Partial');
    expect(card('AT-D890UV')).toHaveTextContent('Backup · Available');
    expect(card('AT-D890UV')).toHaveTextContent('Memory · Partial');
    expect(
      screen.getAllByRole('link', { name: 'DM-32UV' })[0].closest('.mantine-Card-root'),
    ).toHaveTextContent('Backup · Available');
  });
});
