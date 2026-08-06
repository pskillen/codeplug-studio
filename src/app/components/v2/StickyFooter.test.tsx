import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from './DesignSystemV2Provider.tsx';
import StickyFooter from './StickyFooter.tsx';

describe('StickyFooter', () => {
  it('shows unsaved status when dirty', () => {
    render(
      <DesignSystemV2Provider>
        <StickyFooter
          saveLabel="Save channel"
          dirty
          onCancel={() => {}}
          onSave={() => {}}
        />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('fires cancel and save handlers', () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(
      <DesignSystemV2Provider>
        <StickyFooter
          saveLabel="Save channel"
          onCancel={onCancel}
          onSave={onSave}
        />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save channel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });
});
