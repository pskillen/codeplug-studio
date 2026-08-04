import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import AppShell from './AppShell.tsx';

describe('AppShell', () => {
  it('renders header, nav, strip, main, and bottom bar slots', () => {
    render(
      <DesignSystemV2Provider>
        <AppShell
          header={<span>Header</span>}
          nav={<span>Nav</span>}
          contextualStrip={<span>Strip</span>}
          bottomBar={<span>Tabs</span>}
        >
          Main content
        </AppShell>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Nav')).toBeInTheDocument();
    expect(screen.getByText('Strip')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });
});
