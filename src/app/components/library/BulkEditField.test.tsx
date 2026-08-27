import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import BulkEditField from './BulkEditField.tsx';

describe('BulkEditField', () => {
  it('keeps children disabled while idle and does not show a shared-value line', () => {
    render(
      <DesignSystemV2Provider>
        <BulkEditField optedIn={false} onOptedInChange={() => undefined} hasSharedValue>
          <input aria-label="Power" />
        </BulkEditField>
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('radio', { name: 'Set' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'No change' })).not.toBeChecked();
    expect(screen.queryByText(/Shared value/)).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('radio', { name: 'Set' }));
    expect(onOptedInChange).toHaveBeenCalledWith(true);
  });

  it('opts in from the shared Set indicator while still idle', () => {
    const onOptedInChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <BulkEditField optedIn={false} onOptedInChange={onOptedInChange} hasSharedValue>
          <input aria-label="Power" />
        </BulkEditField>
      </DesignSystemV2Provider>,
    );

    fireEvent.pointerDown(screen.getByRole('radio', { name: 'Set' }));
    expect(onOptedInChange).toHaveBeenCalledWith(true);
  });
});
