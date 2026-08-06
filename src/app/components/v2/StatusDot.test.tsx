import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import StatusDot from './StatusDot.tsx';

describe('StatusDot', () => {
  it('renders the label', () => {
    render(
      <DesignSystemV2Provider>
        <StatusDot label="Verified" />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('defaults to success tone', () => {
    const { container } = render(
      <DesignSystemV2Provider>
        <StatusDot label="Verified" />
      </DesignSystemV2Provider>,
    );
    expect(container.querySelector('[class*="success"]')).toBeTruthy();
  });

  it('applies the requested tone', () => {
    const { container } = render(
      <DesignSystemV2Provider>
        <StatusDot label="Failed" tone="destructive" />
      </DesignSystemV2Provider>,
    );
    expect(container.querySelector('[class*="destructive"]')).toBeTruthy();
  });
});
