import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import AppShell from './AppShell.tsx';

describe('AppShell', () => {
  it('renders brand, tabs, and project chip', () => {
    const onTabChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <AppShell
          tabs={['Summary', 'Library']}
          activeTab="Library"
          onTabChange={onTabChange}
          projectName="Skywarn Repeaters"
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Codeplug Studio')).toBeInTheDocument();
    expect(screen.getByText('Skywarn Repeaters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Summary' }));
    expect(onTabChange).toHaveBeenCalledWith('Summary');
  });
});
