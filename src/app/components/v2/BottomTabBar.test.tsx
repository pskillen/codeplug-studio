import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import BottomTabBar from './BottomTabBar.tsx';

describe('BottomTabBar', () => {
  const items = [
    { id: 'library', label: 'Library', icon: <span>L</span>, badge: 3 },
    { id: 'summary', label: 'Summary', icon: <span>S</span> },
  ];

  it('marks the active tab and reports changes', () => {
    const onChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <BottomTabBar items={items} activeId="library" onChange={onChange} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('button', { name: /Library/ })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: /Summary/ }));
    expect(onChange).toHaveBeenCalledWith('summary');
  });
});
