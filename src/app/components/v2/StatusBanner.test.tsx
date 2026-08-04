import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import StatusBanner from './StatusBanner.tsx';

describe('StatusBanner', () => {
  it('renders message for each tone', () => {
    render(
      <DesignSystemV2Provider>
        <StatusBanner tone="success">All references resolve.</StatusBanner>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('All references resolve.')).toBeInTheDocument();
  });

  it('defaults to info tone', () => {
    const { container } = render(
      <DesignSystemV2Provider>
        <StatusBanner>Note</StatusBanner>
      </DesignSystemV2Provider>,
    );

    expect(container.querySelector('[class*="info"]')).toBeTruthy();
  });
});
