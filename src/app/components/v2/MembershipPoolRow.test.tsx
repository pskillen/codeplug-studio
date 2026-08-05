import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import MembershipPoolRow from './MembershipPoolRow.tsx';

describe('MembershipPoolRow', () => {
  it('calls onCheck when clicked', () => {
    const onCheck = vi.fn();
    render(
      <DesignSystemV2Provider>
        <MembershipPoolRow label="GB3DA Stornoway" onCheck={onCheck} />
      </DesignSystemV2Provider>,
    );
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheck).toHaveBeenCalled();
  });

  it('never fires onCheck for a blocked (disabled) candidate — structural enforcement', () => {
    const onCheck = vi.fn();
    render(
      <DesignSystemV2Provider>
        <MembershipPoolRow label="This zone" onCheck={onCheck} disabled reason="This zone" />
      </DesignSystemV2Provider>,
    );
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDisabled();
    fireEvent.click(checkbox);
    expect(onCheck).not.toHaveBeenCalled();
  });

  it('shows the reason text when disabled, falling back to subtitle when reason is omitted', () => {
    const { rerender } = render(
      <DesignSystemV2Provider>
        <MembershipPoolRow label="Nested zone" disabled reason="Would create a cycle" />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('Would create a cycle')).toBeInTheDocument();

    rerender(
      <DesignSystemV2Provider>
        <MembershipPoolRow label="Nested zone" disabled subtitle="12 channels" />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('12 channels')).toBeInTheDocument();
  });

  it('hides pills when disabled', () => {
    render(
      <DesignSystemV2Provider>
        <MembershipPoolRow label="Nested zone" disabled pills={<span>2m</span>} />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByText('2m')).not.toBeInTheDocument();
  });
});
