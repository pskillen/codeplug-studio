import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import DebugIndexPage from './DebugIndexPage.tsx';

function card(model: string): HTMLElement {
  return screen.getByText(model, { selector: '.mantine-Text-root' }).closest('.mantine-Card-root')!;
}

describe('debug index radios', () => {
  it('shows each model once with firmware buttons', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <DebugIndexPage />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText('MD-9600')).toHaveLength(1);
    expect(screen.getAllByText('DM-1701')).toHaveLength(1);
    const md9600 = card('MD-9600');
    expect(md9600.querySelector('a[href="/debug/radios/md-9600/opengd77"]')).toHaveTextContent(
      'OpenGD77',
    );
    expect(md9600.querySelector('a[href="/debug/radios/md-9600/radiofoundry"]')).toHaveTextContent(
      'RadioFoundry',
    );
    expect(screen.queryByText(/Backup · /)).not.toBeInTheDocument();
  });
});
