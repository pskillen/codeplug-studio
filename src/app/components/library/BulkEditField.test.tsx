import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import BulkEditField from './BulkEditField.tsx';

describe('BulkEditField', () => {
  it('keeps children disabled while idle and shows a shared hint', () => {
    render(
      <DesignSystemV2Provider>
        <BulkEditField optedIn={false} onOptedInChange={() => undefined} sharedHint="50%">
          <input aria-label="Power" />
        </BulkEditField>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('button', { name: 'No change', pressed: true })).toBeInTheDocument();
    expect(screen.getByText('Shared value: 50%')).toBeInTheDocument();
    expect(screen.getByLabelText('Power')).toBeDisabled();
  });

  it('opts in when Set is clicked', () => {
    const onOptedInChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <BulkEditField optedIn={false} onOptedInChange={onOptedInChange}>
          <input aria-label="Power" />
        </BulkEditField>
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set' }));
    expect(onOptedInChange).toHaveBeenCalledWith(true);
  });
});
