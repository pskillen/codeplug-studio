import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import EmptyState from './EmptyState.tsx';

describe('EmptyState', () => {
  it('renders title, description, and action', () => {
    render(
      <DesignSystemV2Provider>
        <EmptyState
          title="No channels yet"
          description="Add channels from a directory or a CPS import."
          action={<button type="button">Add channels</button>}
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('No channels yet')).toBeInTheDocument();
    expect(screen.getByText('Add channels from a directory or a CPS import.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add channels' })).toBeInTheDocument();
  });

  it('omits description and action when not provided', () => {
    render(
      <DesignSystemV2Provider>
        <EmptyState title="No channels yet" />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('applies compact padding when compact is set', () => {
    const { container } = render(
      <DesignSystemV2Provider>
        <EmptyState title="No results" compact />
      </DesignSystemV2Provider>,
    );
    expect(container.querySelector('[class*="compact"]')).toBeTruthy();
  });
});
