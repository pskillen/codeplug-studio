import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import MembershipRow from './MembershipRow.tsx';

describe('MembershipRow', () => {
  it('renders label, subtitle, and pills', () => {
    render(
      <DesignSystemV2Provider>
        <MembershipRow label="Channel 1" subtitle="145.575 MHz" pills={<span>FM</span>} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Channel 1')).toBeInTheDocument();
    expect(screen.getByText('145.575 MHz')).toBeInTheDocument();
    expect(screen.getByText('FM')).toBeInTheDocument();
  });

  it('omits the checkbox when onCheck is not provided, shows it when provided', () => {
    const { rerender } = render(
      <DesignSystemV2Provider>
        <MembershipRow label="Channel 1" />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    rerender(
      <DesignSystemV2Provider>
        <MembershipRow label="Channel 1" checked={false} onCheck={() => undefined} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('calls onRemove when the remove action is clicked, and omits it when not provided', () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <DesignSystemV2Provider>
        <MembershipRow label="Channel 1" onRemove={onRemove} />
      </DesignSystemV2Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Channel 1' }));
    expect(onRemove).toHaveBeenCalled();

    rerender(
      <DesignSystemV2Provider>
        <MembershipRow label="Channel 1" />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByRole('button', { name: 'Remove Channel 1' })).not.toBeInTheDocument();
  });

  it('renders the trailing edge-property slot', () => {
    render(
      <DesignSystemV2Provider>
        <MembershipRow label="Channel 1" trailing={<span>TS2</span>} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('TS2')).toBeInTheDocument();
  });
});
